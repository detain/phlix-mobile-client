// src/screens/collections/collectionScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the Collections + Collection
// detail screens (slice E10a) so the screen-only logic is unit-testable without
// rendering React Native. Everything here is deterministic; no I/O, no timers.

import type { Collection } from '../../types/collection';

/** True when a collection is a smart (saved-playlist-backed) collection. */
export const isSmartCollection = (collection: Collection): boolean =>
  collection.is_smart;

/**
 * Items can only be hand-added/removed on a MANUAL collection. Smart
 * collections are evaluated server-side from a saved playlist (refresh-only).
 */
export const canEditItems = (collection: Collection): boolean =>
  !collection.is_smart;

/**
 * Subtitle line for a collection row. Leads with a "Smart" / "Collection" kind
 * label, then an item count when one is known (and the collection is manual —
 * smart collections list "Smart" with no fixed count). Examples:
 *   "Smart"            (smart, no count)
 *   "Collection"       (manual, count unknown)
 *   "12 items"         (manual, count known)
 *   "1 item"           (manual, single item)
 */
export const collectionSubtitle = (
  collection: Collection,
  itemCount?: number
): string => {
  if (collection.is_smart) {
    return 'Smart';
  }
  if (itemCount === undefined) {
    return 'Collection';
  }
  return `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
};

/**
 * Validate the create-collection form. Returns an error message string when
 * invalid, or null when the input is OK to submit.
 */
export const validateCollectionInput = (
  name: string,
  libraryId: string | null | undefined
): string | null => {
  if (!name || name.trim() === '') {
    return 'Please enter a collection name';
  }
  if (!libraryId || libraryId.trim() === '') {
    return 'Please choose a library';
  }
  return null;
};
