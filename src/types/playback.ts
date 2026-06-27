// src/types/playback.ts
//
// NOTE on units: `position_ticks` / `duration_ticks` are 100ns TICKS (the server
// session-progress contract). Media `runtime` (see `src/types/media.ts`) is in
// SECONDS — do not conflate the two.

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

/** Skip marker boundaries — TODO(E3): populated from /api/v1/media/{id}/playback-info. */
export interface SkipMarkers {
  skip_intro_start: number | null;
  skip_intro_end: number | null;
  skip_outro_start: number | null;
  skip_outro_end: number | null;
}

export interface PlaybackSession {
  id: string;
  user_id: string;
  media_item_id: string;
  server_id: string;
  client_name: string;
  device_id: string;
}
