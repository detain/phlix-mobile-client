/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/profile.test.ts
import { ratingToLabel, labelToRating } from '../profile';

describe('profile rating helpers', () => {
  it('ratingToLabel maps each integer to its label', () => {
    expect(ratingToLabel(0)).toBe('G');
    expect(ratingToLabel(1)).toBe('PG');
    expect(ratingToLabel(2)).toBe('PG-13');
    expect(ratingToLabel(3)).toBe('R');
    expect(ratingToLabel(4)).toBe('NC-17');
    expect(ratingToLabel(5)).toBe('X');
    expect(ratingToLabel(6)).toBe('UNRATED');
  });

  it('ratingToLabel falls back to UNRATED for out-of-range values', () => {
    expect(ratingToLabel(-1)).toBe('UNRATED');
    expect(ratingToLabel(99)).toBe('UNRATED');
  });

  it('labelToRating maps each label to its integer', () => {
    expect(labelToRating('G')).toBe(0);
    expect(labelToRating('PG')).toBe(1);
    expect(labelToRating('PG-13')).toBe(2);
    expect(labelToRating('R')).toBe(3);
    expect(labelToRating('NC-17')).toBe(4);
    expect(labelToRating('X')).toBe(5);
    expect(labelToRating('UNRATED')).toBe(6);
  });

  it('labelToRating falls back to 6 (UNRATED) for unknown labels', () => {
    expect(labelToRating('BOGUS')).toBe(6);
  });

  it('round-trips int → label → int', () => {
    for (let i = 0; i <= 6; i += 1) {
      expect(labelToRating(ratingToLabel(i))).toBe(i);
    }
  });
});
