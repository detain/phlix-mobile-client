/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/CollectionManager.test.ts
import { collectionManager } from '../CollectionManager';
import apiClient from '../client';
import type { MediaItem } from '../../types/media';
import type { Collection } from '../../types/collection';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleCollection: Collection = {
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

const sampleItem: MediaItem = {
  id: 'm1',
  name: 'A Movie',
  type: 'movie',
};

describe('CollectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getCollections GETs /collections and unwraps .collections', async () => {
    mockedClient.get.mockResolvedValue({ collections: [sampleCollection] });
    const result = await collectionManager.getCollections();
    expect(mockedClient.get).toHaveBeenCalledWith('/collections');
    expect(result).toEqual([sampleCollection]);
  });

  it('getCollection GETs /collections/{id} and returns the whole envelope', async () => {
    const envelope = { collection: sampleCollection, items: [sampleItem] };
    mockedClient.get.mockResolvedValue(envelope);
    const result = await collectionManager.getCollection('c1');
    expect(mockedClient.get).toHaveBeenCalledWith('/collections/c1');
    expect(result).toEqual(envelope);
  });

  it('createCollection POSTs /collections with the body and unwraps .collection', async () => {
    mockedClient.post.mockResolvedValue({ collection: sampleCollection });
    const input = { name: 'Favorites', library_id: 'lib1' };
    const result = await collectionManager.createCollection(input);
    expect(mockedClient.post).toHaveBeenCalledWith('/collections', input);
    expect(result).toEqual(sampleCollection);
  });

  it('updateCollection PUTs /collections/{id} with the partial body and unwraps .collection', async () => {
    const updated = { ...sampleCollection, name: 'Renamed' };
    mockedClient.put.mockResolvedValue({ collection: updated });
    const result = await collectionManager.updateCollection('c1', {
      name: 'Renamed',
    });
    expect(mockedClient.put).toHaveBeenCalledWith('/collections/c1', {
      name: 'Renamed',
    });
    expect(result).toEqual(updated);
  });

  it('deleteCollection DELETEs /collections/{id} and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'deleted' });
    await expect(collectionManager.deleteCollection('c1')).resolves.toBeUndefined();
    expect(mockedClient.delete).toHaveBeenCalledWith('/collections/c1');
  });

  it('addItem POSTs /collections/{id}/items/{mediaItemId} and resolves void', async () => {
    mockedClient.post.mockResolvedValue({ message: 'added' });
    await expect(collectionManager.addItem('c1', 'm1')).resolves.toBeUndefined();
    expect(mockedClient.post).toHaveBeenCalledWith('/collections/c1/items/m1');
  });

  it('removeItem DELETEs /collections/{id}/items/{mediaItemId} and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'removed' });
    await expect(
      collectionManager.removeItem('c1', 'm1')
    ).resolves.toBeUndefined();
    expect(mockedClient.delete).toHaveBeenCalledWith('/collections/c1/items/m1');
  });

  it('bulkAdd POSTs /collections/{id}/bulk-add with media_item_ids and returns the result', async () => {
    const res = { message: 'ok', added_count: 2 };
    mockedClient.post.mockResolvedValue(res);
    const result = await collectionManager.bulkAdd('c1', ['m1', 'm2']);
    expect(mockedClient.post).toHaveBeenCalledWith('/collections/c1/bulk-add', {
      media_item_ids: ['m1', 'm2'],
    });
    expect(result).toEqual(res);
  });

  it('refresh POSTs /collections/{id}/refresh and resolves void', async () => {
    mockedClient.post.mockResolvedValue({ message: 'refreshed' });
    await expect(collectionManager.refresh('c1')).resolves.toBeUndefined();
    expect(mockedClient.post).toHaveBeenCalledWith('/collections/c1/refresh');
  });

  it('getLibraryCollections GETs /libraries/{libraryId}/collections and unwraps .collections', async () => {
    mockedClient.get.mockResolvedValue({ collections: [sampleCollection] });
    const result = await collectionManager.getLibraryCollections('lib1');
    expect(mockedClient.get).toHaveBeenCalledWith(
      '/libraries/lib1/collections'
    );
    expect(result).toEqual([sampleCollection]);
  });
});
