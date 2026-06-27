// src/api/AdminManager.ts
import apiClient from './client';
import { Library } from '../types/media';
import type {
  AdminUser,
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
  ScanJob,
  CreateLibraryInput,
  UpdateLibraryInput,
  NowPlayingSession,
  TopUser,
  TopMedia,
  StorageStat,
  ActivityEntry,
  PlaybackStat,
} from '../types/admin';

/**
 * Admin API surface (slice E6a). Every route here is admin-gated on the server
 * (AdminMiddleware, `users.is_admin=1`); callers MUST gate on
 * `useAuthStore.user.is_admin` before invoking. The apiClient baseURL already
 * adds `/api/v1`, so paths start at `/admin/...` or `/libraries/...`.
 *
 * CRITICAL — envelopes are PER-CONTROLLER, NOT uniform:
 *   - `/admin/dashboard/*` → `{ success, data, count }`  (unwrap `.data`)
 *   - `/admin/stats/*`     → `{ data }`                  (unwrap `.data`, NO success/count)
 *   - `/admin/users*`      → BARE `{ users }` / `{ user }` / `{ message, ... }`
 *   - `/libraries*`        → BARE `{ libraries }` / `{ library }` / `{ message, ... }`
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 */

/** Dashboard envelope: success flag + a data array + its count. */
interface DashboardEnvelope<T> {
  success: boolean;
  data: T[];
  count: number;
}

/** Stats envelope: a data array only (no success/count). */
interface StatsEnvelope<T> {
  data: T[];
}

/** Result of `POST /admin/users` — server-assigned id + message. */
export interface CreateUserResult {
  user_id: string;
  message: string;
}

/** Result of `POST /admin/users/{id}/reset-password`. */
export interface ResetPasswordResult {
  message: string;
  new_password: string;
}

/** Result of `POST /libraries` — new library + the kicked-off scan job. */
export interface CreateLibraryResult {
  library_id: string;
  job_id: string;
  status: string;
  message: string;
}

/** Result of a scan/rescan/match-metadata trigger (202 Accepted). */
export interface JobTriggerResult {
  job_id: string;
  status: string;
  message: string;
}

class AdminManager {
  // ── Dashboard (`/admin/dashboard/*` → { success, data, count }) ──

  // GET /api/v1/admin/dashboard/now-playing → { success, data, count }
  async getNowPlaying(): Promise<NowPlayingSession[]> {
    const res = await apiClient.get<DashboardEnvelope<NowPlayingSession>>(
      '/admin/dashboard/now-playing'
    );
    return res.data;
  }

  // GET /api/v1/admin/dashboard/top-users?limit=&days= → { success, data, count }
  async getDashboardTopUsers(limit = 10, days = 30): Promise<TopUser[]> {
    const res = await apiClient.get<DashboardEnvelope<TopUser>>(
      '/admin/dashboard/top-users',
      { limit, days }
    );
    return res.data;
  }

  // GET /api/v1/admin/dashboard/top-media?limit=&days= → { success, data, count }
  async getDashboardTopMedia(limit = 10, days = 30): Promise<TopMedia[]> {
    const res = await apiClient.get<DashboardEnvelope<TopMedia>>(
      '/admin/dashboard/top-media',
      { limit, days }
    );
    return res.data;
  }

  // GET /api/v1/admin/dashboard/storage → { success, data, count }
  async getDashboardStorage(): Promise<StorageStat[]> {
    const res = await apiClient.get<DashboardEnvelope<StorageStat>>(
      '/admin/dashboard/storage'
    );
    return res.data;
  }

  // GET /api/v1/admin/dashboard/activity?limit= → { success, data, count }
  async getActivity(limit = 20): Promise<ActivityEntry[]> {
    const res = await apiClient.get<DashboardEnvelope<ActivityEntry>>(
      '/admin/dashboard/activity',
      { limit }
    );
    return res.data;
  }

  // ── Stats (`/admin/stats/*` → { data } — NO success/count) ──

  // GET /api/v1/admin/stats/playback?from=&to= → { data }
  async getPlaybackStats(from?: string, to?: string): Promise<PlaybackStat[]> {
    const res = await apiClient.get<StatsEnvelope<PlaybackStat>>(
      '/admin/stats/playback',
      { from, to }
    );
    return res.data;
  }

  // GET /api/v1/admin/stats/top-users?limit=&since= → { data }
  async getStatsTopUsers(limit?: number, since?: string): Promise<TopUser[]> {
    const res = await apiClient.get<StatsEnvelope<TopUser>>(
      '/admin/stats/top-users',
      { limit, since }
    );
    return res.data;
  }

  // GET /api/v1/admin/stats/top-media?limit=&since= → { data }
  async getStatsTopMedia(limit?: number, since?: string): Promise<TopMedia[]> {
    const res = await apiClient.get<StatsEnvelope<TopMedia>>(
      '/admin/stats/top-media',
      { limit, since }
    );
    return res.data;
  }

