/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/PlaybackProgressReporter.ts
//
// The cross-device resume WRITE path (review mobile__gameux C-1). Before this
// existed the phone opened `PlaybackManager`'s sessions API nowhere, so
// Continue Watching / Watch History / Resume were blind to phone playback.
// This mirrors the ratified web shell's `useResumeReporter` (phlix-ui):
// lazy session per stable device id (idempotent server-side), throttled tick
// reports, forced reports on play/pause transitions, a retained snapshot
// flushed on unmount, and the explicit `/complete` signal on the natural end.
//
// Best-effort by law: every failure (offline, 401, 5xx) is swallowed — a
// missed checkpoint is covered by the next tick, the local rails, or another
// device. Nothing here may ever crash or block the player.

import { Platform } from 'react-native';
import { playbackManager } from '../api/PlaybackManager';
import { getCachedDeviceId, getDeviceName } from '../api/deviceIdentity';
import { useAuthStore } from '../stores/useAuthStore';
import { secondsToTicks } from '../utils/resumePositions';

/**
 * Resume floor: below this many watched seconds the app never opens a server
 * session — an accidental two-second tap must not pollute Continue Watching.
 * Mirrors the web player's RESUME_MIN_SECONDS. This is a CLIENT-side gate:
 * the server has no 30s floor — its rail filter only drops rows with
 * position_ticks <= 0 or at/over 0.95 × duration and keeps status
 * playing/paused (SessionController).
 */
export const RESUME_MIN_SECONDS = 30;

/** Minimum gap between progress POSTs. The server wants a periodic
 *  checkpoint, not every native tick; 15s matches the ratified web cadence. */
const REPORT_THROTTLE_MS = 15_000;

/** One playback measurement, in PLAYER units (seconds, paused flag). */
export interface ProgressSnapshot {
  mediaItemId: string;
  positionSeconds: number;
  durationSeconds: number;
  paused: boolean;
}

class PlaybackProgressReporter {
  private sessionId: string | null = null;
  /**
   * The account `sessionId` (or an in-flight creation) belongs to, stamped
   * from the auth store the moment it is opened. The server 403s every
   * progress/complete write whose session user_id does not match the caller,
   * and a logout from Settings happens with the player already unmounted —
   * no report ever fires in the gap — so every entry point compares this
   * stamp against the CURRENT user id and drops the session on drift.
   */
  private sessionOwner: string | null = null;
  /** Single in-flight session creation shared by concurrent callers. */
  private sessionCreation: Promise<string | null> | null = null;
  private lastReportMs = 0;
  private inFlight = false;
  /**
   * The freshest in-band progress, retained on EVERY reportable tick AHEAD of
   * the throttle (web S506 lineage): the unmount flush posts this even when
   * the player state has already been torn down.
   */
  private lastSnapshot: ProgressSnapshot | null = null;

