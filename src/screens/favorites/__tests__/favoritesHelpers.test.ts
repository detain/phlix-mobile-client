/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/favorites/__tests__/favoritesHelpers.test.ts
import {
  clampRating,
  starsFromRating,
  ratingForStar,
  nextFavoriteState,
  isClearTap,
  MIN_RATING,
  MAX_RATING,
} from '../favoritesHelpers';

describe('clampRating', () => {
  it('keeps an in-range integer', () => {
    expect(clampRating(5)).toBe(5);
    expect(clampRating(MIN_RATING)).toBe(MIN_RATING);
    expect(clampRating(MAX_RATING)).toBe(MAX_RATING);
  });

  it('clamps below the minimum', () => {
    expect(clampRating(0)).toBe(MIN_RATING);
    expect(clampRating(-3)).toBe(MIN_RATING);
  });

  it('clamps above the maximum', () => {
    expect(clampRating(11)).toBe(MAX_RATING);
    expect(clampRating(99)).toBe(MAX_RATING);
  });

  it('rounds fractional values', () => {
    expect(clampRating(4.4)).toBe(4);
    expect(clampRating(4.6)).toBe(5);
  });

  it('falls back to the minimum for non-finite input', () => {
    expect(clampRating(NaN)).toBe(MIN_RATING);
    expect(clampRating(Infinity)).toBe(MAX_RATING); // Infinity > max → clamps to max
  });
});

describe('starsFromRating', () => {
  it('renders 5 empties for null/undefined', () => {
    expect(starsFromRating(null)).toEqual([
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
    expect(starsFromRating(undefined)).toEqual([
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('renders all full at 10', () => {
    expect(starsFromRating(10)).toEqual([
      'full',
      'full',
      'full',
      'full',
      'full',
    ]);
  });

  it('renders a trailing half for odd ratings', () => {
    expect(starsFromRating(7)).toEqual([
      'full',
      'full',
      'full',
      'half',
      'empty',
    ]);
  });

  it('renders whole stars for even ratings', () => {
    expect(starsFromRating(4)).toEqual([
      'full',
      'full',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('renders a single half at the minimum', () => {
    expect(starsFromRating(1)).toEqual([
      'half',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
  });
});

describe('ratingForStar', () => {
  it('maps each star to its full 1–10 value', () => {
    expect(ratingForStar(1)).toBe(2);
    expect(ratingForStar(2)).toBe(4);
    expect(ratingForStar(3)).toBe(6);
    expect(ratingForStar(4)).toBe(8);
    expect(ratingForStar(5)).toBe(10);
  });
});

describe('nextFavoriteState', () => {
  it('inverts the current state', () => {
    expect(nextFavoriteState(false)).toBe(true);
    expect(nextFavoriteState(true)).toBe(false);
  });
});

describe('isClearTap', () => {
  it('is true when re-tapping the current rating', () => {
    expect(isClearTap(6, 6)).toBe(true);
  });

  it('is false for a different star value', () => {
    expect(isClearTap(8, 6)).toBe(false);
  });

  it('is false when there is no current rating', () => {
    expect(isClearTap(6, null)).toBe(false);
    expect(isClearTap(6, undefined)).toBe(false);
  });

  it('clamps the current rating before comparing', () => {
    expect(isClearTap(10, 99)).toBe(true);
  });
});
