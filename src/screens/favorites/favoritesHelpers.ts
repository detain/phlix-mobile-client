/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/favorites/favoritesHelpers.ts
//
// Pure helpers for the favorites/ratings UI (slice E10 favorites). No I/O, no
// React — unit-tested in `__tests__/favoritesHelpers.test.ts`.

/** Inclusive rating bounds the server accepts (`PUT /media/{id}/rating`). */
export const MIN_RATING = 1;
export const MAX_RATING = 10;

/** Number of star glyphs the 1–10 scale is rendered as (each star = 2 points). */
export const STAR_COUNT = 5;
/** Rating points represented by one full star. */
export const POINTS_PER_STAR = MAX_RATING / STAR_COUNT;

/**
 * Clamp a rating into the inclusive 1–10 range and round to an integer (the
 * server stores `INT`). NaN falls back to `MIN_RATING`; ±Infinity clamp to the
 * range bound they exceed (+Infinity → MAX, -Infinity → MIN).
 */
export const clampRating = (n: number): number => {
  if (Number.isNaN(n)) {
    return MIN_RATING;
  }
  const rounded = Math.round(n);
  if (rounded < MIN_RATING) {
    return MIN_RATING;
  }
  if (rounded > MAX_RATING) {
    return MAX_RATING;
  }
  return rounded;
};

/** A single star's fill state for the 5-star display of a 1–10 rating. */
export type StarFill = 'full' | 'half' | 'empty';

/**
 * Map a 1–10 rating (or null/unset) onto 5 stars, each worth 2 points: a star
 * is `full` at ≥ its upper bound, `half` at the midpoint, else `empty`. Returns
 * 5 empties for null/undefined. The rating is clamped first so out-of-range
 * input never produces a malformed row.
 *
 * e.g. 10 → [full×5], 7 → [full,full,full,half,empty], null → [empty×5].
 */
export const starsFromRating = (rating: number | null | undefined): StarFill[] => {
  const value = rating == null ? 0 : clampRating(rating);
  const stars: StarFill[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const upper = (i + 1) * POINTS_PER_STAR; // 2,4,6,8,10
    if (value >= upper) {
      stars.push('full');
    } else if (value >= upper - 1) {
      // value is the half-point of this star (e.g. 1,3,5,7,9).
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }
  return stars;
};

/**
 * The rating value a tap on the Nth star (1-based) sets, mapping each star to
 * its FULL value on the 1–10 scale: star 1 → 2, star 3 → 6, star 5 → 10.
 */
export const ratingForStar = (starIndex: number): number =>
  clampRating(starIndex * POINTS_PER_STAR);

/** The favorite state after a toggle. */
export const nextFavoriteState = (current: boolean): boolean => !current;

/**
 * Whether tapping a star at `starValue` should CLEAR the rating instead of
 * setting it: re-tapping the star that already represents the current rating is
 * a clear gesture (matches common star-rating UX).
 */
export const isClearTap = (
  starValue: number,
  currentRating: number | null | undefined
): boolean => currentRating != null && clampRating(currentRating) === starValue;
