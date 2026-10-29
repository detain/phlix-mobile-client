/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/media.ts
//
// Reconciled to the SERVER's ground-truth media shape in E2 (the API-correctness
// slice). Field names + units come from `phlix-server` `GET /api/v1/media/{id}`:
//   - `rating` is a STRING (was `official_rating`)
//   - `runtime` is in MINUTES (TMDB metadata; was `run_time_ticks` — ticks).
//     The precise media length in SECONDS is the separate `duration` field.
//   - `type` is the full `media_items.type` column ENUM, re-exported from
//     `@phlix/contracts` rather than redeclared here (see below).
//
// NOTE on units: media `runtime` is MINUTES and `duration` is SECONDS, but
// PLAYBACK progress (`position_ticks` / `duration_ticks` in continue-watching +
// session progress) is in 100ns TICKS. Do not conflate them — see
// `src/types/playback.ts`.

/**
 * Media type discriminator — re-exported from `@phlix/contracts`, the single
 * source of truth for the `media_items.type` column ENUM (13 members: movie,
 * series, season, episode, track, music, album, artist, video, audio, book,
 * photo, audiobook).
 *
 * This was previously a hand-rolled permissive superset that added a bogus
 * `image` — a value the server never emits (the photo kind is `photo`; `image`
 * is a scanner-side label keying the media scanner's file-extension set). The
 * same stale list in the server's `MediaItemShaper::VALID_TYPES` was
 * relabelling real photo/book/audiobook/track rows as "movie"
 * (phlix-server#527).
 *
 * The superset existed to keep `=== 'music'` / `=== 'photo'` checks compiling
 * against a contracts union that lacked both. Contracts now has all 13, so the
 * divergence is gone — re-export rather than redeclare, so this cannot drift
 * again. Do not turn it back into a literal union.
 */
import type { MediaType } from '@phlix/contracts';

export type { MediaType };

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
  // Present on `GET /users/me/continue-watching` items (resume info). The
  // server re-attaches these TOP-LEVEL after shaping
  // (`PlaybackController::getContinueWatching`); there is NO
  // `progress_percent` on the wire — percentages are derived client-side from
  // the tick pair (see `utils/resumePositions`).
  /** Resume position in 100ns TICKS (continue-watching). */
  position_ticks?: number;
  /** Full media length in 100ns TICKS (continue-watching). */
  duration_ticks?: number;
  /** The shaped row's media id, re-attached by the continue-watching rail. */
  media_item_id?: string;
  /** ISO timestamp from `GET /users/me/recently-watched`. */
  watched_at?: string;
  /**
   * Per-user data. On `GET /media/{id}` (favorites E10) this is
   * `{favorite, rating}` when authenticated and `null` when not — so the field
   * is `UserData | null`. Absent on most list payloads.
   */
  user_data?: UserData | null;
}

/**
 * Per-user data block the server attaches on `GET /media/{id}` (when
 * authenticated; `null` for guests) and on each `GET /users/me/favorites`
 * item. Wire truth is the server's `user_item_data` row — exactly these four
 * fields (`WebPortalRouter::resolveUserData`, `MediaUserDataController`).
 *
 * There are NO resume fields here: the server never sends
 * `resume_position_ticks` / `playback_position_ticks` / `is_watched`. The
 * resume position lives ONLY on the continue-watching rail rows (top-level
 * `position_ticks`) — see `utils/resumePositions`.
 *
 * `rating` is the USER's 1–10 score and is `null` (not absent) when unset; it is
 * distinct from `MediaItem.rating`, which is the content-rating label string.
 * `like_level` is the signed −2..2 thumbs axis (0 = not set).
 */
export interface UserData {
  /** User's 1–10 rating; `null`/absent when unrated (server `user_data.rating`). */
  rating?: number | null;
  /** Whether the user favorited this item (server `user_data.favorite`). */
  favorite?: boolean;
  /** Signed −2..2 thumbs axis; 0 when unset (server `user_data.like_level`). */
  like_level?: number;
  /** Seen/unseen flag (server `user_data.watched`). */
  watched?: boolean;
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
  /**
   * Server library kind — the `libraries.type` ENUM, which is SEVEN members
   * and is NOT the same vocabulary as {@link MediaType} (`media_items.type`,
   * 13 members). They overlap but are distinct; do not merge them.
   *
   *     enum('movie','series','music','photo','video','book','audiobook')
   *
   * This union previously declared `audio` and `image`, neither of which the
   * server can ever send (`image` is a scanner-side extension-set label; the
   * column calls that kind `photo`), while OMITTING `book` and `audiobook`,
   * which migration 035 made real.
   */
  type: 'movie' | 'series' | 'music' | 'photo' | 'video' | 'book' | 'audiobook';
  item_count?: number;
  paths?: string[];
  /** Series libraries: one directory per series. May arrive top-level or under options. */
  series_per_directory?: boolean;
  options?: { series_per_directory?: boolean } & Record<string, unknown>;
}
