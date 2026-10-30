/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/ProfileManager.ts
import apiClient from './client';
import type {
  Profile,
  CreateProfileInput,
  UpdateProfileInput,
} from '../types/profile';

/**
 * Multi-user profile management (slice E5, repointed by review M-MOBILE-07).
 *
 * All legs here use the server's SELF-SERVICE routes (registered under
 * `/api/v1/profiles...` behind plain `AuthMiddleware`): the caller manages
 * THEIR OWN profiles — a signed-in parent gets child profiles without holding
 * the server-admin hat. (This replaced the admin-scoped `/admin/users/{id}/profiles`
 * lane, which locked ordinary family accounts out of profile management; the
 * admin routes still exist server-side for administrative management of other
 * users and are NOT used by mobile.)
 *
 * The identity is the bearer token; no userId ever appears in a path.
 * Envelopes are BARE (no `{success,data}` wrapper); each method unwraps the
 * named key the server returns.
 *
 * Activation seam: the server also offers `POST /api/v1/profiles/{id}/switch`
 * (returns a fresh auth-response token pair scoped to the profile). Mobile
 * selection stays local (the store persists the chosen profile id) until that
 * token-scoping flow is deliberately adopted — switching mid-session without
 * consuming the returned credentials would desync identity, so mobile does
 * not call the route at all rather than call it half-way.
 */
class ProfileManager {
  // GET /api/v1/profiles → { profiles } (the caller's own)
  async listProfiles(): Promise<Profile[]> {
    const res = await apiClient.get<{ profiles: Profile[] }>('/profiles');
    return res.profiles;
  }

  // GET /api/v1/profiles/{profileId} → { profile }
  async getProfile(id: string): Promise<Profile> {
    const res = await apiClient.get<{ profile: Profile }>(`/profiles/${encodeURIComponent(id)}`);
    return res.profile;
  }

  // POST /api/v1/profiles → 201 { profile_id, message }
  async createProfile(input: CreateProfileInput): Promise<string> {
    const res = await apiClient.post<{ profile_id: string; message: string }>(
      '/profiles',
      input
    );
    return res.profile_id;
  }

  // PUT /api/v1/profiles/{profileId} → { message }
  // (the route REJECTS an `is_active` field — activation is switch-only)
  async updateProfile(id: string, input: UpdateProfileInput): Promise<void> {
    await apiClient.put<{ message: string }>(`/profiles/${encodeURIComponent(id)}`, input);
  }

  // DELETE /api/v1/profiles/{profileId} → { message }
  // (deleting your LAST profile is refused 409 `profile.last_profile`)
  async deleteProfile(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/profiles/${encodeURIComponent(id)}`);
  }

  // POST /api/v1/profiles/{profileId}/pin → { message } (4/6-digit numeric PIN)
  async setPin(id: string, pin: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/profiles/${encodeURIComponent(id)}/pin`, { pin });
  }

  // DELETE /api/v1/profiles/{profileId}/pin → { message }
  async clearPin(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/profiles/${encodeURIComponent(id)}/pin`);
  }
}

export const profileManager = new ProfileManager();
export default profileManager;
