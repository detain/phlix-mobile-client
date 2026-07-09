/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/collections/__tests__/collectionScreenHelpers.test.ts
import {
  isSmartCollection,
  canEditItems,
  collectionSubtitle,
  validateCollectionInput,
} from '../collectionScreenHelpers';
import type { Collection } from '../../../types/collection';

const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
  id: 'c1',
  name: 'Favorites',
  library_id: 'lib1',
  smart_playlist_id: null,
  parent_id: null,
  sort_order: 0,
  is_smart: false,
  created_at: '2026-06-27T00:00:00Z',
  updated_at: '2026-06-27T00:00:00Z',
  ...overrides,
});

describe('isSmartCollection', () => {
  it('is true for a smart collection', () => {
    expect(isSmartCollection(makeCollection({ is_smart: true }))).toBe(true);
  });
  it('is false for a manual collection', () => {
    expect(isSmartCollection(makeCollection({ is_smart: false }))).toBe(false);
  });
});

describe('canEditItems', () => {
  it('allows editing a manual collection', () => {
    expect(canEditItems(makeCollection({ is_smart: false }))).toBe(true);
  });
  it('disallows editing a smart collection', () => {
    expect(canEditItems(makeCollection({ is_smart: true }))).toBe(false);
  });
});

describe('collectionSubtitle', () => {
  it('reads "Smart" for a smart collection regardless of count', () => {
    expect(collectionSubtitle(makeCollection({ is_smart: true }))).toBe('Smart');
    expect(collectionSubtitle(makeCollection({ is_smart: true }), 9)).toBe(
      'Smart'
    );
  });

  it('reads "Collection" for a manual collection with unknown count', () => {
    expect(collectionSubtitle(makeCollection())).toBe('Collection');
  });

  it('pluralizes a known item count', () => {
    expect(collectionSubtitle(makeCollection(), 0)).toBe('0 items');
    expect(collectionSubtitle(makeCollection(), 1)).toBe('1 item');
    expect(collectionSubtitle(makeCollection(), 12)).toBe('12 items');
  });
});

describe('validateCollectionInput', () => {
  it('returns null when both name and library are present', () => {
    expect(validateCollectionInput('My List', 'lib1')).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(validateCollectionInput('', 'lib1')).toBe(
      'Please enter a collection name'
    );
    expect(validateCollectionInput('   ', 'lib1')).toBe(
      'Please enter a collection name'
    );
  });

  it('rejects a missing library', () => {
    expect(validateCollectionInput('My List', null)).toBe(
      'Please choose a library'
    );
    expect(validateCollectionInput('My List', '')).toBe(
      'Please choose a library'
    );
  });
});
