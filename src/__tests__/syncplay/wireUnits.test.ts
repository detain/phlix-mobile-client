/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/wireUnits.test.ts
//
// M-MOBILE-27 (review mobile__exploiter m2): host-sent seek positions were
// finite-checked but never BOUNDED — `1e303` passed the old gate and met the
// native player raw (iOS CMTime stall, Android Long saturation).
// clampSeekSeconds is the consumer-side bound; these are its tables.

import {
  clampSeekSeconds,
  wireMsToSeconds,
  SEEK_UNKNOWN_DURATION_CEILING_SECONDS,
} from '../../syncplay/wireUnits';

describe('wireMsToSeconds', () => {
  it('decodes ms to seconds and passes undefined through', () => {
    expect(wireMsToSeconds(42500)).toBe(42.5);
    expect(wireMsToSeconds(undefined)).toBeUndefined();
  });
});

describe('clampSeekSeconds (M-MOBILE-27)', () => {
  it('keeps in-range targets verbatim', () => {
    expect(clampSeekSeconds(42.5, 600)).toBe(42.5);
    expect(clampSeekSeconds(600, 600)).toBe(600);
    expect(clampSeekSeconds(0, 600)).toBe(0); // a real "start over" seek
  });

  it('caps at the known duration', () => {
    expect(clampSeekSeconds(900, 600)).toBe(600);
    expect(clampSeekSeconds(1e303, 600)).toBe(600); // the review's exact vector
  });

  it('caps at the 24h sanity ceiling when the duration is unknown', () => {
    expect(clampSeekSeconds(1e303, 0)).toBe(SEEK_UNKNOWN_DURATION_CEILING_SECONDS);
    expect(clampSeekSeconds(500, 0)).toBe(500); // normal seek still works
    expect(clampSeekSeconds(500, NaN)).toBe(500);
  });

  it('floors negatives and non-finite input at zero', () => {
    expect(clampSeekSeconds(-10, 600)).toBe(0);
    expect(clampSeekSeconds(NaN, 600)).toBe(0);
    expect(clampSeekSeconds(Number.POSITIVE_INFINITY, 600)).toBe(0);
    expect(clampSeekSeconds(Number.MAX_VALUE, 600)).toBe(600);
  });
});
