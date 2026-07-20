/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/media.test.ts
//
// Guards the `MediaType` drift closed in this change. The union is re-exported
// from `@phlix/contracts` (the single source of truth for the media_items.type
// column ENUM) rather than redeclared, so these are compile-time assertions
// that the re-export resolves and covers the real vocabulary.
//
// It previously was a hand-rolled superset carrying a bogus `image` — a value
// the server never emits (the photo kind is `photo`; `image` is a scanner-side
// label keying the media scanner's file-extension set). The same stale list in
// the server's `MediaItemShaper::VALID_TYPES` was relabelling real
// photo/book/audiobook/track rows as "movie" (phlix-server#527).

import type { MediaType, MediaItem } from '../media';

describe('MediaType', () => {
  it('covers the full media_items.type ENUM', () => {
    const all: MediaType[] = [
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
    expect(all).toHaveLength(13);
    expect(new Set(all).size).toBe(13);
  });

  it('rejects `image`, which the server never emits', () => {
    // @ts-expect-error `image` is a scanner-side label, not a media type.
    const bogus: MediaType = 'image';
    expect(bogus).toBe('image');
  });

  it('keeps the music/photo comparisons the local superset existed for', () => {
    // The hand-rolled union was justified by these checks (LibraryScreen,
    // usePhotoStore). Contracts now covers both, so they still narrow.
    const music: MediaType = 'music';
    const photo: MediaType = 'photo';
    expect(music === 'music').toBe(true);
    expect(photo === 'photo').toBe(true);
  });

  it('types MediaItem.type against the shared union', () => {
    const book: MediaItem = { id: 'b1', name: 'Dune', type: 'book' };
    const audiobook: MediaItem = { id: 'a1', name: 'Dune (read)', type: 'audiobook' };
    expect(book.type).toBe('book');
    expect(audiobook.type).toBe('audiobook');
  });
});
