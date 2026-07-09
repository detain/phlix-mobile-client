/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/music.test.ts
import {
  normalizeAlbumTrack,
  sortTracks,
  type RawAlbumTrack,
  type Track,
} from '../music';

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'id',
  name: 'name',
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

describe('normalizeAlbumTrack', () => {
  it('reads flat top-level fields when present', () => {
    const raw: RawAlbumTrack = {
      id: 't1',
      name: 'Top Name',
      artist: 'Top Artist',
      album: 'Top Album',
      album_artist: 'Top AlbumArtist',
      year: 1999,
      genre: 'Rock',
      track_number: 3,
      disc_number: 1,
      duration_secs: 240,
      composer: 'Top Composer',
      path: '/top.flac',
    };
    expect(normalizeAlbumTrack(raw)).toEqual({
      id: 't1',
      name: 'Top Name',
      artist: 'Top Artist',
      album: 'Top Album',
      album_artist: 'Top AlbumArtist',
      year: 1999,
      genre: 'Rock',
      track_number: 3,
      disc_number: 1,
      duration_secs: 240,
      composer: 'Top Composer',
      path: '/top.flac',
    });
  });

  it('falls back to metadata.* when top-level fields are absent', () => {
    const raw: RawAlbumTrack = {
      id: 't2',
      metadata: {
        title: 'Meta Title',
        artist: 'Meta Artist',
        album: 'Meta Album',
        album_artist: 'Meta AlbumArtist',
        year: 2001,
        genre: 'Jazz',
        track_number: 5,
        disc_number: 2,
        duration_secs: 180,
        composer: 'Meta Composer',
      },
      path: '/meta.flac',
    };
    const result = normalizeAlbumTrack(raw);
    expect(result.name).toBe('Meta Title');
    expect(result.artist).toBe('Meta Artist');
    expect(result.album).toBe('Meta Album');
    expect(result.album_artist).toBe('Meta AlbumArtist');
    expect(result.year).toBe(2001);
    expect(result.genre).toBe('Jazz');
    expect(result.track_number).toBe(5);
    expect(result.disc_number).toBe(2);
    expect(result.duration_secs).toBe(180);
    expect(result.composer).toBe('Meta Composer');
    expect(result.path).toBe('/meta.flac');
  });

  it('name = metadata.title ?? raw.name ?? ""', () => {
    expect(
      normalizeAlbumTrack({ id: 'a', name: 'fallback', metadata: { title: 'T' } }).name
    ).toBe('T');
    expect(normalizeAlbumTrack({ id: 'b', name: 'fallback' }).name).toBe('fallback');
    expect(normalizeAlbumTrack({ id: 'c' }).name).toBe('');
  });

  it('coerces numeric strings and yields null for non-numeric/missing', () => {
    const raw: RawAlbumTrack = {
      id: 't3',
      metadata: { track_number: '7', year: 'not-a-year' },
    };
    const result = normalizeAlbumTrack(raw);
    expect(result.track_number).toBe(7);
    expect(result.year).toBeNull();
    expect(result.disc_number).toBeNull();
    expect(result.duration_secs).toBeNull();
  });

  it('prefers a top-level numeric over a metadata one', () => {
    const raw: RawAlbumTrack = {
      id: 't4',
      track_number: 2,
      metadata: { track_number: 99 },
    };
    expect(normalizeAlbumTrack(raw).track_number).toBe(2);
  });
});

describe('sortTracks', () => {
  it('orders by disc_number then track_number with nulls last', () => {
    const input: Track[] = [
      makeTrack({ id: 'd2t1', disc_number: 2, track_number: 1 }),
      makeTrack({ id: 'd1t2', disc_number: 1, track_number: 2 }),
      makeTrack({ id: 'd1t1', disc_number: 1, track_number: 1 }),
      makeTrack({ id: 'nullDisc', disc_number: null, track_number: 1 }),
    ];
    const ids = sortTracks(input).map((t) => t.id);
    expect(ids).toEqual(['d1t1', 'd1t2', 'd2t1', 'nullDisc']);
  });

  it('places null track_number last within the same disc', () => {
    const input: Track[] = [
      makeTrack({ id: 'nullTrack', disc_number: 1, track_number: null }),
      makeTrack({ id: 't1', disc_number: 1, track_number: 1 }),
    ];
    expect(sortTracks(input).map((t) => t.id)).toEqual(['t1', 'nullTrack']);
  });

  it('is stable for equal keys (preserves input order)', () => {
    const input: Track[] = [
      makeTrack({ id: 'a', disc_number: 1, track_number: 1 }),
      makeTrack({ id: 'b', disc_number: 1, track_number: 1 }),
    ];
    expect(sortTracks(input).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input: Track[] = [
      makeTrack({ id: 'x', track_number: 2 }),
      makeTrack({ id: 'y', track_number: 1 }),
    ];
    const before = input.map((t) => t.id);
    sortTracks(input);
    expect(input.map((t) => t.id)).toEqual(before);
  });
});
