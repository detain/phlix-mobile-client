/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/photo.test.ts
import {
  albumTitle,
  formatExifSummary,
  gpsCoords,
} from '../photo';
import type { PhotoAlbum, PhotoExif } from '../photo';

const makeAlbum = (date: string): PhotoAlbum => ({
  id: 'a1',
  date,
  photo_count: 1,
  photos: [],
});

const fullExif: PhotoExif = {
  camera_make: 'Canon',
  camera_model: 'EOS R5',
  lens: 'RF 24-70',
  aperture: 'f/2.8',
  iso: 100,
  shutter_speed: '1/250',
  focal_length: '50mm',
  width: 4000,
  height: 3000,
  orientation: 1,
  orientation_name: 'Horizontal',
  date_taken_unix: 1717200000,
  date_taken_formatted: 'June 1, 2026',
  date_taken_year: '2026',
  date_taken_month: 'June',
  gps_lat: 12.34,
  gps_lng: 56.78,
  gps_alt: 100,
  gps_display: '12.34, 56.78',
};

describe('albumTitle', () => {
  it('maps "Unknown" to "Undated"', () => {
    expect(albumTitle(makeAlbum('Unknown'))).toBe('Undated');
  });

  it('maps empty date to "Undated"', () => {
    expect(albumTitle(makeAlbum(''))).toBe('Undated');
  });

  it('returns the date verbatim otherwise', () => {
    expect(albumTitle(makeAlbum('2026-06-01'))).toBe('2026-06-01');
  });
});

describe('formatExifSummary', () => {
  it('formats a full exif object in order', () => {
    expect(formatExifSummary(fullExif)).toEqual([
      'Canon EOS R5',
      'RF 24-70',
      '4000×3000',
      'f/2.8',
      'ISO 100',
      '1/250',
      '50mm',
      'June 1, 2026',
      '12.34, 56.78',
    ]);
  });

  it('skips null/empty fields', () => {
    const partial: Partial<PhotoExif> = {
      camera_make: 'Nikon',
      camera_model: null,
      lens: null,
      width: 1920,
      height: 1080,
      iso: null,
      gps_display: '',
    };
    expect(formatExifSummary(partial)).toEqual(['Nikon', '1920×1080']);
  });

  it('returns an empty array for an empty object', () => {
    expect(formatExifSummary({})).toEqual([]);
  });

  it('omits dimensions when one side is missing', () => {
    expect(formatExifSummary({ width: 1920 })).toEqual([]);
  });

  it('joins make and model with a space', () => {
    expect(
      formatExifSummary({ camera_make: 'Sony', camera_model: 'A7 IV' })
    ).toEqual(['Sony A7 IV']);
  });
});

describe('gpsCoords', () => {
  it('returns coords when both lat and lng present', () => {
    expect(gpsCoords(fullExif)).toEqual({ lat: 12.34, lng: 56.78 });
  });

  it('returns null when no coords', () => {
    expect(gpsCoords({})).toBeNull();
  });

  it('returns null when only one coordinate present', () => {
    expect(gpsCoords({ gps_lat: 12.34, gps_lng: null })).toBeNull();
  });
});
