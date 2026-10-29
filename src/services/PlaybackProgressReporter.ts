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
 * Mirrors the web player's RESUME_MIN_SECONDS (and the server's own gate).
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
    if (!useAuthStore.getState().isAuthenticated) {
      // A session belongs to an authenticated user — never aim a later
      // report at the previous account's session after a logout.
      this.forgetSession();
      return;
    }
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
      const sessionId = await this.ensureSession();
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
    if (
      live !== undefined &&
      live.durationSeconds > 0 &&
      live.positionSeconds > RESUME_MIN_SECONDS
    ) {
      this.lastSnapshot = live;
    }
    if (!useAuthStore.getState().isAuthenticated || this.sessionId === null || this.lastSnapshot === null) {
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
    if (!useAuthStore.getState().isAuthenticated || this.sessionId === null) {
      return;
    }
    try {
      await playbackManager.completeSession(this.sessionId, mediaItemId, true);
    } catch {
      // best-effort — the item just stays in Continue Watching; a later
      // report or another device reconciles. Must never crash the player.
    }
  }

  /** Drop all local state (logout, tests). Idempotent. */
  forgetSession(): void {
    this.sessionId = null;
    this.sessionCreation = null;
    this.lastSnapshot = null;
    this.lastReportMs = 0;
  }

  private async ensureSession(): Promise<string | null> {
    if (this.sessionId !== null) {
      return this.sessionId;
    }
    if (this.sessionCreation === null) {
      this.sessionCreation = this.createSession().finally(() => {
        this.sessionCreation = null;
      });
    }
    return this.sessionCreation;
  }

  private async createSession(): Promise<string | null> {
    try {
      this.sessionId = await playbackManager.createSession({
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
      this.sessionId = null;
    }
    return this.sessionId;
  }
}

export const playbackProgressReporter = new PlaybackProgressReporter();
