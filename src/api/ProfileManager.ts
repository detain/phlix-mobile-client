/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/api/ProfileManager.ts
import apiClient from './client';
import type {
  Profile,
  CreateProfileInput,
  UpdateProfileInput,
} from '../types/profile';

/**
 * Multi-user profile management (slice E5).
 *
 * All routes are ADMIN-gated on the server (AdminMiddleware, `users.is_admin=1`)
 * and live under `/api/v1/admin` — the apiClient baseURL already adds `/api/v1`,
 * so paths here start at `/admin/...`. There is no user-facing
 * `/users/me/profiles` route today; callers MUST gate on `is_admin`.
 *
 * Envelopes are BARE (no `{success,data}` wrapper); each method unwraps the
 * named key the server returns.
 */
class ProfileManager {
  // GET /api/v1/admin/users/{userId}/profiles → { profiles }
  async listProfiles(userId: string): Promise<Profile[]> {
    const res = await apiClient.get<{ profiles: Profile[] }>(
      `/admin/users/${userId}/profiles`
    );
    return res.profiles;
  }

  // GET /api/v1/admin/profiles/{id} → { profile }
  async getProfile(id: string): Promise<Profile> {
    const res = await apiClient.get<{ profile: Profile }>(`/admin/profiles/${id}`);
    return res.profile;
  }

  // POST /api/v1/admin/users/{userId}/profiles → { profile_id, message }
  async createProfile(userId: string, input: CreateProfileInput): Promise<string> {
    const res = await apiClient.post<{ profile_id: string; message: string }>(
      `/admin/users/${userId}/profiles`,
      input
    );
    return res.profile_id;
  }

  // PUT /api/v1/admin/profiles/{id} → { message }
  async updateProfile(id: string, input: UpdateProfileInput): Promise<void> {
    await apiClient.put<{ message: string }>(`/admin/profiles/${id}`, input);
  }

  // DELETE /api/v1/admin/profiles/{id} → { message }
  async deleteProfile(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/admin/profiles/${id}`);
  }

  // POST /api/v1/admin/profiles/{id}/pin → { message }
  async setPin(id: string, pin: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/admin/profiles/${id}/pin`, { pin });
  }

  // DELETE /api/v1/admin/profiles/{id}/pin → { message }
  async clearPin(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/admin/profiles/${id}/pin`);
  }
}

export const profileManager = new ProfileManager();
export default profileManager;
