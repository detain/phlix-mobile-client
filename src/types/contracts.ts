/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/contracts.ts
/**
 * Safe, non-divergent re-exports from `@phlix/contracts`.
 *
 * This module is the single clean import point the codebase will adopt in E2
 * (the API-correctness slice). It deliberately re-exports ONLY the contracts
 * surface that does NOT conflict with mobile's current local types:
 *
 *   - REST envelopes (`MediaItemsResponse`, `MediaItemResponse`)
 *   - Phlix HTTP header constants + the `buildPhlixHeaders` helper + `DeviceType`
 *   - tick math helpers (`ticksToSeconds`, `ticksToMinutes`, `formatRuntime`)
 *
 * IMPORTANT — what is intentionally NOT re-exported here:
 *   - `MediaItem` / `MediaType` from contracts use `audio | image`, whereas
 *     mobile's `src/types/media.ts` uses `music | photo`. Re-exporting those
 *     would break every `=== 'music'` / `=== 'photo'` comparison in the app.
 *     The full `MediaType` / `MediaItem` consolidation is deferred to E2, where
 *     it is done together with the API/envelope rewrite (and verified against a
 *     live server). See the E1 worklog + Phase E plan.
 *
 * Adding this file in E1 also proves both shared packages resolve and compile
 * inside the React Native bundle, without yet rewiring the API client (E2).
 */

// REST response envelopes — safe (additive, no enum divergence).
export type {
  MediaItemsResponse,
  MediaItemResponse,
} from '@phlix/contracts';

// Device/auth headers — safe; mobile has no competing local declarations.
export {
  X_PHLIX_DEVICE_ID,
  X_PHLIX_DEVICE_NAME,
  X_PHLIX_DEVICE_TYPE,
  X_PHLIX_SESSION_ID,
  buildPhlixHeaders,
} from '@phlix/contracts';
export type { DeviceType, BuildPhlixHeadersOptions } from '@phlix/contracts';

// Tick helpers — behavior-identical to mobile's hand-rolled tick math
// (`formatRuntime` matches `src/utils/formatters.ts` exactly).
export {
  TICKS_PER_SECOND,
  TICKS_PER_MINUTE,
  ticksToSeconds,
  ticksToMinutes,
  formatRuntime,
} from '@phlix/contracts';

/**
 * User recommendation item from /me/recommendations endpoint.
 * Score is a 0-1 value representing relevance/confidence.
 */
export interface UserRecommendation {
  id: string;
  score: number;
  posterUrl?: string;
  title?: string;
  year?: number;
  overview?: string;
}
