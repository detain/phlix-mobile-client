/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/search.ts
//
// Advanced-search + letter-index domain (slice E10b). Pure types + side-effect-
// free helpers shared by the search store and the SearchScreen. The wire shapes
// are server-verbatim:
//   - `GET /media/letter-index` → { letters: [{letter, offset, count}], total }
//   - `GET /media` filter set is modeled by `BrowseMediaParams` in LibraryManager.
//
// `MediaFilters` is the UI-facing advanced-filter STATE; `buildBrowseParams`
// maps it (plus the text query) onto the manager's `BrowseMediaParams`.

import type { BrowseMediaParams } from '../api/LibraryManager';

/** One bucket of the `/media/letter-index` response. `offset` is CUMULATIVE. */
export interface LetterIndexEntry {
  /** A single uppercase letter A–Z, or "#" for non-alpha leading characters. */
  letter: string;
  /** Cumulative offset into the name-asc result set where this letter begins. */
  offset: number;
  /** Number of items whose name starts with this letter. */
  count: number;
}

/** The full `/media/letter-index` envelope (already unwrapped of any wrapper). */
export interface LetterIndex {
  letters: LetterIndexEntry[];
  total: number;
}

/** The fixed content-rating set the server accepts for `ratings[]`. */
export const RATING_OPTIONS = [
  'G',
  'PG',
  'PG-13',
  'R',
  'NC-17',
  'X',
  'UNRATED',
] as const;

export type RatingOption = (typeof RATING_OPTIONS)[number];

/** The fixed sort fields the server accepts for `sort`. */
export const SORT_OPTIONS = [
  'name',
  'year',
  'rating',
  'date_added',
  'runtime',
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export type SortOrder = 'asc' | 'desc';

/**
 * Advanced-filter UI state. All fields optional — an empty object means "no
 * filters" (`hasActiveFilters` returns false). `genres`/`ratings` are
 * multi-select; year range is inclusive; `sort`/`order` drive ordering;
 * `libraryId` scopes to one library.
 */
export interface MediaFilters {
  genres?: string[];
  ratings?: string[];
  yearFrom?: number;
  yearTo?: number;
  sort?: SortOption;
  order?: SortOrder;
  libraryId?: string;
}

/**
 * True when any filter is set to a non-default, meaningful value. `sort`/`order`
 * alone count as active (the user explicitly chose an ordering). Empty arrays,
 * empty strings and undefined all count as inactive.
 */
export const hasActiveFilters = (f: MediaFilters): boolean => {
  if (f.genres && f.genres.length > 0) {
    return true;
  }
  if (f.ratings && f.ratings.length > 0) {
    return true;
  }
  if (typeof f.yearFrom === 'number') {
    return true;
  }
  if (typeof f.yearTo === 'number') {
    return true;
  }
  if (f.sort !== undefined) {
    return true;
  }
  if (f.order !== undefined) {
    return true;
  }
  if (f.libraryId !== undefined && f.libraryId !== '') {
    return true;
  }
  return false;
};

/**
 * Map the advanced-filter UI state (+ optional text query) onto the manager's
 * `BrowseMediaParams`. Only meaningful fields are emitted (empty arrays / blank
 * strings are dropped) so the query string stays clean and the server's
 * `topLevel`/letter-index semantics aren't perturbed by stray params.
 *
 * The text `query` is trimmed; a blank query omits `search` entirely.
 */
export const buildBrowseParams = (
  query: string,
  filters: MediaFilters
): BrowseMediaParams => {
  const params: BrowseMediaParams = {};

  const trimmed = query.trim();
  if (trimmed !== '') {
    params.search = trimmed;
  }
  if (filters.genres && filters.genres.length > 0) {
    params.genres = filters.genres;
  }
  if (filters.ratings && filters.ratings.length > 0) {
    params.ratings = filters.ratings;
  }
  if (typeof filters.yearFrom === 'number') {
    params.yearFrom = filters.yearFrom;
  }
  if (typeof filters.yearTo === 'number') {
    params.yearTo = filters.yearTo;
  }
  if (filters.sort !== undefined) {
    params.sort = filters.sort;
  }
  if (filters.order !== undefined) {
    params.order = filters.order;
  }
  if (filters.libraryId !== undefined && filters.libraryId !== '') {
    params.libraryId = filters.libraryId;
  }

  return params;
};

/**
 * Client-side fallback for the letter a name folds into: the uppercased first
 * alphabetic character A–Z, or "#" when the first non-space character is a
 * digit, symbol, or the name is empty. Mirrors the server's `#` bucketing.
 */
export const letterForName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed === '') {
    return '#';
  }
  const first = trimmed.charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
};
