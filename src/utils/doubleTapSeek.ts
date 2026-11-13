/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/doubleTapSeek.ts
//
// MOB-S25 / MOB-43: double-tap the left/right edge of the player surface to
// seek -/+10s. Pure classifier so the gesture law is unit-testable without a
// renderer. Single-tap disambiguation: a tap in an EDGE zone is deferred by
// DOUBLE_TAP_WINDOW_MS (so a second tap can promote it to a seek instead of
// toggling the chrome); a tap in the CENTRE band toggles immediately. Chrome
// controls (SkipButton pill, ±15 buttons, top bar) are separate touchables
// layered above the surface, so they never reach this classifier.

export const DOUBLE_TAP_WINDOW_MS = 300;
export const DOUBLE_TAP_SEEK_SECONDS = 10;
/** Fraction of the surface width, per side, that counts as an edge zone. */
export const EDGE_ZONE_FRACTION = 0.3;

export type TapZone = 'left' | 'right' | 'center';

export type TapDecision =
  | { kind: 'toggle' }
  | { kind: 'defer' }
  | { kind: 'seek'; delta: number };

export function tapZone(x: number, width: number): TapZone {
  if (!(width > 0)) {
    return 'center';
  }
  const f = x / width;
  if (f <= EDGE_ZONE_FRACTION) {
    return 'left';
  }
  if (f >= 1 - EDGE_ZONE_FRACTION) {
    return 'right';
  }
  return 'center';
}

export interface LastTap {
  zone: TapZone;
  at: number;
}

/**
 * Decide what a tap means given the previous tap. `defer` = edge tap that
 * should become a chrome toggle only if no second tap lands in the window.
 */
export function classifyTap(
  x: number,
  width: number,
  now: number,
  last: LastTap | null,
): TapDecision {
  const zone = tapZone(x, width);
  if (zone === 'center') {
    return { kind: 'toggle' };
  }
  if (last && last.zone === zone && now - last.at <= DOUBLE_TAP_WINDOW_MS) {
    return {
      kind: 'seek',
      delta: zone === 'left' ? -DOUBLE_TAP_SEEK_SECONDS : DOUBLE_TAP_SEEK_SECONDS,
    };
  }
  return { kind: 'defer' };
}

export interface TapControllerDeps {
  /** Surface width at tap time. */
  getWidth: () => number;
  /** Chrome toggle (read lazily so a deferred toggle sees the latest closure). */
  onToggle: () => void;
  /** Relative seek in seconds (negative = back). */
  onSeek: (delta: number) => void;
  /**
   * MOB-S25: live / direct-URL streams have no seekable timeline, so edge
   * double-taps must not seek; every tap toggles the chrome immediately.
   */
  isLive: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface TapController {
  handleTap: (x: number | undefined) => void;
  dispose: () => void;
}

/**
 * The surface-tap state machine (last-tap memory + deferred-toggle timer),
 * factored out of PlayerScreen so the gesture/timer behaviour is testable
 * without a renderer.
 */
export function createTapController(deps: TapControllerDeps): TapController {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let last: LastTap | null = null;
  let timer: unknown = null;

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  return {
    handleTap(x) {
      const width = deps.getWidth();
      cancelTimer();
      if (deps.isLive()) {
        last = null;
        deps.onToggle();
        return;
      }
      // No coordinates (e.g. programmatic press) = centre tap.
      const px = x ?? width / 2;
      const at = now();
      const decision = classifyTap(px, width, at, last);
      if (decision.kind === 'seek') {
        last = null;
        deps.onSeek(decision.delta);
        return;
      }
      if (decision.kind === 'toggle') {
        last = null;
        deps.onToggle();
        return;
      }
      last = { zone: px < width / 2 ? 'left' : 'right', at };
      timer = setTimer(() => {
        timer = null;
        last = null;
        deps.onToggle();
      }, DOUBLE_TAP_WINDOW_MS);
    },
    dispose() {
      cancelTimer();
      last = null;
    },
  };
}
