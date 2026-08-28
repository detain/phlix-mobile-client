/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/parental.ts
/**
 * Parental control types aligned with @phlix/contracts v0.4.4.
 * These types mirror the server-side DTOs for access schedules,
 * profile tags, and stream limits.
 *
 * S234: the wire keys are the server's snake_case emission
 * (`start_time`/`end_time`/`days_of_week`/`is_active`, `tag_type`) and
 * `profileId` is the CHAR(36) UUID string — the previous camelCase
 * declarations (`tagType`, `startTime`, …) mirrored the client's own
 * broken create bodies and 400'd against the server.
 */

/** Days of the week used in access schedules. */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * A time window during which a profile's streaming access is active.
 * `days_of_week` is an array of day literals (e.g. `['mon','wed','fri']`).
 * `start_time` / `end_time` are "HH:MM:SS" in 24-hour local server time.
 */
export interface AccessSchedule {
  id: number;
  /** CHAR(36) UUID — `user_profiles.id` on the server. */
  profileId: string;
  name: string;
  /** Start of the window in "HH:MM:SS" (24-hour). */
  start_time: string;
  /** End of the window in "HH:MM:SS" (24-hour). */
  end_time: string;
  /** Ordered list of days this window applies. Empty = never active. */
  days_of_week: DayOfWeek[];
  /** Whether this schedule is currently enabled. */
  is_active: boolean;
}

/**
 * A label applied to a profile, typed as either a block or allow rule.
 * `tag` is an arbitrary string identifier (case-sensitive).
 */
export interface ProfileTag {
  id: number;
  /** CHAR(36) UUID — `user_profiles.id` on the server. */
  profileId: string;
  /** Arbitrary tag string, e.g. "kids" or "restricted". */
  tag: string;
  /** Controls whether this tag blocks or allows matching content. */
  tag_type: 'blocked' | 'allowed';
}

/**
 * Stream concurrency and bandwidth limits for a profile.
 * `maxTotalBandwidthKbps` is `null` when no bandwidth cap is enforced.
 */
export interface ProfileStreamLimit {
  /** CHAR(36) UUID — `user_profiles.id` on the server. */
  profileId: string;
  /** Maximum concurrent streams allowed for this profile. */
  maxConcurrentStreams: number;
  /** Cap on total bandwidth in kbps, or `null` for unlimited. */
  maxTotalBandwidthKbps: number | null;
}