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
 * A–Z rail touch-target law (review mobile__gameux M-H, item M-MOBILE-19).
 *
 * The original rail sized each letter by `paddingVertical: 1` around 11pt
 * text — ~15pt tall, 27 stacked shoulder-to-shoulder in a 24pt column. A
 * thumb could not select a letter without hitting a neighbour, and the whole
 * alphabet could not be enlarged to the ~44pt platform minimum without
 * exceeding any phone viewport (27 x 44pt = 1188pt), which is exactly why the
 * rail now lives inside a ScrollView: every target gets a full platform-
 * minimum square ROW, and the letters a viewport cannot show are one flick
 * away.
 *
 * The minimum comes from LAYOUT, never hitSlop: vertical slop on stacked
 * siblings makes adjacent touch rects overlap, so which letter a boundary
 * tap selects would be responder-order luck. Horizontal slop is equally
 * unnecessary — the column itself is the minimum width.
 *
 * Single source of truth: SearchScreen renders `RAIL_BUTTON_LAYOUT` straight
 * into its StyleSheet, and searchRailTouchTargets.test.ts pins these numbers
 * against a literal platform floor.
 */
export const RAIL_TARGET_MIN_SIZE_PT = 44;

/** Laid-out geometry of one rail letter — a 44x44pt touch square by itself. */
export const RAIL_BUTTON_LAYOUT = {
  width: RAIL_TARGET_MIN_SIZE_PT,
  minHeight: RAIL_TARGET_MIN_SIZE_PT,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** The on-screen touch rect of a single rail letter (no slop involved). */
export const railLetterTouchRect = (): { width: number; height: number } => ({
  width: RAIL_BUTTON_LAYOUT.width,
  height: RAIL_BUTTON_LAYOUT.minHeight,
});

/** Total scrollable content height of the rail for `entries` letters. */
export const railContentHeightPt = (
  entries: number = RAIL_LETTERS.length
): number => entries * RAIL_TARGET_MIN_SIZE_PT;

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
