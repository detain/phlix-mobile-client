/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/ParentalControlsManager.ts
import apiClient from './client';
import type { AccessSchedule, DayOfWeek, ProfileTag, ProfileStreamLimit } from '../types/parental';

/**
 * User-facing parental controls API.
 *
 * All routes live under `/api/v1/profiles/{profileId}/` and are scoped to
 * the authenticated user's profile. These are NOT admin routes.
 *
 * Endpoints:
 *   GET/POST/DELETE /api/v1/profiles/{id}/schedules   — access schedules
 *   GET/POST/DELETE /api/v1/profiles/{id}/tags        — tag blocking
 *   GET/PUT         /api/v1/profiles/{id}/stream-limits — concurrent stream limit
 */
class ParentalControlsManager {
  // ── Schedules ─────────────────────────────────────────────────────────────

  /**
   * Fetch all access schedules for a profile.
   * GET /api/v1/profiles/{profileId}/schedules → { schedules: AccessSchedule[] }
   */
  async getSchedules(profileId: number): Promise<AccessSchedule[]> {
    const res = await apiClient.get<{ schedules: AccessSchedule[] }>(
      `/profiles/${profileId}/schedules`
    );
    return res.schedules ?? [];
  }

  /**
   * Create a new access schedule.
   * POST /api/v1/profiles/{profileId}/schedules → AccessSchedule
   */
  async createSchedule(
    profileId: number,
    input: {
      name: string;
      startTime: string;
      endTime: string;
      daysOfWeek: DayOfWeek[];
      isActive: boolean;
    }
  ): Promise<AccessSchedule> {
    return apiClient.post<AccessSchedule>(`/profiles/${profileId}/schedules`, input);
  }

  /**
   * Update an existing access schedule.
   * POST /api/v1/profiles/{profileId}/schedules (with id) → AccessSchedule
   */
  async updateSchedule(
    profileId: number,
    input: {
      id: number;
      name: string;
      startTime: string;
      endTime: string;
      daysOfWeek: DayOfWeek[];
      isActive: boolean;
    }
  ): Promise<AccessSchedule> {
    return apiClient.post<AccessSchedule>(`/profiles/${profileId}/schedules`, input);
  }

  /**
   * Delete an access schedule.
   * DELETE /api/v1/profiles/{profileId}/schedules/{scheduleId} → { message: string }
   */
  async deleteSchedule(profileId: number, scheduleId: number): Promise<void> {
    await apiClient.delete(`/profiles/${profileId}/schedules/${scheduleId}`);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  /**
   * Fetch all tags for a profile.
   * GET /api/v1/profiles/{profileId}/tags → { tags: ProfileTag[] }
   */
  async getTags(profileId: number): Promise<ProfileTag[]> {
    const res = await apiClient.get<{ tags: ProfileTag[] }>(
      `/profiles/${profileId}/tags`
    );
    return res.tags ?? [];
  }

  /**
   * Add a new blocked tag.
   * POST /api/v1/profiles/{profileId}/tags → ProfileTag
   */
  async addTag(
    profileId: number,
    input: { tag: string; tagType: 'blocked' | 'allowed' }
  ): Promise<ProfileTag> {
    return apiClient.post<ProfileTag>(`/profiles/${profileId}/tags`, input);
  }

  /**
   * Remove a tag.
   * DELETE /api/v1/profiles/{profileId}/tags/{tagId} → { message: string }
   */
  async removeTag(profileId: number, tagId: number): Promise<void> {
    await apiClient.delete(`/profiles/${profileId}/tags/${tagId}`);
  }

  // ── Stream Limits ────────────────────────────────────────────────────────

  /**
   * Fetch stream limit settings for a profile.
   * GET /api/v1/profiles/{profileId}/stream-limits → ProfileStreamLimit
   */
  async getStreamLimit(profileId: number): Promise<ProfileStreamLimit> {
    return apiClient.get<ProfileStreamLimit>(
      `/profiles/${profileId}/stream-limits`
    );
  }

  /**
   * Update stream limit settings.
   * PUT /api/v1/profiles/{profileId}/stream-limits → ProfileStreamLimit
   */
  async updateStreamLimit(
    profileId: number,
    input: { maxConcurrentStreams: number; maxTotalBandwidthKbps: number | null }
  ): Promise<ProfileStreamLimit> {
    return apiClient.put<ProfileStreamLimit>(
      `/profiles/${profileId}/stream-limits`,
      input
    );
  }
}

export const parentalControlsManager = new ParentalControlsManager();
export default parentalControlsManager;