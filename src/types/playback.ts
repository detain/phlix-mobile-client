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
import type { Rendition } from '@phlix/contracts';

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

export interface SubtitleTrack {
  id: string;
  codec: string;
  language: string;
  display_title: string;
  url?: string;
}

export interface AudioTrack {
  id: string;
  codec: string;
  language: string;
  display_title: string;
  channels: number;
  url?: string;
}

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
 */
export interface PlaybackInfo {
  item_id: string;
  intro_marker: Marker | null;
  outro_marker: Marker | null;
  chapters: Chapter[];
  /** Free-form server hint for skip-button presentation (shape not fixed). */
  skip_button_spec?: unknown;
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
 * `POST /api/v1/media/{id}/transcode` response. `master_url`/`hls_url`/`dash_url`
 * are ABSOLUTE signed URLs.
 */
export interface TranscodeJob {
  job_id: string;
  master_url: string;
  hls_url: string;
  dash_url: string;
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

/** `GET /api/v1/transcode/{jobId}/status` response. `progress` is 0-100. */
export interface TranscodeStatus {
  job_id: string;
  status: TranscodeStatusValue;
  segments: number;
  playlist_ready: boolean;
  progress: number;
  master_url: string;
  dash_url: string;
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
