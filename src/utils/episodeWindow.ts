/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/episodeWindow.ts
//
// MOB-20 / MOB-S18: the season episode list is chunk-rendered. The window is
// keyed to the season it was grown for, so switching seasons falls back to the
// first chunk by construction (no imperative reset to forget).

/** Rows rendered before "Show more" and added by each tap. */
export const EPISODE_CHUNK = 40;

export interface EpisodeWindow {
  seasonId: string | null;
  limit: number;
}

export const initialEpisodeWindow: EpisodeWindow = { seasonId: null, limit: EPISODE_CHUNK };

/** The limit in force for `seasonId`: a window grown for another season is stale. */
export function effectiveEpisodeLimit(win: EpisodeWindow, seasonId: string | null): number {
  return win.seasonId === seasonId ? win.limit : EPISODE_CHUNK;
}

/** "Show more": grow the window for `seasonId` by one chunk. */
export function growEpisodeWindow(win: EpisodeWindow, seasonId: string | null): EpisodeWindow {
  return { seasonId, limit: effectiveEpisodeLimit(win, seasonId) + EPISODE_CHUNK };
}

export function visibleEpisodes<T>(episodes: readonly T[], limit: number): T[] {
  return episodes.slice(0, limit);
}

export function remainingEpisodes(total: number, limit: number): number {
  return Math.max(0, total - limit);
}
