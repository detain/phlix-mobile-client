/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/search/__tests__/searchRailTouchTargets.test.ts
//
// Touch-target law for the Search A–Z rail (review mobile__gameux M-H,
// campaign item M-MOBILE-19). Pre-cure every letter was a ~15pt-tall target
// (fontSize 11 + paddingVertical 1) in a 24pt-wide column — 27 of them
// shoulder-to-shoulder, roughly a third of the platform minimum, so a thumb
// mis-tap into a neighbouring letter was structurally guaranteed.
//
// The cure lives in `searchScreenHelpers.ts` as PURE GEOMETRY DATA (the
// screen imports the very objects pinned here, so these are StyleSheet-level
// assertions through the exported source of truth). The law is asserted
// against a literal here — NOT against the exported constant — so raising or
// lowering the constant can never self-satisfy the test.

import {
  RAIL_LETTERS,
  RAIL_TARGET_MIN_SIZE_PT,
  RAIL_BUTTON_LAYOUT,
  railLetterTouchRect,
} from '../searchScreenHelpers';

const PLATFORM_MIN_TOUCH_PT = 44;

describe('Search A–Z rail touch-target law (M-MOBILE-19)', () => {
  it('pins the rail minimum at the platform floor', () => {
    expect(RAIL_TARGET_MIN_SIZE_PT).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
  });

  it('gives every letter a >=44x44pt touch rect from layout alone', () => {
    // No hitSlop is involved by construction: 27 vertically stacked targets
    // sharing slop would make neighbour rects overlap, so the minimum must
    // come from the row's own laid-out size.
    const rect = railLetterTouchRect();
    expect(rect.width).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
    expect(rect.height).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
  });

  it('carries the minimum in the StyleSheet object the screen renders', () => {
    expect(RAIL_BUTTON_LAYOUT.minHeight).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
    expect(RAIL_BUTTON_LAYOUT.width).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
    expect(RAIL_BUTTON_LAYOUT.alignItems).toBe('center');
    expect(RAIL_BUTTON_LAYOUT.justifyContent).toBe('center');
    // The old defect shape must not creep back in as padding-only sizing.
    expect(Object.keys(RAIL_BUTTON_LAYOUT)).not.toContain('paddingVertical');
  });

  it('stacks the full alphabet without overlap at the minimum row height', () => {
    // Row pitch == laid-out height == the touch rect height, so adjacent
    // letters never claim the same point.
    expect(RAIL_BUTTON_LAYOUT.minHeight).toBe(RAIL_TARGET_MIN_SIZE_PT);
    // Column height is emergent layout (27 stacked rows of the touch-rect
    // height); pin the arithmetic the design depends on through the seam.
    expect(RAIL_LETTERS.length * railLetterTouchRect().height).toBe(
      RAIL_LETTERS.length * RAIL_TARGET_MIN_SIZE_PT
    );
  });

  it('exceeds the smallest supported rail viewport — the rail must scroll', () => {
    // 27 entries x 44pt = 1188pt, far beyond a 320pt-tall results area; the
    // rail is therefore required to live inside a ScrollView with the rest
    // reachable by flick. Literal total (1188), so raising the constant or
    // the letter count cannot self-satisfy the scroll premise.
    expect(RAIL_LETTERS.length * railLetterTouchRect().height).toBe(1188);
    expect(RAIL_LETTERS.length * railLetterTouchRect().height).toBeGreaterThan(320);
    expect(RAIL_LETTERS).toHaveLength(27);
  });
});
