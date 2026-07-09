/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/search.test.ts
import {
  hasActiveFilters,
  buildBrowseParams,
  letterForName,
  RATING_OPTIONS,
  SORT_OPTIONS,
  type MediaFilters,
} from '../search';

describe('search types helpers', () => {
  describe('hasActiveFilters', () => {
    it('is false for an empty filter object', () => {
      expect(hasActiveFilters({})).toBe(false);
    });

    it('is false for empty arrays and blank libraryId', () => {
      expect(hasActiveFilters({ genres: [], ratings: [], libraryId: '' })).toBe(false);
    });

    it('is true when genres are set', () => {
      expect(hasActiveFilters({ genres: ['Action'] })).toBe(true);
    });

    it('is true when ratings are set', () => {
      expect(hasActiveFilters({ ratings: ['R'] })).toBe(true);
    });

    it('is true for year bounds', () => {
      expect(hasActiveFilters({ yearFrom: 2000 })).toBe(true);
      expect(hasActiveFilters({ yearTo: 2010 })).toBe(true);
    });

    it('is true when sort or order chosen', () => {
      expect(hasActiveFilters({ sort: 'year' })).toBe(true);
      expect(hasActiveFilters({ order: 'desc' })).toBe(true);
    });

    it('is true when libraryId is set', () => {
      expect(hasActiveFilters({ libraryId: 'lib-1' })).toBe(true);
    });
  });

  describe('buildBrowseParams', () => {
    it('maps a trimmed query into search and drops blank query', () => {
      expect(buildBrowseParams('  matrix ', {})).toEqual({ search: 'matrix' });
      expect(buildBrowseParams('   ', {})).toEqual({});
    });

    it('maps the full filter set', () => {
      const filters: MediaFilters = {
        genres: ['Action', 'Drama'],
        ratings: ['R'],
        yearFrom: 2000,
        yearTo: 2010,
        sort: 'year',
        order: 'desc',
        libraryId: 'lib-1',
      };
      expect(buildBrowseParams('x', filters)).toEqual({
        search: 'x',
        genres: ['Action', 'Drama'],
        ratings: ['R'],
        yearFrom: 2000,
        yearTo: 2010,
        sort: 'year',
        order: 'desc',
        libraryId: 'lib-1',
      });
    });

    it('drops empty arrays, undefined fields and blank libraryId', () => {
      expect(
        buildBrowseParams('', { genres: [], ratings: [], libraryId: '' })
      ).toEqual({});
    });

    it('keeps year 0 falsy-safe (only number type matters)', () => {
      expect(buildBrowseParams('', { yearFrom: 0 })).toEqual({ yearFrom: 0 });
    });
  });

  describe('letterForName', () => {
    it('uppercases the first alpha char', () => {
      expect(letterForName('alien')).toBe('A');
      expect(letterForName('Matrix')).toBe('M');
    });

    it('folds digits, symbols and empty into #', () => {
      expect(letterForName('3 Idiots')).toBe('#');
      expect(letterForName('!!!')).toBe('#');
      expect(letterForName('')).toBe('#');
      expect(letterForName('   ')).toBe('#');
    });

    it('trims leading whitespace before bucketing', () => {
      expect(letterForName('  zebra')).toBe('Z');
    });
  });

  describe('constants', () => {
    it('RATING_OPTIONS contains the server-accepted set', () => {
      expect(RATING_OPTIONS).toEqual([
        'G',
        'PG',
        'PG-13',
        'R',
        'NC-17',
        'X',
        'UNRATED',
      ]);
    });

    it('SORT_OPTIONS contains the server-accepted fields', () => {
      expect(SORT_OPTIONS).toEqual([
        'name',
        'year',
        'rating',
        'date_added',
        'runtime',
      ]);
    });
  });
});
