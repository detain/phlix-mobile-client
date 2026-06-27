// src/screens/admin/adminScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the admin Users + Libraries
// screens (slice E6b) so the screen-only logic is unit-testable without
// rendering React Native. Everything here is deterministic; no I/O, no timers.

import type { AdminUser, UserStatus, ScanJob, JobStatus } from '../../types/admin';

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
