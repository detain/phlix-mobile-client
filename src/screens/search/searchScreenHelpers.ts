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
 * Single source of truth: SearchScreen computes its rail geometry through
 * `railLetterTouchRect()` (the screen's StyleSheet dimensions ARE this
 * function's output — M-MOBILE-19 r2 wiring law), searchRailTouchTargets.test.ts
 * pins these numbers against a literal platform floor, and the screen-level
 * SearchScreen.test.tsx pins the flattened footprint of the RENDERED rail so
 * the seam can never be bypassed silently.
 *
 * (`railContentHeightPt` lived here briefly and was removed in r2: the
 * screen cannot consume an explicit px column height without overriding the
 * blessed `minHeight: '100%'` percentage centering, so it had no honest
 * production caller — estate law ships no test-only seams. The 27 × 44 = 1188
 * > 320 arithmetic is pinned directly in the two test files that need it.)
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
/**
 * M-MOBILE-39 (review mobile__gameux m5): the results grid hardcoded
 * `numColumns={2}` and every sibling screen froze `Dimensions.get('window')`
 * at module scope, so foldables, tablets and landscape never re-laid out.
 * The screens now read `useWindowDimensions()`; the column COUNT law lives
 * here as a pure function of live width (phone 2 / small tablet 3 / large 4),
 * unit-testable without a renderer.
 */
export const searchGridColumns = (windowWidth: number): number => {
  if (windowWidth >= 900) {
    return 4;
  }
  if (windowWidth >= 600) {
    return 3;
  }
  return 2;
};
