/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/focusRefetchGate.ts
//
// M-MOBILE-17 (review mobile__gameux M-F): screens fetched once per mount and
// never again, so a show started on TV left Home/Continue-Watching/Library
// stale until a manual pull. The cure is a focus-triggered refetch — but plain
// refetch-on-focus stampedes the server when the user hops tabs twice in a
// row. This gate is the stampede guard as PURE logic (no React, no
// navigation): given a monotonic clock value per focus event it decides
// whether a refetch is due. `useFocusRefetch` is the thin adapter.

/** Default staleness window: a focus younger than this reuses loaded data. */
export const DEFAULT_MIN_INTERVAL_MS = 15_000;

export interface FocusRefetchGate {
  /**
   * Report a focus event at `nowMs` (epoch ms from the CALLER — the gate owns
   * no clock). The first call represents the mount-focus, which the screen's
   * existing load-on-mount effect already serves, so it never refetches.
   * A returned `true` re-arms the window from `nowMs`; a `false` leaves it
   * growing, so the next focus fires once the interval has elapsed. Screens
   * whose loader then self-skips (store reentrancy guards, permission gates)
   * cost one staleness window — self-correcting, never stampeding.
   */
  onFocus(nowMs: number): boolean;
  /**
   * Report that the data the screen holds just became invalid WITHOUT any
   * navigation (M-MOBILE-18: the hub server switched and the caches were
   * reset under it). `true` = refetch NOW — invalidation is the one event
   * that outranks the staleness window (the window exists to skip work on
   * data that is still good, not to defend stale data for 15 seconds); the
   * stamp re-arms so the next focus does not fire the same refresh twice.
   * Before the mount-focus was ever seen it answers `false` — the screen's
   * own load-on-mount effect is still ahead and will fetch fresh truth.
   */
  onInvalidate(nowMs: number): boolean;
}

export function createFocusRefetchGate(
  minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS
): FocusRefetchGate {
  if (
    typeof minIntervalMs !== 'number' ||
    Number.isNaN(minIntervalMs) ||
    minIntervalMs < 0
  ) {
    throw new RangeError(
      `focusRefetchGate: minIntervalMs must be >= 0, got ${String(minIntervalMs)}`
    );
  }
  let mounted = false;
  let lastLoadMs = 0;
  return {
    onFocus(nowMs: number): boolean {
      if (!mounted) {
        mounted = true;
        lastLoadMs = nowMs;
        return false;
      }
      if (nowMs - lastLoadMs < minIntervalMs) {
        return false;
      }
      lastLoadMs = nowMs;
      return true;
    },
    onInvalidate(nowMs: number): boolean {
      if (!mounted) {
        // Mount-load owns the first fetch — it will run against the new
        // server anyway; a second immediate load would be a stampede.
        return false;
      }
      lastLoadMs = nowMs;
      return true;
    },
  };
}
