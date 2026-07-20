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
 *   - `MediaItem` from contracts still differs from mobile's local shape, so it
 *     stays local pending the API/envelope rewrite.
 *
 * RESOLVED — `MediaType` consolidation is done. This previously read that
 * `MediaType` could not be re-exported because contracts used `audio | image`
 * where mobile used `music | photo`, so re-exporting would break every
 * `=== 'music'` / `=== 'photo'` comparison. That was a symptom of contracts
 * itself being wrong: its union had drifted to a stale six members and carried
 * a bogus `image` the server never emits. Contracts now declares the full
 * 13-member `media_items.type` ENUM — a superset of what mobile hand-rolled —
 * so `music`/`photo` comparisons compile against it directly. `MediaType` is
 * re-exported from `src/types/media.ts`; import it from there.
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
