// src/types/admin.ts
//
// Admin domain types (slice E6a). Field names mirror the phlix-server admin
// payloads VERBATIM — snake_case, NO camelCase remapping. Booleans the server
// stores as MySQL TINYINT (0/1) are typed `boolean` here because the admin JSON
// encoder emits them as JSON booleans; callers should still treat them as
// truthy/falsy and not strictly `=== true`.

/** User account lifecycle status (server ENUM). */
export type UserStatus = 'pending' | 'active' | 'disabled';

/**
 * An admin-visible user row from `GET /admin/users` / `GET /admin/users/{id}`.
 * `display_name`, timestamps and `last_login` may be null on a fresh account.
 */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
  last_login: string | null;
}

/** Body for `POST /admin/users`. `is_admin` defaults to false server-side. */
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  is_admin?: boolean;
}

/** Body for `PUT /admin/users/{id}` — all fields optional (partial update). */
export interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
}

/** Scan/rescan/metadata job kind (server `library_jobs.job_type`). */
export type JobType = 'scan' | 'rescan' | 'metadata';

/** Library job lifecycle status. */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

/**
 * A library scan/rescan/metadata job row
 * (`GET /libraries/{id}/scan-status` / `.../scan-history`).
 */
export interface ScanJob {
  id: string;
  library_id: string;
  job_type: JobType;
  status: JobStatus;
  current_path?: string | null;
  progress_percent?: number | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
}

/** Body for `POST /libraries`. */
export interface CreateLibraryInput {
  name: string;
  type: string;
  paths: string[];
  options?: Record<string, unknown>;
  series_per_directory?: boolean;
}

/** Body for `PUT /libraries/{id}` — all fields optional (partial update). */
export interface UpdateLibraryInput {
  name?: string;
  type?: string;
  paths?: string[];
  options?: Record<string, unknown>;
  series_per_directory?: boolean;
}

// ── Dashboard row types (`/admin/dashboard/*` → { success, data, count }) ──

/** An active playback session from `GET /admin/dashboard/now-playing`. */
export interface NowPlayingSession {
  session_id?: string;
  user_id?: string;
  username?: string;
  media_item_id?: string;
  media_title?: string;
  device_name?: string;
  position_ticks?: number;
  duration_ticks?: number;
  progress_percent?: number;
  state?: string;
  started_at?: string;
  [key: string]: unknown;
}

/** A top user row from `/admin/dashboard/top-users` or `/admin/stats/top-users`. */
export interface TopUser {
  user_id?: string;
  username?: string;
  display_name?: string | null;
  play_count?: number;
  total_duration?: number;
  [key: string]: unknown;
}

/** A top media row from `/admin/dashboard/top-media` or `/admin/stats/top-media`. */
export interface TopMedia {
  media_item_id?: string;
  title?: string;
  name?: string;
  type?: string;
  play_count?: number;
  poster_url?: string;
  [key: string]: unknown;
}

/** A storage summary row from `/admin/dashboard/storage` or `/admin/stats/storage`. */
export interface StorageStat {
  library_id?: string;
  library_name?: string;
  item_count?: number;
  total_size?: number;
  [key: string]: unknown;
}

/** A recent-activity entry from `GET /admin/dashboard/activity`. */
export interface ActivityEntry {
  id?: string;
  user_id?: string;
  username?: string;
  action?: string;
  media_item_id?: string;
  media_title?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** A playback-stats row from `GET /admin/stats/playback`. */
export interface PlaybackStat {
  date?: string;
  play_count?: number;
  unique_users?: number;
  total_duration?: number;
  [key: string]: unknown;
}

// ── Plugins (E10c) — `PluginAdminController` + `PluginCatalogController` ──
//
// Envelopes are BARE `{plugins}` / `{plugin}` / `{sources}` etc (NOT the
// `{success,data}` shape). Settings VALUES are free-form per-plugin → typed
// `unknown` (callers coerce by the declared schema `type`).

/** An installed-plugin row from `GET /admin/plugins`. */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  type: string;
  entry?: string;
  enabled: boolean;
  installed_at?: string | null;
  signed?: boolean;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * One field's declaration in a plugin's `settings_schema`. `type` is the field
 * kind the form renders (string/number/bool/…); `secret` masks the input.
 */
export interface PluginSettingSchema {
  type: string;
  required?: boolean;
  secret?: boolean;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

/** Full plugin detail from `GET /admin/plugins/{name}` (adds the settings schema). */
export interface PluginDetail {
  name: string;
  version: string;
  type: string;
  enabled: boolean;
  installed_at?: string | null;
  settings_schema?: Record<string, PluginSettingSchema>;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A plugin entry inside a catalog (`catalogs[].plugins[]`). */
export interface CatalogPlugin {
  name: string;
  version: string;
  installed: boolean;
  enabled: boolean;
  [key: string]: unknown;
}

/** One catalog source's resolved listing. */
export interface PluginCatalog {
  source: string;
  name: string;
  plugins: CatalogPlugin[];
}

/** A per-source fetch error from `GET /admin/plugins/catalog`. */
export interface CatalogError {
  source: string;
  error: string;
}

/** Whole `GET /admin/plugins/catalog` payload. */
export interface CatalogResponse {
  default_source: string;
  sources: string[];
  catalogs: PluginCatalog[];
  errors: CatalogError[];
}

// ── Auth providers (E10c) — `AuthProviderController` ──

/** A provider row from `GET /admin/auth-providers`. */
export interface AuthProvider {
  name: string;
  supports_authentication: boolean;
  [key: string]: unknown;
}

/**
 * The JSON-schema describing a provider's config, from
 * `GET /admin/auth-providers/{name}/config-schema`. Free-form JSON-schema →
 * `unknown`-valued map (there is NO config WRITE route — schema is read-only).
 */
export type AuthProviderConfigSchema = Record<string, unknown>;

// ── Server settings (E10c) — `AdminSettingsController` ──
//
// ENVELOPED `{success, data:{...}}` on the wire → the manager unwraps `.data`
// into this shape. Setting VALUES are free-form → `unknown`.

/** Unwrapped `GET|PUT /admin/settings` payload. */
export interface ServerSettings {
  settings: Record<string, unknown>;
  overridden: string[];
  types: Record<string, string>;
}
