// src/types/media.ts
//
// Reconciled to the SERVER's ground-truth media shape in E2 (the API-correctness
// slice). Field names + units come from `phlix-server` `GET /api/v1/media/{id}`:
//   - `rating` is a STRING (was `official_rating`)
//   - `runtime` is in MINUTES (TMDB metadata; was `run_time_ticks` — ticks).
//     The precise media length in SECONDS is the separate `duration` field.
//   - the server returns `type: movie | series | season | episode` for video;
//     mobile keeps a permissive superset (adds music | photo | audio | image)
//     so existing `=== 'music'` / `=== 'photo'` checks still compile.
//
// NOTE on units: media `runtime` is MINUTES and `duration` is SECONDS, but
// PLAYBACK progress (`position_ticks` / `duration_ticks` in continue-watching +
// session progress) is in 100ns TICKS. Do not conflate them — see
// `src/types/playback.ts`.

/** Server video types are movie|series|season|episode; music/photo are library kinds. */
export type MediaType =
  | 'movie'
  | 'series'
  | 'season'
  | 'episode'
  | 'music'
  | 'photo'
  | 'audio'
  | 'image';

export interface MediaStream {
  stream_index: number;
  stream_type: string;
  codec: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  year?: number;
  /** Content rating label, e.g. "PG-13" (server `rating`, a string). */
  rating?: string;
  /** Runtime in MINUTES (server `runtime`, TMDB metadata). */
  runtime?: number;
  /** Precise media length in SECONDS (server `duration`); player scrubber length. */
  duration?: number;
  genres?: string[];
  director?: string;
  actors?: string[];
  // Hierarchy (series → season → episode). Episode.parent_id is the SEASON id.
  parent_id?: string | null;
  season_number?: number;
  episode_number?: number;
  episode_title?: string;
  // Present on detail (`GET /media/{id}`) responses.
  streams?: MediaStream[];
  /** Signed direct-play URL minted by the server on the detail payload. */
  stream_url?: string;
  // Present on `GET /users/me/continue-watching` items (resume info).
  /** 0–100 watched percentage (continue-watching). */
  progress_percent?: number;
  /** Resume position in 100ns TICKS (continue-watching). */
  position_ticks?: number;
  /** ISO timestamp from `GET /users/me/recently-watched`. */
  watched_at?: string;
  user_data?: UserData;
}

export interface UserData {
  playback_position_ticks?: number;
  resume_position_ticks?: number;
  is_watched?: boolean;
  rating?: number;
  favorite?: boolean;
}

export interface Series extends MediaItem {
  type: 'series';
  series_name?: string;
}

/**
 * A season is a media item with `parent_id = seriesId` and `season_number` set
 * (server `GET /media?parentId={seriesId}`). Modeled as a MediaItem rather than
 * a bespoke shape so the children endpoint can return it directly.
 */
export interface Season extends MediaItem {
  type: 'season';
  season_number?: number;
}

/**
 * An episode is a media item with `parent_id = seasonId` (NOT seriesId) and
 * `season_number` + `episode_number` set (`GET /media?parentId={seasonId}`).
 */
export interface Episode extends MediaItem {
  type: 'episode';
  episode_number?: number;
  season_number?: number;
}

export interface Movie extends MediaItem {
  type: 'movie';
}

export interface Library {
  id: string;
  name: string;
  /** Server library kind. */
  type: 'video' | 'audio' | 'image' | 'movie' | 'series' | 'music' | 'photo';
  item_count?: number;
  paths?: string[];
  /** Series libraries: one directory per series. May arrive top-level or under options. */
  series_per_directory?: boolean;
  options?: { series_per_directory?: boolean } & Record<string, unknown>;
}
