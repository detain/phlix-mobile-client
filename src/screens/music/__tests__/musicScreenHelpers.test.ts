/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/music/__tests__/musicScreenHelpers.test.ts
import {
  MUSIC_SEGMENTS,
  albumsForArtist,
  trackSubtitle,
  artistSubtitle,
  albumSubtitle,
  trackPositionLabel,
} from '../musicScreenHelpers';
import type { Artist, Album, Track } from '../../../types/music';

const makeAlbum = (overrides: Partial<Album> = {}): Album => ({
  name: 'Album',
  artist: 'Artist',
  year: null,
  track_count: 0,
  tracks: [],
  ...overrides,
});

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'id',
  name: 'Track',
  artist: null,
  album: null,
  album_artist: null,
  year: null,
  genre: null,
  track_number: null,
  disc_number: null,
  duration_secs: null,
  composer: null,
  path: '',
  ...overrides,
});

describe('MUSIC_SEGMENTS', () => {
  it('exposes artists, albums, tracks in order', () => {
    expect(MUSIC_SEGMENTS.map((s) => s.key)).toEqual([
      'artists',
      'albums',
      'tracks',
    ]);
  });
});

describe('albumsForArtist', () => {
  const albums: Album[] = [
    makeAlbum({ name: 'A1', artist: 'Pink Floyd' }),
    makeAlbum({ name: 'A2', artist: 'Queen' }),
    makeAlbum({ name: 'A3', artist: 'Pink Floyd' }),
  ];

  it('returns only the albums whose artist matches exactly', () => {
    expect(albumsForArtist(albums, 'Pink Floyd').map((a) => a.name)).toEqual([
      'A1',
      'A3',
    ]);
  });

  it('returns an empty array when no album matches', () => {
    expect(albumsForArtist(albums, 'Nobody')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const before = albums.length;
    albumsForArtist(albums, 'Queen');
    expect(albums.length).toBe(before);
  });
});

describe('trackSubtitle', () => {
  it('joins artist and formatted duration', () => {
    expect(
      trackSubtitle(makeTrack({ artist: 'Pink Floyd', duration_secs: 382 }))
    ).toBe('Pink Floyd • 6:22');
  });

  it('omits the artist when absent', () => {
    expect(trackSubtitle(makeTrack({ duration_secs: 65 }))).toBe('1:05');
  });

  it('omits the duration when null', () => {
    expect(trackSubtitle(makeTrack({ artist: 'X' }))).toBe('X');
  });

  it('returns an empty string when neither is present', () => {
    expect(trackSubtitle(makeTrack())).toBe('');
  });
});

describe('artistSubtitle', () => {
  it('pluralizes albums and tracks', () => {
    const a: Artist = {
      name: 'X',
      album_count: 3,
      track_count: 42,
      albums: [],
    };
    expect(artistSubtitle(a)).toBe('3 albums • 42 tracks');
  });

  it('uses singular for a count of one', () => {
    const a: Artist = {
      name: 'X',
      album_count: 1,
      track_count: 1,
      albums: [],
    };
    expect(artistSubtitle(a)).toBe('1 album • 1 track');
  });
});

describe('albumSubtitle', () => {
  it('includes artist, year and track count', () => {
    expect(
      albumSubtitle(makeAlbum({ artist: 'Pink Floyd', year: 1973, track_count: 10 }))
    ).toBe('Pink Floyd • 1973 • 10 tracks');
  });

  it('omits the year when null', () => {
    expect(
      albumSubtitle(makeAlbum({ artist: 'Pink Floyd', year: null, track_count: 1 }))
    ).toBe('Pink Floyd • 1 track');
  });
});

describe('trackPositionLabel', () => {
  it('renders the track number when present', () => {
    expect(trackPositionLabel(makeTrack({ track_number: 7 }))).toBe('7');
  });

  it('renders an em dash when the track number is null', () => {
    expect(trackPositionLabel(makeTrack({ track_number: null }))).toBe('—');
  });
});
