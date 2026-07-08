/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/stores/useCollectionStore.ts
import { create } from 'zustand';
import { collectionManager } from '../api/CollectionManager';
import type { MediaItem } from '../types/media';
import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../types/collection';

/**
 * Collections store (slice E10a). Holds the full collection list plus the
 * currently-open collection and its items, with section-scoped loading/error.
 *
 * Convention (matches useLiveTvStore):
 *   - LOADERS (`loadCollections`, `loadCollection`) swallow errors into the
 *     section `*Error` (screens render an ErrorView).
 *   - MUTATORS (`createCollection`/`updateCollection`/`deleteCollection`/
 *     `addItem`/`removeItem`/`refresh`) set `error` AND rethrow so the calling
 *     screen can surface an Alert, then refresh the relevant state on success
 *     (create/delete reload the list; addItem/removeItem/refresh reload the
 *     currently-open collection).
 */
interface CollectionState {
  // List of all collections
  collections: Collection[];
  collectionsLoading: boolean;
  collectionsError: string | null;

  // Currently-open collection + its items
  currentCollection: Collection | null;
  currentItems: MediaItem[];
  currentLoading: boolean;
  currentError: string | null;

  // Loaders (swallow → section error)
  loadCollections: () => Promise<void>;
  loadCollection: (id: string) => Promise<void>;

  // Mutators (rethrow)
  createCollection: (input: CreateCollectionInput) => Promise<Collection>;
  updateCollection: (
    id: string,
    input: UpdateCollectionInput
  ) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  addItem: (id: string, mediaItemId: string) => Promise<void>;
  removeItem: (id: string, mediaItemId: string) => Promise<void>;
  refresh: (id: string) => Promise<void>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  collections: [] as Collection[],
  collectionsLoading: false,
  collectionsError: null as string | null,
  currentCollection: null as Collection | null,
  currentItems: [] as MediaItem[],
  currentLoading: false,
  currentError: null as string | null,
};

export const useCollectionStore = create<CollectionState>((set, get) => ({
  ...initialState,

  // ── Loaders ──
  loadCollections: async () => {
    set({ collectionsLoading: true, collectionsError: null });
    try {
      const collections = await collectionManager.getCollections();
      set({ collections, collectionsLoading: false });
    } catch (error) {
      set({
        collectionsError: errMessage(error, 'Failed to load collections'),
        collectionsLoading: false,
      });
    }
  },

  loadCollection: async (id: string) => {
    set({ currentLoading: true, currentError: null });
    try {
      const { collection, items } = await collectionManager.getCollection(id);
      set({
        currentCollection: collection,
        currentItems: items,
        currentLoading: false,
      });
    } catch (error) {
      set({
        currentError: errMessage(error, 'Failed to load collection'),
        currentLoading: false,
      });
    }
  },

  // ── Mutators (rethrow) ──
  createCollection: async (input: CreateCollectionInput) => {
    set({ collectionsError: null });
    try {
      const collection = await collectionManager.createCollection(input);
      // Reload the list so the new collection appears in order.
      await get().loadCollections();
      return collection;
    } catch (error) {
      set({ collectionsError: errMessage(error, 'Failed to create collection') });
      throw error;
    }
  },

  updateCollection: async (id: string, input: UpdateCollectionInput) => {
    set({ collectionsError: null });
    try {
      const collection = await collectionManager.updateCollection(id, input);
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? collection : c
        ),
        currentCollection:
          state.currentCollection?.id === id
            ? collection
            : state.currentCollection,
      }));
      return collection;
    } catch (error) {
      set({ collectionsError: errMessage(error, 'Failed to update collection') });
      throw error;
    }
  },

  deleteCollection: async (id: string) => {
    set({ collectionsError: null });
    try {
      await collectionManager.deleteCollection(id);
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
        currentCollection:
          state.currentCollection?.id === id ? null : state.currentCollection,
        currentItems:
          state.currentCollection?.id === id ? [] : state.currentItems,
      }));
    } catch (error) {
      set({ collectionsError: errMessage(error, 'Failed to delete collection') });
      throw error;
    }
  },

  addItem: async (id: string, mediaItemId: string) => {
    set({ currentError: null });
    try {
      await collectionManager.addItem(id, mediaItemId);
      // Reload the open collection so its items reflect the change.
      if (get().currentCollection?.id === id) {
        await get().loadCollection(id);
      }
    } catch (error) {
      set({ currentError: errMessage(error, 'Failed to add item') });
      throw error;
    }
  },

  removeItem: async (id: string, mediaItemId: string) => {
    set({ currentError: null });
    try {
      await collectionManager.removeItem(id, mediaItemId);
      if (get().currentCollection?.id === id) {
        await get().loadCollection(id);
      } else {
        set((state) => ({
          currentItems: state.currentItems.filter(
            (item) => item.id !== mediaItemId
          ),
        }));
      }
    } catch (error) {
      set({ currentError: errMessage(error, 'Failed to remove item') });
      throw error;
    }
  },

  refresh: async (id: string) => {
    set({ currentError: null });
    try {
      await collectionManager.refresh(id);
      // Re-pull the open collection so refreshed smart-playlist items appear.
      if (get().currentCollection?.id === id) {
        await get().loadCollection(id);
      }
    } catch (error) {
      set({ currentError: errMessage(error, 'Failed to refresh collection') });
      throw error;
    }
  },

  reset: () => set({ ...initialState }),
}));
