/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/photos/__tests__/photoScreenHelpers.test.ts
import {
  pickInitialLibrary,
  albumGridTitle,
  photoCountLabel,
  clampIndex,
  nextSlideIndex,
} from '../photoScreenHelpers';
import type { Library } from '../../../types/media';
import type { PhotoAlbum } from '../../../types/photo';

const lib = (id: string): Library => ({ id, name: id, type: 'photo' });
const makeAlbum = (
  date: string,
  photo_count: number
): PhotoAlbum => ({ id: 'a1', date, photo_count, photos: [] });

describe('pickInitialLibrary', () => {
  it('returns the only library when exactly one', () => {
    expect(pickInitialLibrary([lib('a')])).toEqual(lib('a'));
  });

  it('returns null for zero libraries', () => {
    expect(pickInitialLibrary([])).toBeNull();
  });

  it('returns null for multiple libraries', () => {
    expect(pickInitialLibrary([lib('a'), lib('b')])).toBeNull();
  });
});

describe('albumGridTitle', () => {
  it('maps Unknown to Undated', () => {
    expect(albumGridTitle(makeAlbum('Unknown', 3))).toBe('Undated');
  });

  it('returns date otherwise', () => {
    expect(albumGridTitle(makeAlbum('2026-06-01', 3))).toBe('2026-06-01');
  });
});

describe('photoCountLabel', () => {
  it('singular for 1', () => {
    expect(photoCountLabel(makeAlbum('2026-06-01', 1))).toBe('1 photo');
  });

  it('plural otherwise', () => {
    expect(photoCountLabel(makeAlbum('2026-06-01', 12))).toBe('12 photos');
    expect(photoCountLabel(makeAlbum('2026-06-01', 0))).toBe('0 photos');
  });
});

describe('clampIndex', () => {
  it('clamps below range to 0', () => {
    expect(clampIndex(-5, 10)).toBe(0);
  });

  it('clamps above range to len-1', () => {
    expect(clampIndex(99, 10)).toBe(9);
  });

  it('returns 0 for an empty list', () => {
    expect(clampIndex(3, 0)).toBe(0);
  });

  it('returns the index when in range', () => {
    expect(clampIndex(4, 10)).toBe(4);
  });

  it('floors fractional indices', () => {
    expect(clampIndex(2.9, 10)).toBe(2);
  });

  it('returns 0 for non-finite input', () => {
    expect(clampIndex(NaN, 10)).toBe(0);
  });
});

describe('nextSlideIndex', () => {
  it('advances within range', () => {
    expect(nextSlideIndex(0, 5)).toBe(1);
    expect(nextSlideIndex(3, 5)).toBe(4);
  });

  it('wraps to 0 after the last frame', () => {
    expect(nextSlideIndex(4, 5)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(nextSlideIndex(2, 0)).toBe(0);
  });

  it('clamps an out-of-range current index before advancing', () => {
    expect(nextSlideIndex(99, 5)).toBe(0);
  });
});
