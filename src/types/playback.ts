/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/playback.ts
//
// NOTE on units: `position_ticks` / `duration_ticks` are 100ns TICKS (the server
// session-progress contract). Media `runtime` (see `src/types/media.ts`) is in
// SECONDS — do not conflate the two.

// The ABR quality ladder rung shape is the single source of truth in
// `@phlix/contracts` (`Rendition`, added in v0.2.0 / step B1). Re-export it here
// so the transcode job/status shapes below can carry the server's `variants[]`
// without redeclaring a divergent local copy (G3).
export type { Rendition, RenditionId, QualitySelection } from '@phlix/contracts';
import type { Rendition, AudioTrack, SubtitleTrack } from '@phlix/contracts';

export interface StreamInfo {
  url: string;
  /**
   * Short-lived, signed direct-play URL (`/media/{id}/stream?exp&sig`). The media
   * server gates the stream route, and the native players (AVPlayer/ExoPlayer) are
   * handed a bare URI with no Authorization header — so when the server provides
   * this signed URL the player must use it instead of `url`. Optional: older
   * servers omit it (the player falls back to `url`).
   */
  stream_url?: string;
  protocol: 'hls' | 'http';
  container: string;
  size: number;
  bitrate: number;
  duration_seconds: number;
}

/**
 * Track shapes — S404 local-mirror retirement.
 *
 * This file used to RE-DECLARE `SubtitleTrack`/`AudioTrack` with a required
 * `display_title` (and optional `url`). That pair was a fiction: phlix-server's
 * authoritative `StreamTrackShaper` (verified at `01340633`) never emitted a
 * `display_title` key (zero hits in server `src/`). `@phlix/contracts` v0.4.5
 * corrected its playback.ts pair to the honest wire shape, so the local
 * mirror is retired and the wire types are re-exported verbatim — audio rows
 * carry `id, index, stream_index, codec, language, channels,
 * bitrate (always, nullable), title (nullable), default`; subtitle rows carry
 * `id, index, stream_index, language, label, codec, source, hearing_impaired,
 * url (signed path, null without itemId)`. Consumers that display a track
 * read `label` (subtitle) / `title ?? language` (audio) — never a key the
 * wire does not emit. The PlayerScreen transcode picker builds its rows in
 * exactly that honest shape.
 */
export type { AudioTrack, SubtitleTrack } from '@phlix/contracts';

/** Skip marker boundaries — populated from /api/v1/media/{id}/playback-info. */
export interface SkipMarkers {
  skip_intro_start: number | null;
  skip_intro_end: number | null;
  skip_outro_start: number | null;
  skip_outro_end: number | null;
}

// ── Markers / playback-info (server contract; all positions are SECONDS) ──────

/** A single marker window. `start_seconds`/`end_seconds` are SECONDS. */
export interface Marker {
  start_seconds: number;
  end_seconds: number;
}

/** A chapter — a marker with a display title. Positions in SECONDS. */
export interface Chapter {
  start_seconds: number;
  end_seconds: number;
  title: string;
}

/**
 * One-call markers/chapters source:
 * `GET /api/v1/media/{id}/playback-info`.
 * Reconciled to the server shape. `intro_marker`/`outro_marker` are null when
 * the item has no detected intro/outro. All positions are SECONDS.
 *
 * S407: the track rails are REQUIRED members because the server ALWAYS emits
 * both keys (`MediaItemController::getPlaybackInfo()` json at :340-341, rows
 * shaped by `StreamTrackShaper::audioTracks()/subtitleTracks()` — verified at
 * server `01340633`). An absent key is a wire bug, not an option — same
 * required-if-server-sends logic as the `dash_url` absence pin below, pinned
 * in both directions in `src/types/__tests__/playback.test.ts`. The row types
 * are the playback.ts WIRE pair (S404 ruling), never the `Stream*` DB mirror.
 */
export interface PlaybackInfo {
  item_id: string;
  intro_marker: Marker | null;
  outro_marker: Marker | null;
  chapters: Chapter[];
  /** Free-form server hint for skip-button presentation (shape not fixed). */
  skip_button_spec?: unknown;
  /** Audio rows of the played item — the picker's source of truth. */
  audio_tracks: AudioTrack[];
  /** Text-subtitle rows (bitmap rows are server-skipped). */
  subtitle_tracks: SubtitleTrack[];
}

// ── Transcode lifecycle (server contract) ────────────────────────────────────

/** Status values reported by the transcode pipeline. */
export type TranscodeStatusValue = 'encoding' | 'ready' | 'failed' | string;

/**
 * A signed subtitle track returned alongside a transcode job. `url` is an
 * ABSOLUTE signed VTT URL — use it directly (do NOT join onto axios baseURL).
 */
export interface TranscodeSubtitle {
  language: string;
  url: string;
}

/**
 * `POST /api/v1/media/{id}/transcode` response. `master_url`/`hls_url` are
 * ABSOLUTE signed URLs.
 *
 * ⚠ There is deliberately NO `dash_url`. phlix-server stopped emitting it in
 * S11 because real DASH is unbuilt (tracked as S56-S60), so the advertised
 * `/dash/{job}/manifest.mpd` always 404'd — declaring it handed this client a
 * compile-time guarantee of a field that is `undefined` at runtime, which is
 * strictly worse than omitting it. `@phlix/contracts` v0.4.0 dropped it from
 * `TranscodeStartResponse` for the same reason; this local copy follows.
 *
 * Do not re-add it, not even as an optional member: an optional key invites
 * every consumer to keep testing for something that is never sent. When DASH
 * actually ships it comes back as a REQUIRED field, in lockstep with the
 * server. The absence is pinned at the type level by
 * `src/types/__tests__/playback.test.ts` ("declares no dash_url on either
 * transcode shape") — `tsc --noEmit` is what kills a re-add; jest transpiles
 * without type-checking and stays green.
 */
export interface TranscodeJob {
  job_id: string;
  master_url: string;
  hls_url: string;
  status: TranscodeStatusValue;
  reused: boolean;
  subtitles: TranscodeSubtitle[];
  /**
   * The playable ABR quality ladder (server A7). Highest-first; each rung's
   * `url` is an ABSOLUTE signed `media_v{id}.m3u8`. `null`/absent for a legacy
   * pre-ABR server, in which case the client shows only Auto (native ABR on the
   * master). See `@phlix/contracts` `Rendition`.
   */
  variants?: Rendition[] | null;
}

/**
 * `GET /api/v1/transcode/{jobId}/status` response. `progress` is 0-100.
 *
 * ⚠ No `dash_url` here either — see {@link TranscodeJob}.
 */
export interface TranscodeStatus {
  job_id: string;
  status: TranscodeStatusValue;
  segments: number;
  playlist_ready: boolean;
  progress: number;
  master_url: string;
  subtitles: TranscodeSubtitle[];
  /** Same ABR ladder as {@link TranscodeJob.variants} (server A7). */
  variants?: Rendition[] | null;
}

export interface PlaybackSession {
  id: string;
  user_id: string;
  media_item_id: string;
  server_id: string;
  client_name: string;
  device_id: string;
}
