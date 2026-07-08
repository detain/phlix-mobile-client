/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/api/MarkerManager.ts
import apiClient from './client';
import type { PlaybackInfo, Marker, Chapter } from '../types/playback';

/** Raw `GET /api/v1/media/{id}/markers` envelope (server: `{markers:[...]}`). */
interface RawMarker {
  type: string;
  start_seconds: number;
  end_seconds: number;
  title?: string;
}

export interface MarkersResponse {
  markers: RawMarker[];
}

class MarkerManager {
  /**
   * The ONE-call markers/chapters source for the player:
   * `GET /api/v1/media/{id}/playback-info`.
   * All positions are SECONDS. `intro_marker`/`outro_marker` are null when the
   * item has no detected intro/outro.
   */
  async getPlaybackInfo(itemId: string): Promise<PlaybackInfo> {
    return apiClient.get<PlaybackInfo>(`/media/${itemId}/playback-info`);
  }

  /**
   * Lower-level markers list → `GET /api/v1/media/{id}/markers` → `{markers:[...]}`.
   * Prefer `getPlaybackInfo` for player wiring; this is for callers that want the
   * raw typed list (e.g. chapter rendering).
   */
  async getMarkers(itemId: string): Promise<RawMarker[]> {
    const res = await apiClient.get<MarkersResponse>(`/media/${itemId}/markers`);
    return res.markers ?? [];
  }
}

/**
 * Pure helper: is `currentTime` (SECONDS) inside `marker`'s window?
 * Returns false for a null marker. Inclusive of both bounds.
 */
export const isWithinMarker = (
  currentTime: number,
  marker: Marker | Chapter | null,
): boolean => {
  if (!marker) {
    return false;
  }
  return currentTime >= marker.start_seconds && currentTime <= marker.end_seconds;
};

export const markerManager = new MarkerManager();
export default markerManager;
