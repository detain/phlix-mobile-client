/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/api/UserManager.ts
import apiClient from './client';
import { MediaItem } from '../types/media';

/**
 * Server-synced user settings (`GET/PUT /api/v1/users/me/settings`).
 * Field names are the server's whitelist verbatim. All optional — older servers
 * or a fresh account may omit any of them.
 */
export interface UserSettings {
  max_streams?: number;
  max_bitrate?: number;
  preferred_audio_language?: string;
  preferred_subtitle_language?: string;
  subtitle_mode?: string;
  default_content_rating?: string;
  transcoding_preferences?: Record<string, unknown>;
  theme?: string;
}

class UserManager {
  // GET /api/v1/users/me/settings → { settings }
  async getSettings(): Promise<UserSettings> {
    const res = await apiClient.get<{ settings: UserSettings }>('/users/me/settings');
    return res.settings;
  }

  // PUT /api/v1/users/me/settings → { message }
  async updateSettings(partial: Partial<UserSettings>): Promise<void> {
    await apiClient.put<{ message: string }>('/users/me/settings', partial);
  }

  // GET /api/v1/users/me/continue-watching → { items }
  async getContinueWatching(): Promise<MediaItem[]> {
    const res = await apiClient.get<{ items: MediaItem[] }>('/users/me/continue-watching');
    return res.items;
  }

  // GET /api/v1/users/me/recently-watched → { items }
  async getRecentlyWatched(): Promise<MediaItem[]> {
    const res = await apiClient.get<{ items: MediaItem[] }>('/users/me/recently-watched');
    return res.items;
  }

  // DELETE /api/v1/users/me/history/{mediaItemId} → { message }
  async deleteHistoryItem(mediaItemId: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/users/me/history/${mediaItemId}`);
  }

  // DELETE /api/v1/users/me/history → { message }
  async clearHistory(): Promise<void> {
    await apiClient.delete<{ message: string }>('/users/me/history');
  }
}

export const userManager = new UserManager();
export default userManager;
