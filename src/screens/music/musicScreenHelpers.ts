/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/music/musicScreenHelpers.ts
//
// Pure, side-effect-free helpers extracted from the Music + MusicAlbum screens
// (slice E9a) so the screen-only logic is unit-testable without rendering React
// Native. Everything here is deterministic; no I/O, no timers.

import { formatTime } from '../../utils/formatters';
import type { Artist, Album, Track } from '../../types/music';

/** The segmented-control tabs the MusicScreen exposes. */
export type MusicSegment = 'artists' | 'albums' | 'tracks';

/** Ordered set of segment chips, with their display labels. */
export const MUSIC_SEGMENTS: { key: MusicSegment; label: string }[] = [
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'tracks', label: 'Tracks' },
];

/**
 * Albums belonging to an artist, filtered from the loaded album list by exact
 * `album.artist === artistName`. Returns a new array (never mutates input).
 */
export const albumsForArtist = (
  albums: Album[],
  artistName: string
): Album[] => albums.filter((album) => album.artist === artistName);

/**
 * Subtitle line for a track row: "artist • m:ss". Omits a part when it's
 * unavailable (no artist, or null duration). Returns '' when neither is present.
 */
export const trackSubtitle = (track: Track): string => {
  const parts: string[] = [];
  if (track.artist && track.artist.trim() !== '') {
    parts.push(track.artist);
  }
  if (track.duration_secs !== null) {
    parts.push(formatTime(track.duration_secs));
  }
  return parts.join(' • ');
};

/**
 * Secondary line for an artist row, e.g. "3 albums • 42 tracks". Pluralizes.
 */
export const artistSubtitle = (artist: Artist): string =>
  `${artist.album_count} ${plural(artist.album_count, 'album')} • ` +
  `${artist.track_count} ${plural(artist.track_count, 'track')}`;

/**
 * Header line for an album, e.g. "Pink Floyd • 1973 • 10 tracks". Omits the
 * year when null.
 */
export const albumSubtitle = (album: Album): string => {
  const parts: string[] = [album.artist];
  if (album.year !== null) {
    parts.push(String(album.year));
  }
  parts.push(`${album.track_count} ${plural(album.track_count, 'track')}`);
  return parts.join(' • ');
};

/** A track's leading position label for the ordered album list, e.g. "3" or "—". */
export const trackPositionLabel = (track: Track): string =>
  track.track_number !== null ? String(track.track_number) : '—';

const plural = (count: number, word: string): string =>
  count === 1 ? word : `${word}s`;
