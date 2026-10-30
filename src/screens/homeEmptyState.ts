/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/homeEmptyState.ts
//
// M-MOBILE-37 (review mobile__gameux): a day-one user (no history, no
// recently-added, library rows still empty) used to get a greeting header
// over a blank scroll region — the screen offers no rails in that state and
// nothing explains or guides. This is the pure emptiness decision; the
// screen renders `EmptyState` guidance when it says so.
//
// The slice(0, 3) mirror is DELIBERATE: HomeScreen only renders the first
// three library rows, so a library beyond the third row's data must not
// suppress the guidance (the user cannot see it anyway). If the render ever
// grows past three rows, update this window with it — the pair is law.
import type { MediaItem } from '../types/media';

interface HomeLibraryLike {
  id: string;
}

export function homeShowsEmptyState(
  continueWatching: readonly unknown[],
  recentlyAdded: readonly unknown[],
  libraries: readonly HomeLibraryLike[],
  libraryItems: Record<string, MediaItem[] | undefined>
): boolean {
  if (continueWatching.length > 0 || recentlyAdded.length > 0) {
    return false;
  }
  return libraries
    .slice(0, 3)
    .every((library) => (libraryItems[library.id] ?? []).length === 0);
}
