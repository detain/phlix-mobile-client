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
  Plugin,
  PluginDetail,
  CatalogResponse,
  AuthProvider,
  AuthProviderConfigSchema,
  ServerSettings,
  Backup,
  BackupSchedule,
  UpdateBackupScheduleInput,
  LogFile,
  LogTail,
  FsListing,
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

/** Result of enabling/disabling an auth provider (E10c). */
export interface AuthProviderToggleResult {
  name: string;
  enabled: boolean;
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

  // ── Plugins (E10c — BARE { plugins } / { plugin } / { sources } …) ──

  // GET /api/v1/admin/plugins → { plugins }
  async getPlugins(): Promise<Plugin[]> {
    const res = await apiClient.get<{ plugins: Plugin[] }>('/admin/plugins');
    return res.plugins;
  }

  // GET /api/v1/admin/plugins/{name} → { plugin }
  async getPlugin(name: string): Promise<PluginDetail> {
    const res = await apiClient.get<{ plugin: PluginDetail }>(
      `/admin/plugins/${encodeURIComponent(name)}`
    );
    return res.plugin;
  }

  // POST /api/v1/admin/plugins/install body { url } → 201 { plugin }
  async installPlugin(url: string): Promise<PluginDetail> {
    const res = await apiClient.post<{ plugin: PluginDetail }>(
      '/admin/plugins/install',
      { url }
    );
    return res.plugin;
  }

  // PUT /api/v1/admin/plugins/{name}/settings body { settings } → { plugin }
  async updatePluginSettings(
    name: string,
    settings: Record<string, unknown>
  ): Promise<PluginDetail> {
    const res = await apiClient.put<{ plugin: PluginDetail }>(
      `/admin/plugins/${encodeURIComponent(name)}/settings`,
      { settings }
    );
    return res.plugin;
  }

  // POST /api/v1/admin/plugins/{name}/enable → { plugin }
  async enablePlugin(name: string): Promise<PluginDetail> {
    const res = await apiClient.post<{ plugin: PluginDetail }>(
      `/admin/plugins/${encodeURIComponent(name)}/enable`
    );
    return res.plugin;
  }

  // POST /api/v1/admin/plugins/{name}/disable → { plugin }
  async disablePlugin(name: string): Promise<PluginDetail> {
    const res = await apiClient.post<{ plugin: PluginDetail }>(
      `/admin/plugins/${encodeURIComponent(name)}/disable`
    );
    return res.plugin;
  }

  // DELETE /api/v1/admin/plugins/{name} → 204 (empty)
  async uninstallPlugin(name: string): Promise<void> {
    await apiClient.delete<void>(`/admin/plugins/${encodeURIComponent(name)}`);
  }

  // GET /api/v1/admin/plugins/catalog → whole { default_source, sources, catalogs, errors }
  async getPluginCatalog(): Promise<CatalogResponse> {
    return apiClient.get<CatalogResponse>('/admin/plugins/catalog');
  }

  // POST /api/v1/admin/plugins/catalog/sources body { url } → { sources }
  async addCatalogSource(url: string): Promise<string[]> {
    const res = await apiClient.post<{ sources: string[] }>(
      '/admin/plugins/catalog/sources',
      { url }
    );
    return res.sources;
  }

  // DELETE /api/v1/admin/plugins/catalog/sources body { url } → { sources }
  // DELETE-with-body: the documented axios form `delete(url, { data })`.
  async removeCatalogSource(url: string): Promise<string[]> {
    const res = await apiClient.delete<{ sources: string[] }>(
      '/admin/plugins/catalog/sources',
      { data: { url } }
    );
    return res.sources;
  }

  // ── Auth providers (E10c — BARE { providers } / { name,enabled,message } / { schema }) ──

  // GET /api/v1/admin/auth-providers → { providers }
  async getAuthProviders(): Promise<AuthProvider[]> {
    const res = await apiClient.get<{ providers: AuthProvider[] }>(
      '/admin/auth-providers'
    );
    return res.providers;
  }

  // POST /api/v1/admin/auth-providers/{name}/enable → { name, enabled, message }
  async enableAuthProvider(name: string): Promise<AuthProviderToggleResult> {
    return apiClient.post<AuthProviderToggleResult>(
      `/admin/auth-providers/${encodeURIComponent(name)}/enable`
    );
  }

  // POST /api/v1/admin/auth-providers/{name}/disable → { name, enabled, message }
  async disableAuthProvider(name: string): Promise<AuthProviderToggleResult> {
    return apiClient.post<AuthProviderToggleResult>(
      `/admin/auth-providers/${encodeURIComponent(name)}/disable`
    );
  }

