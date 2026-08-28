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
 *
 * S234: every create/update body uses the server's snake_case wire keys
 * (`tag_type`, `start_time`, `end_time`, `days_of_week`, `is_active`) — the
 * previous camelCase bodies (`tagType`, `startTime`, …) 400'd against the
 * server. The server accepts the camelCase spellings additively for shipped
 * builds, but this client sends the canonical shape. `profileId` is the
 * CHAR(36) UUID string, not a number.
 */
/**
 * The server's list endpoints emit the profile reference as `profile_id`
 * (snake_case, per the DTO `toArray()`); the local types keep the historical
 * `profileId` name. These wire shapes exist so the GET read paths can map the
 * key honestly instead of typing a response the server never sends.
 */
type WireSchedule = Omit<AccessSchedule, 'profileId'> & { profile_id: string };
type WireTag = Omit<ProfileTag, 'profileId'> & { profile_id: string };

/**
 * Map a wire row (server `profile_id`) to the local `profileId` shape.
 */
const mapProfileId = <T extends { profile_id: string },>(
  row: T
): Omit<T, 'profile_id'> & { profileId: string } => {
  const { profile_id, ...rest } = row;
  return { ...rest, profileId: profile_id };
};

class ParentalControlsManager {
  // ── Schedules ─────────────────────────────────────────────────────────────

  /**
   * Fetch all access schedules for a profile.
   * GET /api/v1/profiles/{profileId}/schedules → { schedules: AccessSchedule[] }
   *
   * The server emits the profile reference as `profile_id` (snake_case, per
   * `AccessSchedule::toArray()`); the local type keeps the historical
   * `profileId` name, so the wire key is mapped here.
   */
  async getSchedules(profileId: string): Promise<AccessSchedule[]> {
    const res = await apiClient.get<{ schedules: WireSchedule[] }>(
      `/profiles/${profileId}/schedules`
    );
    return (res.schedules ?? []).map(mapProfileId);
  }

  /**
   * Create a new access schedule.
   * POST /api/v1/profiles/{profileId}/schedules → AccessSchedule
   */
  async createSchedule(
    profileId: string,
    input: {
      name: string;
      start_time: string;
      end_time: string;
      days_of_week: DayOfWeek[];
      is_active: boolean;
    }
  ): Promise<AccessSchedule> {
    return apiClient.post<AccessSchedule>(`/profiles/${profileId}/schedules`, input);
  }

  /**
   * Update an existing access schedule.
   * POST /api/v1/profiles/{profileId}/schedules (with id) → AccessSchedule
   */
  async updateSchedule(
    profileId: string,
    input: {
      id: number;
      name: string;
      start_time: string;
      end_time: string;
      days_of_week: DayOfWeek[];
      is_active: boolean;
    }
  ): Promise<AccessSchedule> {
    return apiClient.post<AccessSchedule>(`/profiles/${profileId}/schedules`, input);
  }

  /**
   * Delete an access schedule.
   * DELETE /api/v1/profiles/{profileId}/schedules/{scheduleId} → { message: string }
   */
  async deleteSchedule(profileId: string, scheduleId: number): Promise<void> {
    await apiClient.delete(`/profiles/${profileId}/schedules/${scheduleId}`);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  /**
   * Fetch all tags for a profile.
   * GET /api/v1/profiles/{profileId}/tags → { tags: ProfileTag[] }
   *
   * The server emits the profile reference as `profile_id` (snake_case, per
   * `ProfileTag::toArray()`); the local type keeps the historical `profileId`
   * name, so the wire key is mapped here.
   */
  async getTags(profileId: string): Promise<ProfileTag[]> {
    const res = await apiClient.get<{ tags: WireTag[] }>(
      `/profiles/${profileId}/tags`
    );
    return (res.tags ?? []).map(mapProfileId);
  }

  /**
   * Add a new blocked tag.
   * POST /api/v1/profiles/{profileId}/tags → ProfileTag
   */
  async addTag(
    profileId: string,
    input: { tag: string; tag_type: 'blocked' | 'allowed' }
  ): Promise<ProfileTag> {
    return apiClient.post<ProfileTag>(`/profiles/${profileId}/tags`, input);
  }

  /**
   * Remove a tag.
   * DELETE /api/v1/profiles/{profileId}/tags/{tagId} → { message: string }
   */
  async removeTag(profileId: string, tagId: number): Promise<void> {
    await apiClient.delete(`/profiles/${profileId}/tags/${tagId}`);
  }

  // ── Stream Limits ────────────────────────────────────────────────────────

  /**
   * Fetch stream limit settings for a profile.
   * GET /api/v1/profiles/{profileId}/stream-limits → ProfileStreamLimit
   */
  async getStreamLimit(profileId: string): Promise<ProfileStreamLimit> {
    return apiClient.get<ProfileStreamLimit>(
      `/profiles/${profileId}/stream-limits`
    );
  }

  /**
   * Update stream limit settings.
   * PUT /api/v1/profiles/{profileId}/stream-limits → ProfileStreamLimit
   */
  async updateStreamLimit(
    profileId: string,
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