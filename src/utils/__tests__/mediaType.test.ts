/**
 * Tests for the media-type helpers.
 *
 * These pin the defects the helpers were introduced to fix:
 *  - `MediaDetailScreen` gated Download on `!isSeries`, a NEGATION, so
 *    season/album/artist/photo/book all showed a Download button that
 *    dead-ended in DownloadService.
 *  - `DownloadsScreen` labelled types with
 *    `type === 'movie' ? 'Movie' : 'Episode'`, which is wrong for 11 of the 13
 *    ENUM members — a downloaded audiobook read "Episode".
 *
 * Every member of the ENUM is asserted explicitly. A test that only checked
 * `movie` and `series` is what let both defects survive.
 */
import type { MediaType } from '../../types/media';
import { PLAYABLE_TYPES, isPlayableType, isDownloadableType, mediaTypeLabel } from '../mediaType';

const ALL_TYPES: MediaType[] = [
  'movie',
  'series',
  'season',
  'episode',
  'track',
  'music',
  'album',
  'artist',
  'video',
  'audio',
  'book',
  'photo',
  'audiobook',
];

describe('isPlayableType', () => {
  it('accepts every leaf type that has a stream of its own', () => {
    expect(isPlayableType('movie')).toBe(true);
    expect(isPlayableType('episode')).toBe(true);
    expect(isPlayableType('video')).toBe(true);
    expect(isPlayableType('audio')).toBe(true);
    expect(isPlayableType('track')).toBe(true);
    expect(isPlayableType('audiobook')).toBe(true);
  });

  it('rejects containers, which drill down and have no stream', () => {
    expect(isPlayableType('series')).toBe(false);
    expect(isPlayableType('season')).toBe(false);
    expect(isPlayableType('album')).toBe(false);
    expect(isPlayableType('artist')).toBe(false);
    expect(isPlayableType('music')).toBe(false);
  });

  it('rejects types with no audio or video track', () => {
    expect(isPlayableType('book')).toBe(false);
    expect(isPlayableType('photo')).toBe(false);
  });

  it('covers the whole ENUM — no member is left unclassified', () => {
    for (const t of ALL_TYPES) {
      expect(typeof isPlayableType(t)).toBe('boolean');
    }
    expect(ALL_TYPES).toHaveLength(13);
  });

  it('never treats unknown or malformed input as playable', () => {
    // The allowlist matters here: a denylist would have said `true` for all of
    // these, which is how a dead-end Download button gets shipped.
    expect(isPlayableType('image')).toBe(false); // not an ENUM member at all
    expect(isPlayableType('bogus')).toBe(false);
    expect(isPlayableType('')).toBe(false);
    expect(isPlayableType(undefined)).toBe(false);
    expect(isPlayableType(null)).toBe(false);
    expect(isPlayableType(42)).toBe(false);
    expect(isPlayableType({ type: 'movie' })).toBe(false);
  });

  it('normalises case and surrounding whitespace', () => {
    expect(isPlayableType('Movie')).toBe(true);
    expect(isPlayableType('AUDIOBOOK')).toBe(true);
    expect(isPlayableType('  track  ')).toBe(true);
  });
});

describe('isDownloadableType', () => {
  it('matches the playable set — a download fetches the item stream', () => {
    for (const t of ALL_TYPES) {
      expect(isDownloadableType(t)).toBe(isPlayableType(t));
    }
  });

  it('does not offer downloads for container types', () => {
    // The exact regression: `!isSeries` said true for all of these.
    for (const t of ['season', 'album', 'artist', 'photo', 'book'] as MediaType[]) {
      expect(isDownloadableType(t)).toBe(false);
    }
  });
});

describe('mediaTypeLabel', () => {
  it('gives every ENUM member its own label', () => {
    const labels = ALL_TYPES.map(mediaTypeLabel);
    expect(new Set(labels).size).toBe(ALL_TYPES.length);
    expect(labels).not.toContain(undefined);
  });

  it('does not label everything non-movie as "Episode"', () => {
    // The precise old behaviour, asserted as gone.
    expect(mediaTypeLabel('audiobook')).toBe('Audiobook');
    expect(mediaTypeLabel('track')).toBe('Track');
    expect(mediaTypeLabel('photo')).toBe('Photo');
    expect(mediaTypeLabel('book')).toBe('Book');
    expect(mediaTypeLabel('movie')).toBe('Movie');
    expect(mediaTypeLabel('episode')).toBe('Episode');
  });

  it('falls back gracefully rather than mislabelling unknown input', () => {
    expect(mediaTypeLabel('somethingnew')).toBe('Somethingnew');
    expect(mediaTypeLabel('')).toBe('Item');
    expect(mediaTypeLabel(undefined)).toBe('Item');
    expect(mediaTypeLabel(null)).toBe('Item');
  });
});

describe('PLAYABLE_TYPES', () => {
  it('contains only real ENUM members', () => {
    for (const t of PLAYABLE_TYPES) {
      expect(ALL_TYPES).toContain(t);
    }
  });
});
