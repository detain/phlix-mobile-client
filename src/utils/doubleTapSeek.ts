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
