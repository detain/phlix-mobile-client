/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/photos/photoScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the Photos / PhotoAlbum /
// PhotoViewer screens (slice E9b) so the screen-only logic is unit-testable
// without rendering React Native. Everything here is deterministic; no I/O, no
// timers.

import type { Library } from '../../types/media';
import { albumTitle } from '../../types/photo';
import type { PhotoAlbum } from '../../types/photo';

/**
 * Choose the initial photo library to show: the only one when exactly one
 * exists, otherwise null (the screen then renders a picker, or an empty state
 * when there are none).
 */
export const pickInitialLibrary = (libs: Library[]): Library | null =>
  libs.length === 1 ? libs[0] : null;

/**
 * Title for an album grid cell. Re-exports `albumTitle` semantics ("Unknown" →
 * "Undated") so the screen imports one helper module.
 */
export const albumGridTitle = (album: PhotoAlbum): string => albumTitle(album);

/**
 * The photo-count badge text for an album cell, e.g. "1 photo" / "12 photos".
 */
export const photoCountLabel = (album: PhotoAlbum): string => {
  const n = album.photo_count;
  return `${n} ${n === 1 ? 'photo' : 'photos'}`;
};

/**
 * Clamp an index into the valid range [0, len - 1]. Returns 0 for an empty list
 * (callers must still guard rendering on an empty list).
 */
export const clampIndex = (index: number, len: number): number => {
  if (len <= 0) {
    return 0;
  }
  if (!Number.isFinite(index) || index < 0) {
    return 0;
  }
  if (index > len - 1) {
    return len - 1;
  }
  return Math.floor(index);
};

/**
 * Next index for an auto-advancing slideshow: wraps back to 0 after the last
 * frame. Returns 0 for an empty/invalid list.
 */
export const nextSlideIndex = (current: number, len: number): number => {
  if (len <= 0) {
    return 0;
  }
  const safe = clampIndex(current, len);
  return safe + 1 >= len ? 0 : safe + 1;
};
