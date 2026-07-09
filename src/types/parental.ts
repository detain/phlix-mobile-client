/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/parental.ts
/**
 * Parental control types aligned with @phlix/contracts v0.3.5.
 * These types mirror the server-side DTOs for access schedules,
 * profile tags, and stream limits.
 */

/** Days of the week used in access schedules. */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * A time window during which a profile's streaming access is active.
 * `daysOfWeek` is an array of day literals (e.g. `['mon','wed','fri']`).
 * `startTime` / `endTime` are "HH:MM:SS" in 24-hour local server time.
 */
export interface AccessSchedule {
  id: number;
  profileId: number;
  name: string;
  /** Start of the window in "HH:MM:SS" (24-hour). */
  startTime: string;
  /** End of the window in "HH:MM:SS" (24-hour). */
  endTime: string;
  /** Ordered list of days this window applies. Empty = never active. */
  daysOfWeek: DayOfWeek[];
  /** Whether this schedule is currently enabled. */
  isActive: boolean;
}

/**
 * A label applied to a profile, typed as either a block or allow rule.
 * `tag` is an arbitrary string identifier (case-sensitive).
 */
export interface ProfileTag {
  id: number;
  profileId: number;
  /** Arbitrary tag string, e.g. "kids" or "restricted". */
  tag: string;
  /** Controls whether this tag blocks or allows matching content. */
  tagType: 'blocked' | 'allowed';
}

/**
 * Stream concurrency and bandwidth limits for a profile.
 * `maxTotalBandwidthKbps` is `null` when no bandwidth cap is enforced.
 */
export interface ProfileStreamLimit {
  profileId: number;
  /** Maximum concurrent streams allowed for this profile. */
  maxConcurrentStreams: number;
  /** Cap on total bandwidth in kbps, or `null` for unlimited. */
  maxTotalBandwidthKbps: number | null;
}