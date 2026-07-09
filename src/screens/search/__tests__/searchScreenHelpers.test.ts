/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/search/__tests__/searchScreenHelpers.test.ts
import {
  RAIL_LETTERS,
  offsetForLetter,
  activeLetters,
  hasActiveFilters,
  buildBrowseParams,
  letterForName,
} from '../searchScreenHelpers';
import type { LetterIndex } from '../../../types/search';

const index: LetterIndex = {
  letters: [
    { letter: '#', offset: 0, count: 2 },
    { letter: 'A', offset: 2, count: 5 },
    { letter: 'M', offset: 7, count: 0 },
    { letter: 'Z', offset: 7, count: 3 },
  ],
  total: 10,
};

describe('searchScreenHelpers', () => {
  it('re-exports the pure filter helpers', () => {
    expect(typeof hasActiveFilters).toBe('function');
    expect(typeof buildBrowseParams).toBe('function');
    expect(letterForName('zoo')).toBe('Z');
  });

  describe('RAIL_LETTERS', () => {
    it('starts with # then A..Z (27 entries)', () => {
      expect(RAIL_LETTERS).toHaveLength(27);
      expect(RAIL_LETTERS[0]).toBe('#');
      expect(RAIL_LETTERS[1]).toBe('A');
      expect(RAIL_LETTERS[26]).toBe('Z');
    });
  });

  describe('offsetForLetter', () => {
    it('returns the cumulative offset for a present letter', () => {
      expect(offsetForLetter(index, 'A')).toBe(2);
      expect(offsetForLetter(index, '#')).toBe(0);
      expect(offsetForLetter(index, 'Z')).toBe(7);
    });

    it('returns null for a missing letter or null index', () => {
      expect(offsetForLetter(index, 'B')).toBeNull();
      expect(offsetForLetter(null, 'A')).toBeNull();
    });

    it('returns the offset even when count is 0 (entry still present)', () => {
      expect(offsetForLetter(index, 'M')).toBe(7);
    });
  });

  describe('activeLetters', () => {
    it('returns only letters with count > 0', () => {
      const set = activeLetters(index);
      expect(set.has('#')).toBe(true);
      expect(set.has('A')).toBe(true);
      expect(set.has('Z')).toBe(true);
      expect(set.has('M')).toBe(false); // count 0
      expect(set.has('B')).toBe(false); // absent
    });

    it('returns an empty set for a null index', () => {
      expect(activeLetters(null).size).toBe(0);
    });
  });
});