  // GET /api/v1/admin/stats/storage → { data }
  async getStatsStorage(): Promise<StorageStat[]> {
    const res = await apiClient.get<StatsEnvelope<StorageStat>>(
      '/admin/stats/storage'
    );
    return res.data;
  }

  // ── Users (`/admin/users*` → BARE envelopes) ──

  // GET /api/v1/admin/users?status= → { users }
  async getUsers(status?: UserStatus): Promise<AdminUser[]> {
    const res = await apiClient.get<{ users: AdminUser[] }>(
      '/admin/users',
      status ? { status } : undefined
    );
    return res.users;
  }

  // GET /api/v1/admin/users/{id} → { user }
  async getUser(id: string): Promise<AdminUser> {
    const res = await apiClient.get<{ user: AdminUser }>(`/admin/users/${id}`);
    return res.user;
  }

  // POST /api/v1/admin/users → { user_id, message } (201)
  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    return apiClient.post<CreateUserResult>('/admin/users', input);
  }

  // PUT /api/v1/admin/users/{id} → { message }
  async updateUser(id: string, input: UpdateUserInput): Promise<void> {
    await apiClient.put<{ message: string }>(`/admin/users/${id}`, input);
  }

  // DELETE /api/v1/admin/users/{id} → { message } (400 if self / last admin)
  async deleteUser(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/admin/users/${id}`);
  }

  // POST /api/v1/admin/users/{id}/set-admin → { message }
  async setUserAdmin(id: string, isAdmin: boolean): Promise<void> {
    await apiClient.post<{ message: string }>(`/admin/users/${id}/set-admin`, {
      is_admin: isAdmin,
    });
  }

  // POST /api/v1/admin/users/{id}/reset-password → { message, new_password }
  async resetPassword(id: string): Promise<ResetPasswordResult> {
    return apiClient.post<ResetPasswordResult>(
      `/admin/users/${id}/reset-password`
    );
  }

  // POST /api/v1/admin/users/{id}/approve → { message }
  async approveUser(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/admin/users/${id}/approve`);
  }

  // POST /api/v1/admin/users/{id}/disable → { message }
  async disableUser(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/admin/users/${id}/disable`);
  }

  // POST /api/v1/admin/users/{id}/reject → { message }
  async rejectUser(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/admin/users/${id}/reject`);
  }

  // ── Libraries (`/libraries*` → BARE envelopes; admin-gated internally) ──

  // GET /api/v1/libraries → { libraries }
  async getLibraries(): Promise<Library[]> {
    const res = await apiClient.get<{ libraries: Library[] }>('/libraries');
    return res.libraries;
  }

  // GET /api/v1/libraries/{id} → { library }
  async getLibrary(id: string): Promise<Library> {
    const res = await apiClient.get<{ library: Library }>(`/libraries/${id}`);
    return res.library;
  }

  // POST /api/v1/libraries → { library_id, job_id, status, message } (201)
  async createLibrary(input: CreateLibraryInput): Promise<CreateLibraryResult> {
    return apiClient.post<CreateLibraryResult>('/libraries', input);
  }

  // PUT /api/v1/libraries/{id} → { message }
  async updateLibrary(id: string, input: UpdateLibraryInput): Promise<void> {
    await apiClient.put<{ message: string }>(`/libraries/${id}`, input);
  }

  // DELETE /api/v1/libraries/{id} → { message }
  async deleteLibrary(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/libraries/${id}`);
  }

  // POST /api/v1/libraries/{id}/scan → { job_id, status, message } (202)
  async scanLibrary(id: string): Promise<JobTriggerResult> {
    return apiClient.post<JobTriggerResult>(`/libraries/${id}/scan`);
  }

  // POST /api/v1/libraries/{id}/rescan → { job_id, status, message } (202)
  async rescanLibrary(id: string): Promise<JobTriggerResult> {
    return apiClient.post<JobTriggerResult>(`/libraries/${id}/rescan`);
  }

  // POST /api/v1/libraries/{id}/match-metadata → { job_id, status, message } (202)
  async matchMetadata(id: string): Promise<JobTriggerResult> {
    return apiClient.post<JobTriggerResult>(`/libraries/${id}/match-metadata`);
  }

  // GET /api/v1/libraries/{id}/scan-status → { scan_status }
  async getScanStatus(id: string): Promise<ScanJob | null> {
    const res = await apiClient.get<{ scan_status: ScanJob | null }>(
      `/libraries/${id}/scan-status`
    );
    return res.scan_status;
  }

  // GET /api/v1/libraries/{id}/scan-history?limit= → { history }
  async getScanHistory(id: string, limit = 20): Promise<ScanJob[]> {
    const res = await apiClient.get<{ history: ScanJob[] }>(
      `/libraries/${id}/scan-history`,
      { limit }
    );
    return res.history;
  }
}

export const adminManager = new AdminManager();
export default adminManager;
