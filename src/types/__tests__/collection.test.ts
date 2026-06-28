// src/types/__tests__/collection.test.ts
//
// `collection.ts` declares only interfaces (no runtime helpers — those live in
// `screens/collections/collectionScreenHelpers.ts`), so these are compile-time
// shape assertions: if the DTO drifts from the verified server contract the
// build fails here.
import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../collection';

describe('collection types', () => {
  it('Collection matches the verified server shape (snake_case)', () => {
    const c: Collection = {
      id: 'c1',
      name: 'Favorites',
      library_id: 'lib1',
      smart_playlist_id: null,
      parent_id: null,
      sort_order: 0,
      is_smart: false,
      created_at: '2026-06-27T00:00:00Z',
      updated_at: '2026-06-27T00:00:00Z',
    };
    expect(c.id).toBe('c1');
    expect(c.is_smart).toBe(false);
    expect(c.smart_playlist_id).toBeNull();
  });

  it('CreateCollectionInput requires only name + library_id', () => {
    const minimal: CreateCollectionInput = { name: 'X', library_id: 'lib1' };
    const full: CreateCollectionInput = {
      name: 'Y',
      library_id: 'lib1',
      smart_playlist_id: 'sp1',
      parent_id: 'p1',
      sort_order: 3,
    };
    expect(minimal.name).toBe('X');
    expect(full.sort_order).toBe(3);
  });

  it('UpdateCollectionInput is a fully-optional partial', () => {
    const empty: UpdateCollectionInput = {};
    const partial: UpdateCollectionInput = { name: 'Renamed' };
    expect(empty).toEqual({});
    expect(partial.name).toBe('Renamed');
  });
});
