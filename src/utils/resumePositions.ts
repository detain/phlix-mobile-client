/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/resumePositions.ts
//
// The resume/progress UNIT boundary for the sessions API. The server stores
// playback position in 100ns TICKS (`playback_state.position_ticks` /
// `duration_ticks`, re-emitted top-level on every
// `GET /api/v1/users/me/continue-watching` row), while the native player and
// every navigation param work in SECONDS. Convert only at these two edges —
// never mid-flow (estate ms-vs-sec discipline, same rule as the SyncPlay
// position bridge in PlayerScreen).

import type { MediaItem } from '../types/media';

/** 100ns ticks per second — the server `playback_state` column unit. */
export const TICKS_PER_SECOND = 10_000_000;

/** Player seconds → server ticks (floored; ticks are integers). */
export const secondsToTicks = (seconds: number): number =>
  Math.floor(seconds * TICKS_PER_SECOND);

/** Server ticks → player seconds (floored — a resume point never overshoots). */
export const ticksToSeconds = (ticks: number): number =>
  Math.floor(ticks / TICKS_PER_SECOND);

/**
 * Index the `GET /users/me/continue-watching` rail by media id → resume
 * position in ticks. The rail row carries `position_ticks` TOP-LEVEL (server
 * `PlaybackController::getContinueWatching` re-attaches it after shaping);
 * rows without a positive numeric position carry nothing to resume and are
 * skipped. This is the resume READ path — the per-item detail payload never
 * carries a resume position (the server's `user_data` block is
 * `{favorite, rating, like_level, watched}` only).
 */
export const buildResumeMap = (items: MediaItem[]): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const item of items) {
    const ticks = item.position_ticks;
    if (typeof item.id === 'string' && item.id !== '' && typeof ticks === 'number' && ticks > 0) {
      map[item.id] = ticks;
    }
  }
  return map;
};

/**
 * Watched percentage (0–100) of a continue-watching rail row, derived from
 * its top-level `position_ticks` / `duration_ticks`. The server does NOT send
 * a `progress_percent` field on these rows — the card used to read that
 * phantom and render 0% forever. Duration missing/zero → 0 (nothing to scale).
 */
export const continueWatchingProgressPercent = (item: MediaItem): number => {
  const position = item.position_ticks ?? 0;
  const duration = item.duration_ticks ?? 0;
  if (!(duration > 0) || position <= 0) {
    return 0;
  }
  return Math.min(100, (position / duration) * 100);
};
