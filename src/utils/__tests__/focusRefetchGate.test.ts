/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/focusRefetchGate.test.ts
//
// M-MOBILE-17 (review mobile__gameux M-F): the stampede-guard half of
// cross-device liveness, as PURE clock logic. Law pinned here:
//   1. the FIRST focus (mount) never refetches — the screen's load-on-mount
//      effect already fired; refetching it again would double every cold
//      start (and every tab's first visit);
//   2. a re-focus within the staleness window returns false (fresh data is
//      reused, the server is not re-hit per tab hop);
//   3. past the window it returns true and re-arms;
//   4. a rejected focus does NOT re-arm (the window keeps growing until a
//      fetch is granted);
//   5. minIntervalMs = 0 degenerates to plain refetch-on-focus;
//   6. a nonsense interval fails fast at creation.

import {
  createFocusRefetchGate,
  DEFAULT_MIN_INTERVAL_MS,
} from '../focusRefetchGate';

describe('createFocusRefetchGate — mount law', () => {
  it('never refetches on the first (mount) focus', () => {
    const gate = createFocusRefetchGate(15_000);
    expect(gate.onFocus(1_000)).toBe(false);
  });

  it('defaults the window to the exported constant', () => {
    const gate = createFocusRefetchGate();
    expect(gate.onFocus(0)).toBe(false);
    expect(gate.onFocus(DEFAULT_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(gate.onFocus(DEFAULT_MIN_INTERVAL_MS)).toBe(true);
  });
});

describe('createFocusRefetchGate — staleness window', () => {
  it('reuses fresh data for a re-focus inside the window', () => {
    const gate = createFocusRefetchGate(15_000);
    gate.onFocus(0); // mount
    expect(gate.onFocus(14_999)).toBe(false); // tab-hop stampede guard
  });

  it('refetches once the window has elapsed and re-arms from that fetch', () => {
    const gate = createFocusRefetchGate(15_000);
    gate.onFocus(0); // mount
    expect(gate.onFocus(15_000)).toBe(true);
    expect(gate.onFocus(29_999)).toBe(false); // re-armed at 15_000
    expect(gate.onFocus(30_000)).toBe(true);
  });

  it('a skipped focus does not re-arm — the window keeps growing', () => {
    const gate = createFocusRefetchGate(15_000);
    gate.onFocus(0); // mount
    expect(gate.onFocus(5_000)).toBe(false); // skipped, no re-arm
    expect(gate.onFocus(10_000)).toBe(false); // still growing
    expect(gate.onFocus(15_000)).toBe(true); // 15s after MOUNT, not after the skip
  });

  it('interval 0 degenerates to plain refetch-on-every-focus', () => {
    const gate = createFocusRefetchGate(0);
    gate.onFocus(100); // mount (law 1 still holds)
    expect(gate.onFocus(101)).toBe(true);
    expect(gate.onFocus(102)).toBe(true);
    expect(gate.onFocus(102)).toBe(true);
  });
});

describe('createFocusRefetchGate — fail fast', () => {
  it('rejects a negative interval', () => {
    expect(() => createFocusRefetchGate(-1)).toThrow(RangeError);
  });

  it('rejects a non-number interval', () => {
    expect(() =>
      createFocusRefetchGate('15000' as unknown as number)
    ).toThrow(RangeError);
  });
});
