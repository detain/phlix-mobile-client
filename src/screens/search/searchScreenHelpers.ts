/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/search/searchScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the SearchScreen (slice E10b)
// so the screen-only logic is unit-testable without rendering React Native.
// Re-exports the filter helpers from `types/search` (single source of truth)
// plus rail/jump index math.

import type { LetterIndex } from '../../types/search';

export {
  hasActiveFilters,
  buildBrowseParams,
  letterForName,
  RATING_OPTIONS,
  SORT_OPTIONS,
} from '../../types/search';
export type {
  MediaFilters,
  RatingOption,
  SortOption,
  SortOrder,
  LetterIndexEntry,
  LetterIndex,
} from '../../types/search';

/** Full A–Z alphabet plus the "#" non-alpha bucket, in rail display order. */
export const RAIL_LETTERS: string[] = [
  '#',
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
];

/**
 * The cumulative offset at which `letter` begins in the name-asc result set, or
 * `null` when that letter has no entries (so the rail can disable/skip it).
 * Lookup is exact on `entry.letter`.
 */
export const offsetForLetter = (
  index: LetterIndex | null,
  letter: string
): number | null => {
  if (!index) {
    return null;
  }
  const entry = index.letters.find((e) => e.letter === letter);
  return entry ? entry.offset : null;
};

/**
 * The set of letters that actually have entries (count > 0), for enabling rail
 * buttons. Returns an empty Set when there's no index.
 */
export const activeLetters = (index: LetterIndex | null): Set<string> => {
  const set = new Set<string>();
  if (!index) {
    return set;
  }
  for (const entry of index.letters) {
    if (entry.count > 0) {
      set.add(entry.letter);
    }
  }
  return set;
};
