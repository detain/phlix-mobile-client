/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/api/PlaybackManager.ts
import apiClient from './client';
import { setActiveSessionId } from './client';
import { libraryManager } from './LibraryManager';

// TODO(E3): transcode lifecycle + markers/skip + subtitles.
//   - POST /api/v1/media/{id}/transcode (X-Phlix-Device-Type header) → poll
//     GET /api/v1/transcode/{jobId}/status → /hls/{job}/master.m3u8.
//   - GET /api/v1/media/{id}/playback-info → markers/chapters.
//   - subtitle tracks → native player prop.
// None of the methods below call a non-existent route.

export interface CreateSessionParams {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
}

export interface ReportProgressParams {
  mediaItemId: string;
  positionTicks: number;
  durationTicks?: number;
  isPaused?: boolean;
}

class PlaybackManager {
  /**
   * Open a playback session → POST /api/v1/sessions → { session_id }.
   * Idempotent per device_id. Records the id for `X-Phlix-Session-ID`.
   */
  async createSession(params: CreateSessionParams): Promise<string> {
    const res = await apiClient.post<{ session_id: string }>('/sessions', {
      device_id: params.deviceId,
      device_name: params.deviceName,
      device_type: params.deviceType,
    });
    setActiveSessionId(res.session_id);
    return res.session_id;
  }

  /**
   * Report playback progress → POST /api/v1/sessions/{id}/progress → { message }.
   * `positionTicks` / `durationTicks` are 100ns TICKS (not seconds).
   */
  async reportProgress(sessionId: string, progress: ReportProgressParams): Promise<void> {
    await apiClient.post<{ message: string }>(`/sessions/${sessionId}/progress`, {
      media_item_id: progress.mediaItemId,
      position_ticks: progress.positionTicks,
      duration_ticks: progress.durationTicks,
      is_paused: progress.isPaused,
    });
  }

  /** End a playback session → DELETE /api/v1/sessions/{id} → { message }. */
  async endSession(sessionId: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/sessions/${sessionId}`);
    setActiveSessionId(null);
  }

  /**
   * Resolve the signed direct-play URL for an item. The server mints
   * `stream_url` on the media detail payload (`GET /api/v1/media/{id}`); the
   * native player consumes it directly (it carries its own HMAC signature, so no
   * Authorization header is needed). Replaces the non-existent
   * `POST /media/{id}/stream`.
   */
  async getStreamUrl(itemId: string): Promise<string | undefined> {
    const item = await libraryManager.getMediaItem(itemId);
    return item.stream_url;
  }
}

export const playbackManager = new PlaybackManager();
export default playbackManager;
