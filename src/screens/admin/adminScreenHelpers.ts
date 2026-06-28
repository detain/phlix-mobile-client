// src/screens/admin/adminScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the admin Users + Libraries
// screens (slice E6b) so the screen-only logic is unit-testable without
// rendering React Native. Everything here is deterministic; no I/O, no timers.

import type {
  AdminUser,
  UserStatus,
  ScanJob,
  JobStatus,
  PluginSettingSchema,
} from '../../types/admin';

/** The user-status filter the AdminUsers screen exposes ("all" = no filter). */
export type UserStatusFilter = 'all' | UserStatus;

/** The ordered set of filter chips rendered above the user list. */
export const USER_STATUS_FILTERS: UserStatusFilter[] = [
  'all',
  'pending',
  'active',
  'disabled',
];

/**
 * Filter a user list by the selected status chip. `'all'` returns the list
 * unchanged. Comparison is on the server `status` field verbatim.
 */
export const filterUsersByStatus = (
  users: AdminUser[],
  filter: UserStatusFilter
): AdminUser[] => {
  if (filter === 'all') {
    return users;
  }
  return users.filter((u) => u.status === filter);
};

/**
 * Parse the free-text "paths" field of the create/edit library modal into a
 * clean string[]. Accepts comma- AND/OR newline-separated input, trims each
 * entry, and drops blanks/duplicates (preserving first-seen order).
 */
export const parsePathsInput = (raw: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const path = part.trim();
    if (path.length === 0) {
      continue;
    }
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    out.push(path);
  }
  return out;
};

/** Render a string[] of paths back into the multiline editor value. */
export const pathsToInput = (paths: string[] | undefined): string =>
  (paths ?? []).join('\n');

/**
 * Poll predicate: a scan/rescan/metadata job is "active" (and therefore the
 * status poll should keep running) only while it is queued or running. A
 * `null` job (no job on record) is NOT active. `completed`/`failed` are
 * terminal — the caller must stop + clear its interval when this returns false.
 */
export const isJobActive = (
  status: JobStatus | null | undefined
): status is 'queued' | 'running' =>
  status === 'queued' || status === 'running';

/** Convenience: derive activeness directly from a (possibly null) ScanJob. */
export const isScanJobActive = (job: ScanJob | null | undefined): boolean =>
  isJobActive(job?.status);

/**
 * Short human badge for a scan job, e.g. "Scanning… 42%" / "Completed" /
 * "Failed". Tolerates missing progress. Returns null when there is no job.
 */
export const scanJobBadge = (job: ScanJob | null | undefined): string | null => {
  if (!job) {
    return null;
  }
  const pct =
    typeof job.progress_percent === 'number'
      ? ` ${Math.round(job.progress_percent)}%`
      : '';
  switch (job.status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return `${verbForJobType(job.job_type)}…${pct}`;
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return job.status;
  }
};

/** Present-progressive verb for a job kind, used in the running badge. */
export const verbForJobType = (jobType: ScanJob['job_type']): string => {
  switch (jobType) {
    case 'scan':
      return 'Scanning';
    case 'rescan':
      return 'Rescanning';
    case 'metadata':
      return 'Matching';
    default:
      return 'Working';
  }
};

/** Library `type` values the create/edit picker offers (server ENUM). */
export const LIBRARY_TYPES = [
  'movie',
  'series',
  'music',
  'photo',
  'book',
  'video',
] as const;

export type LibraryType = (typeof LIBRARY_TYPES)[number];

/** Whether the `series_per_directory` toggle applies to a chosen type. */
export const supportsSeriesPerDirectory = (type: string): boolean =>
  type === 'series';

// ── Plugins / Auth-providers / Server-settings helpers (E10c) ──

/** The normalized kind of a setting/schema field input the form renders. */
export type SettingFieldKind = 'bool' | 'number' | 'string';

/**
 * A single form field derived from a plugin's `settings_schema`, flattened to
 * what the editor needs: its key, the kind of control, whether it is required /
 * secret, a human label (falls back to the key) and an optional description.
 */
export interface PluginSettingField {
  key: string;
  kind: SettingFieldKind;
  required: boolean;
  secret: boolean;
  label: string;
  description?: string;
}

/**
 * Normalize a raw schema `type` string to one of the three input kinds the form
 * supports. `bool`/`boolean` → bool; numeric kinds → number; everything else
 * (incl. unknown) falls back to a plain string input.
 */
export const settingKindForType = (type: string | undefined): SettingFieldKind => {
  switch ((type ?? '').toLowerCase()) {
    case 'bool':
    case 'boolean':
      return 'bool';
    case 'number':
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
      return 'number';
    default:
      return 'string';
  }
};

/** Whether a schema field is a secret (masked) input. */
export const isSecretField = (schema: PluginSettingSchema | undefined): boolean =>
  !!schema?.secret;

/**
 * Flatten a plugin `settings_schema` map into an ORDERED field list for the
 * settings form. Object-key insertion order is preserved. An undefined/empty
 * schema yields an empty list (the screen shows "no configurable settings").
 */
export const pluginSettingFields = (
  schema: Record<string, PluginSettingSchema> | undefined
): PluginSettingField[] => {
  if (!schema) {
    return [];
  }
  return Object.keys(schema).map((key) => {
    const field = schema[key];
    return {
      key,
      kind: settingKindForType(field?.type),
      required: !!field?.required,
      secret: !!field?.secret,
      label: field?.label && field.label.trim() !== '' ? field.label : key,
      description: field?.description,
    };
  });
};

/**
 * Validate a plugin install URL. The server accepts ONLY `https://` or
 * `file://` schemes. Returns null when valid, else a human error string.
 */
export const validatePluginUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return 'A URL is required.';
  }
  if (!/^https:\/\//i.test(trimmed) && !/^file:\/\//i.test(trimmed)) {
    return 'URL must start with https:// or file://';
  }
  return null;
};

/**
 * The server-settings field kind for a given key, read off the `types` map.
 * Unknown keys (no type entry) render as a plain string input.
 */
export const settingFieldType = (
  types: Record<string, string> | undefined,
  key: string
): SettingFieldKind => settingKindForType(types?.[key]);

/**
 * Coerce a raw text-input string back into the typed value the server expects
 * for a given field kind. `bool` is handled by the Switch (not this fn) — it is
 * included for completeness and accepts "true"/"1"/"yes". `number` parses a
 * finite number (falls back to the original string when unparseable so the
 * server can validate + reject rather than silently dropping). `string` passes
 * through verbatim.
 */
export const coerceSettingValue = (
  kind: SettingFieldKind,
  raw: string
): unknown => {
  switch (kind) {
    case 'bool': {
      const v = raw.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    case 'number': {
      const n = Number(raw.trim());
      return Number.isFinite(n) && raw.trim() !== '' ? n : raw;
    }
    default:
      return raw;
  }
};

/**
 * Render a (possibly non-string) setting value into the text shown in an input.
 * Objects/arrays are JSON-stringified; null/undefined become an empty string;
 * booleans/numbers are stringified.
 */
export const settingValueToInput = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

/** Whether a server-settings key is currently overridden (env/config override). */
export const isOverridden = (
  overridden: string[] | undefined,
  key: string
): boolean => !!overridden?.includes(key);
