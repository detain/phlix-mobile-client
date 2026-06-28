// src/api/CollectionManager.ts
import apiClient from './client';
import type { MediaItem } from '../types/media';
import type {
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../types/collection';

/**
 * Collections API surface (slice E10a) — `CollectionController`, all
 * Bearer-gated (NOT admin-gated). A collection groups media items within one
 * library; smart collections (`is_smart`) are evaluated from a saved smart
 * playlist and can only be refreshed, not hand-edited.
 *
 * The apiClient baseURL already adds `/api/v1`, so paths start `/collections`.
 *
 * Envelopes (verified against CollectionController):
 *   - GET    /collections                          → { collections }
 *   - POST   /collections                          → { collection }
 *   - GET    /collections/{id}                      → { collection, items }
 *   - PUT    /collections/{id}                      → { collection }
 *   - DELETE /collections/{id}                      → { message }
 *   - POST   /collections/{id}/items/{mediaItemId}  → { message }
 *   - DELETE /collections/{id}/items/{mediaItemId}  → { message }
 *   - POST   /collections/{id}/bulk-add             → { message, added_count }
 *   - POST   /collections/{id}/refresh              → { message }
 *   - GET    /libraries/{libraryId}/collections     → { collections }
 *
 * Field names are the server payload verbatim (snake_case); do NOT camelCase.
 *
 * LOADERS-vs-mutators: this manager just performs the HTTP and unwraps the
 * envelope — errors bubble up. The store (`useCollectionStore`) owns the
 * try/catch (loaders swallow, mutators rethrow).
 */

/** Whole envelope returned by `GET /collections/{id}`. */
export interface CollectionWithItems {
  collection: Collection;
  items: MediaItem[];
}

/** Result of `POST /collections/{id}/bulk-add`. */
export interface BulkAddResult {
  message: string;
  added_count: number;
}

class CollectionManager {
  // GET /api/v1/collections → { collections }
  async getCollections(): Promise<Collection[]> {
    const res = await apiClient.get<{ collections: Collection[] }>(
      '/collections'
    );
    return res.collections;
  }

  // GET /api/v1/collections/{id} → { collection, items }
  async getCollection(id: string): Promise<CollectionWithItems> {
    return apiClient.get<CollectionWithItems>(`/collections/${id}`);
  }

  // POST /api/v1/collections → 201 { collection }
  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    const res = await apiClient.post<{ collection: Collection }>(
      '/collections',
      input
    );
    return res.collection;
  }

  // PUT /api/v1/collections/{id} (partial body) → { collection }
  async updateCollection(
    id: string,
    input: UpdateCollectionInput
  ): Promise<Collection> {
    const res = await apiClient.put<{ collection: Collection }>(
      `/collections/${id}`,
      input
    );
    return res.collection;
  }

  // DELETE /api/v1/collections/{id} → { message }
  async deleteCollection(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/collections/${id}`);
  }

  // POST /api/v1/collections/{id}/items/{mediaItemId} → { message }
  async addItem(id: string, mediaItemId: string): Promise<void> {
    await apiClient.post<{ message: string }>(
      `/collections/${id}/items/${mediaItemId}`
    );
  }

  // DELETE /api/v1/collections/{id}/items/{mediaItemId} → { message }
  async removeItem(id: string, mediaItemId: string): Promise<void> {
    await apiClient.delete<{ message: string }>(
      `/collections/${id}/items/${mediaItemId}`
    );
  }

  // POST /api/v1/collections/{id}/bulk-add → { message, added_count }
  async bulkAdd(id: string, mediaItemIds: string[]): Promise<BulkAddResult> {
    return apiClient.post<BulkAddResult>(`/collections/${id}/bulk-add`, {
      media_item_ids: mediaItemIds,
    });
  }

  // POST /api/v1/collections/{id}/refresh (smart only) → { message }
  async refresh(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/collections/${id}/refresh`);
  }

  // GET /api/v1/libraries/{libraryId}/collections → { collections }
  async getLibraryCollections(libraryId: string): Promise<Collection[]> {
    const res = await apiClient.get<{ collections: Collection[] }>(
      `/libraries/${libraryId}/collections`
    );
    return res.collections;
  }
}

export const collectionManager = new CollectionManager();
export default collectionManager;
