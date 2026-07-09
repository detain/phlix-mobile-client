/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useCollectionStore.test.ts
import { useCollectionStore } from '../useCollectionStore';
import { collectionManager } from '../../api/CollectionManager';
import type { MediaItem } from '../../types/media';
import type { Collection } from '../../types/collection';

jest.mock('../../api/CollectionManager', () => ({
  collectionManager: {
    getCollections: jest.fn(),
    getCollection: jest.fn(),
    createCollection: jest.fn(),
    updateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
    refresh: jest.fn(),
    getLibraryCollections: jest.fn(),
  },
}));

const mocked = collectionManager as jest.Mocked<typeof collectionManager>;

const collection: Collection = {
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

const smart: Collection = {
  ...collection,
  id: 'c2',
  name: 'Recent',
  smart_playlist_id: 'sp1',
  is_smart: true,
};

const item: MediaItem = { id: 'm1', name: 'A Movie', type: 'movie' };

describe('useCollectionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCollectionStore.getState().reset();
  });

  // ── Loaders ──
  it('loadCollections populates collections', async () => {
    mocked.getCollections.mockResolvedValue([collection]);
    await useCollectionStore.getState().loadCollections();
    const s = useCollectionStore.getState();
    expect(s.collections).toEqual([collection]);
    expect(s.collectionsLoading).toBe(false);
    expect(s.collectionsError).toBeNull();
  });

  it('loadCollections sets collectionsError on failure', async () => {
    mocked.getCollections.mockRejectedValue(new Error('boom'));
    await useCollectionStore.getState().loadCollections();
    const s = useCollectionStore.getState();
    expect(s.collectionsError).toBe('boom');
    expect(s.collectionsLoading).toBe(false);
  });

  it('loadCollection populates currentCollection + currentItems', async () => {
    mocked.getCollection.mockResolvedValue({ collection, items: [item] });
    await useCollectionStore.getState().loadCollection('c1');
    const s = useCollectionStore.getState();
    expect(s.currentCollection).toEqual(collection);
    expect(s.currentItems).toEqual([item]);
    expect(s.currentError).toBeNull();
  });

  it('loadCollection sets currentError on failure', async () => {
    mocked.getCollection.mockRejectedValue(new Error('nope'));
    await useCollectionStore.getState().loadCollection('c1');
    expect(useCollectionStore.getState().currentError).toBe('nope');
  });

  // ── Mutators (rethrow + refresh state) ──
  it('createCollection reloads the list on success', async () => {
    mocked.createCollection.mockResolvedValue(collection);
    mocked.getCollections.mockResolvedValue([collection]);
    const result = await useCollectionStore
      .getState()
      .createCollection({ name: 'Favorites', library_id: 'lib1' });
    expect(result).toEqual(collection);
    expect(mocked.getCollections).toHaveBeenCalled();
    expect(useCollectionStore.getState().collections).toEqual([collection]);
  });

  it('createCollection rethrows + sets error on failure', async () => {
    mocked.createCollection.mockRejectedValue(new Error('fail'));
    await expect(
      useCollectionStore
        .getState()
        .createCollection({ name: 'X', library_id: 'lib1' })
    ).rejects.toThrow('fail');
    expect(useCollectionStore.getState().collectionsError).toBe('fail');
  });

  it('updateCollection replaces the collection in the list', async () => {
    useCollectionStore.setState({ collections: [collection] });
    const updated = { ...collection, name: 'Renamed' };
    mocked.updateCollection.mockResolvedValue(updated);
    await useCollectionStore.getState().updateCollection('c1', {
      name: 'Renamed',
    });
    expect(useCollectionStore.getState().collections[0].name).toBe('Renamed');
  });

  it('updateCollection rethrows on failure', async () => {
    mocked.updateCollection.mockRejectedValue(new Error('bad'));
    await expect(
      useCollectionStore.getState().updateCollection('c1', { name: 'Y' })
    ).rejects.toThrow('bad');
    expect(useCollectionStore.getState().collectionsError).toBe('bad');
  });

  it('deleteCollection removes from the list and clears current if open', async () => {
    useCollectionStore.setState({
      collections: [collection],
      currentCollection: collection,
      currentItems: [item],
    });
    mocked.deleteCollection.mockResolvedValue(undefined);
    await useCollectionStore.getState().deleteCollection('c1');
    const s = useCollectionStore.getState();
    expect(s.collections).toEqual([]);
    expect(s.currentCollection).toBeNull();
    expect(s.currentItems).toEqual([]);
  });

  it('deleteCollection rethrows on failure', async () => {
    mocked.deleteCollection.mockRejectedValue(new Error('del'));
    await expect(
      useCollectionStore.getState().deleteCollection('c1')
    ).rejects.toThrow('del');
    expect(useCollectionStore.getState().collectionsError).toBe('del');
  });

  it('addItem reloads the open collection on success', async () => {
    useCollectionStore.setState({ currentCollection: collection });
    mocked.addItem.mockResolvedValue(undefined);
    mocked.getCollection.mockResolvedValue({ collection, items: [item] });
    await useCollectionStore.getState().addItem('c1', 'm1');
    expect(mocked.addItem).toHaveBeenCalledWith('c1', 'm1');
    expect(mocked.getCollection).toHaveBeenCalledWith('c1');
    expect(useCollectionStore.getState().currentItems).toEqual([item]);
  });

  it('addItem rethrows on failure', async () => {
    useCollectionStore.setState({ currentCollection: collection });
    mocked.addItem.mockRejectedValue(new Error('add'));
    await expect(
      useCollectionStore.getState().addItem('c1', 'm1')
    ).rejects.toThrow('add');
    expect(useCollectionStore.getState().currentError).toBe('add');
  });

  it('removeItem reloads the open collection on success', async () => {
    useCollectionStore.setState({
      currentCollection: collection,
      currentItems: [item],
    });
    mocked.removeItem.mockResolvedValue(undefined);
    mocked.getCollection.mockResolvedValue({ collection, items: [] });
    await useCollectionStore.getState().removeItem('c1', 'm1');
    expect(mocked.removeItem).toHaveBeenCalledWith('c1', 'm1');
    expect(useCollectionStore.getState().currentItems).toEqual([]);
  });

  it('removeItem rethrows on failure', async () => {
    useCollectionStore.setState({ currentCollection: collection });
    mocked.removeItem.mockRejectedValue(new Error('rm'));
    await expect(
      useCollectionStore.getState().removeItem('c1', 'm1')
    ).rejects.toThrow('rm');
    expect(useCollectionStore.getState().currentError).toBe('rm');
  });

  it('refresh reloads the open smart collection on success', async () => {
    useCollectionStore.setState({ currentCollection: smart });
    mocked.refresh.mockResolvedValue(undefined);
    mocked.getCollection.mockResolvedValue({
      collection: smart,
      items: [item],
    });
    await useCollectionStore.getState().refresh('c2');
    expect(mocked.refresh).toHaveBeenCalledWith('c2');
    expect(mocked.getCollection).toHaveBeenCalledWith('c2');
    expect(useCollectionStore.getState().currentItems).toEqual([item]);
  });

  it('refresh rethrows on failure', async () => {
    useCollectionStore.setState({ currentCollection: smart });
    mocked.refresh.mockRejectedValue(new Error('rf'));
    await expect(
      useCollectionStore.getState().refresh('c2')
    ).rejects.toThrow('rf');
    expect(useCollectionStore.getState().currentError).toBe('rf');
  });
});