  /**
   * Report a playback position. No-op when logged out, when the media length
   * is unknown (live streams report duration 0), or below the resume floor.
   * Throttled unless `force` (a pause/resume transition never waits).
   */
  async report(snapshot: ProgressSnapshot, force = false): Promise<void> {
    const state = useAuthStore.getState();
    if (!state.isAuthenticated) {
      // A session belongs to an authenticated user — never aim a later
      // report at the previous account's session after a logout.
      this.forgetSession();
      return;
    }
    // Account switch WITHOUT any unauthenticated call in between (the real
    // Settings logout never reports before flipping users): a held session
    // owned by a different user id can only ever 403 — drop it and open a
    // fresh one for the current account.
    const userId = state.user?.id ?? null;
    this.forgetSessionIfAccountChanged(userId);
    if (!(snapshot.durationSeconds > 0) || !(snapshot.positionSeconds > RESUME_MIN_SECONDS)) {
      return;
    }
    // Retain before any early return below: the freshest position must
    // survive even a tick that the throttle swallows.
    this.lastSnapshot = snapshot;
    const now = Date.now();
    if (this.inFlight || (!force && now - this.lastReportMs < REPORT_THROTTLE_MS)) {
      return;
    }
    this.inFlight = true;
    this.lastReportMs = now;
    try {
      const sessionId = await this.ensureSession(userId);
      if (sessionId === null) {
        return;
      }
      await playbackManager.reportProgress(sessionId, {
        mediaItemId: snapshot.mediaItemId,
        positionTicks: secondsToTicks(snapshot.positionSeconds),
        durationTicks: secondsToTicks(snapshot.durationSeconds),
        isPaused: snapshot.paused,
      });
    } catch {
      // best-effort — the next checkpoint (or another device) covers it.
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Flush the final position on teardown (player unmount / quit): refresh the
   * retained snapshot from the LIVE position when it is still meaningful,
   * then force one report. Never creates a session just for the tail — a
   * title that never crossed the floor has nothing on the server to flush.
   */
  async flush(live?: ProgressSnapshot): Promise<void> {
    const state = useAuthStore.getState();
    if (!state.isAuthenticated) {
      return;
    }
    // Same account-switch law as report(): a tail for the previous account
    // is worthless (the server owns the session out) — drop it, flush nothing.
    this.forgetSessionIfAccountChanged(state.user?.id ?? null);
    if (
      live !== undefined &&
      live.durationSeconds > 0 &&
      live.positionSeconds > RESUME_MIN_SECONDS
    ) {
      this.lastSnapshot = live;
    }
    if (this.sessionId === null || this.lastSnapshot === null) {
      return;
    }
    const snapshot = this.lastSnapshot;
    const sessionId = this.sessionId;
    try {
      await playbackManager.reportProgress(sessionId, {
        mediaItemId: snapshot.mediaItemId,
        positionTicks: secondsToTicks(snapshot.positionSeconds),
        durationTicks: secondsToTicks(snapshot.durationSeconds),
        isPaused: snapshot.paused,
      });
    } catch {
      // best-effort — a lost tail costs at most one throttle window of
      // progress; the last server checkpoint still resumes the title.
    }
  }

  /**
   * Signal the natural end of playback → `/complete` with `reached_end: true`,
   * which marks the item watched, drops it from Continue Watching, and
   * finalizes watch-time stats. A safe no-op without a session (playback
   * never crossed the floor) — it never creates one just to finish.
   */
  async complete(mediaItemId: string): Promise<void> {
    const state = useAuthStore.getState();
    if (!state.isAuthenticated) {
      return;
    }
    // Never finalize on the previous account's session — see flush().
    this.forgetSessionIfAccountChanged(state.user?.id ?? null);
    if (this.sessionId === null) {
      return;
    }
    try {
      await playbackManager.completeSession(this.sessionId, mediaItemId, true);
    } catch {
      // best-effort — the item just stays in Continue Watching; a later
      // report or another device reconciles. Must never crash the player.
    }
  }

  /** Drop all local state (logout, account switch, tests). Idempotent. */
  forgetSession(): void {
    this.sessionId = null;
    this.sessionOwner = null;
    this.sessionCreation = null;
    this.lastSnapshot = null;
    this.lastReportMs = 0;
  }

  /**
   * Forget the held/in-flight session when it belongs to a different account
   * than `userId`. A fresh session is then opened lazily by the next
   * reportable tick (never created merely to finish a stale flush/complete).
   */
  private forgetSessionIfAccountChanged(userId: string | null): void {
    const holdsAccountState = this.sessionId !== null || this.sessionCreation !== null;
    if (holdsAccountState && userId !== this.sessionOwner) {
      this.forgetSession();
    }
  }

  private async ensureSession(userId: string | null): Promise<string | null> {
    if (this.sessionId !== null) {
      return this.sessionId;
    }
    if (this.sessionCreation === null) {
      this.sessionOwner = userId;
      const creation = this.createSession().finally(() => {
        // Only clear OUR slot — a forget (logout/switch) plus a newer
        // creation may already own it by the time this settles.
        if (this.sessionCreation === creation) {
          this.sessionCreation = null;
        }
      });
      this.sessionCreation = creation;
    }
    return this.sessionCreation;
  }

  private async createSession(): Promise<string | null> {
    const owner = this.sessionOwner;
    let sessionId: string | null;
    try {
      sessionId = await playbackManager.createSession({
        // Stable per-install id → the server reuses ONE session row for this
        // device (idempotent per `device_id`), same contract the web shell
        // and Roku use.
        deviceId: getCachedDeviceId(),
        deviceName: getDeviceName(),
        deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
      });
    } catch {
      // A failed creation must not poison later plays: the next reportable
      // tick retries (throttle-gated), and no session means every other
      // method stays a no-op.
      return null;
    }
    if (this.sessionOwner !== owner) {
      // The account changed while this creation was in flight — the freshly
      // minted session belongs to the previous user; committing it would
      // reintroduce the stale-403 bug this guard exists to prevent.
      return null;
    }
    this.sessionId = sessionId;
    return this.sessionId;
  }
}

export const playbackProgressReporter = new PlaybackProgressReporter();