  // GET /api/v1/admin/auth-providers/{name}/config-schema → { schema }
  async getAuthProviderConfigSchema(
    name: string
  ): Promise<AuthProviderConfigSchema> {
    const res = await apiClient.get<{ schema: AuthProviderConfigSchema }>(
      `/admin/auth-providers/${encodeURIComponent(name)}/config-schema`
    );
    return res.schema;
  }

  // ── Server settings (E10c — ENVELOPED { success, data } → unwrap .data) ──

  // GET /api/v1/admin/settings → { success, data:ServerSettings }
  async getServerSettings(): Promise<ServerSettings> {
    const res = await apiClient.get<{ success: boolean; data: ServerSettings }>(
      '/admin/settings'
    );
    return res.data;
  }

  // PUT /api/v1/admin/settings body { settings } → { success, data:ServerSettings }
  async updateServerSettings(
    settings: Record<string, unknown>
  ): Promise<ServerSettings> {
    const res = await apiClient.put<{ success: boolean; data: ServerSettings }>(
      '/admin/settings',
      { settings }
    );
    return res.data;
  }

  // ── Backup (E10d — ENVELOPED { success, data|message, count? }) ──

  // POST /api/v1/admin/backup/create body { label? } → { success, message, data }
  async createBackup(label?: string): Promise<Backup> {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: Backup;
    }>('/admin/backup/create', label !== undefined ? { label } : {});
    return res.data;
  }

  // GET /api/v1/admin/backup/list → { success, data:Backup[], count }
  async listBackups(): Promise<Backup[]> {
    const res = await apiClient.get<{
      success: boolean;
      data: Backup[];
      count: number;
    }>('/admin/backup/list');
    return res.data;
  }

  // DELETE /api/v1/admin/backup/{id} → { success, message } (404)
  async deleteBackup(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/admin/backup/${encodeURIComponent(id)}`
    );
  }

  // POST /api/v1/admin/backup/{id}/restore → { success, message } (500)
  async restoreBackup(id: string): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/admin/backup/${encodeURIComponent(id)}/restore`
    );
  }

  // POST /api/v1/admin/backup/{id}/upload-s3 → { success, message } (500)
  async uploadBackupS3(id: string): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/admin/backup/${encodeURIComponent(id)}/upload-s3`
    );
  }

  // GET /api/v1/admin/backup/schedule → { success, data:BackupSchedule }
  async getBackupSchedule(): Promise<BackupSchedule> {
    const res = await apiClient.get<{
      success: boolean;
      data: BackupSchedule;
    }>('/admin/backup/schedule');
    return res.data;
  }

  // PUT /api/v1/admin/backup/schedule body { ... } → { success, message, data }
  async updateBackupSchedule(
    input: UpdateBackupScheduleInput
  ): Promise<BackupSchedule> {
    const res = await apiClient.put<{
      success: boolean;
      message: string;
      data: BackupSchedule;
    }>('/admin/backup/schedule', input);
    return res.data;
  }

  // ── Logs (E10d — BARE envelopes) ──

  // GET /api/v1/admin/logs → { files }
  async getLogFiles(): Promise<LogFile[]> {
    const res = await apiClient.get<{ files: LogFile[] }>('/admin/logs');
    return res.files;
  }

  // GET /api/v1/admin/logs/tail?file=&lines= → { file, lines, truncated }
  async tailLog(file: string, lines?: number): Promise<LogTail> {
    return apiClient.get<LogTail>('/admin/logs/tail', {
      file,
      ...(lines !== undefined ? { lines } : {}),
    });
  }

  // GET /api/v1/admin/logs/tail-all?lines= → { files, lines, truncated }
  async tailAllLogs(lines?: number): Promise<LogTail> {
    return apiClient.get<LogTail>(
      '/admin/logs/tail-all',
      lines !== undefined ? { lines } : undefined
    );
  }

  // ── FS browse (E10d — ENVELOPED { success, data } → unwrap .data) ──

  // GET /api/v1/admin/fs/browse?path= (empty/absent → roots) → { success, data:FsListing }
  async browseFs(path?: string): Promise<FsListing> {
    const res = await apiClient.get<{ success: boolean; data: FsListing }>(
      '/admin/fs/browse',
      path !== undefined && path !== '' ? { path } : undefined
    );
    return res.data;
  }
}

export const adminManager = new AdminManager();
export default adminManager;
