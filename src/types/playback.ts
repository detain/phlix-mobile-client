// src/types/playback.ts
export interface StreamInfo {
  url: string;
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

export interface DeviceProfile {
  name: string;
  platform: 'ios' | 'android';
  version: string;
  capabilities: {
    video_codecs: string[];
    audio_codecs: string[];
    max_resolution: number;
    max_bitrate: number;
    supports_4k: boolean;
    supports_hdr: boolean;
    supports_dolby_vision: boolean;
    supports_dolby_atmos: boolean;
    supports_dts: boolean;
  };
}

/** Skip marker boundaries returned from /api/v1/media/{id}/playback */
export interface SkipMarkers {
  skip_intro_start: number | null;
  skip_intro_end: number | null;
  skip_outro_start: number | null;
  skip_outro_end: number | null;
}

export interface PlaybackInfo {
  media_source: MediaSource;
  play_session_id: string;
  stream_info: StreamInfo;
  subtitle_tracks: SubtitleTrack[];
  audio_tracks: AudioTrack[];
  markers?: SkipMarkers;
}

export interface MediaSource {
  id: string;
  protocol: 'hls' | 'http';
  container: string;
  size: number;
  bitrate: number;
}

export interface PlaybackProgress {
  position_ticks: number;
  duration_ticks: number;
  is_paused: boolean;
  volume_level: number;
}

export interface PlaybackSession {
  id: string;
  user_id: string;
  media_item_id: string;
  server_id: string;
  client_name: string;
  device_id: string;
}
