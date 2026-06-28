// src/api/FavoritesManager.ts
import apiClient from './client';
import type { MediaItem } from '../types/media';

/**
 * Favorites / ratings API surface (slice E10 favorites) — account-level
 * (per-USER, not per-profile), all Bearer-gated. The apiClient baseURL already
 * adds `/api/v1`, so paths start `/media` / `/users`.
 *
 * Routes + envelopes (verified against phlix-server MediaUserDataController):
 *   - POST   /media/{id}/favorite          → { message }   (mark favorite)
 *   - DELETE /media/{id}/favorite          → { message }   (un-favorite)
 *   - PUT    /media/{id}/rating  {rating}  → { message }   (set 1–10; 400 out
 *                                            of range/non-numeric, 404 missing)
 *   - DELETE /media/{id}/rating            → { message }   (clear)
 *   - GET    /users/me/favorites?limit&offset
 *                                          → { items: MediaItem[], limit, offset }
 *                                            (each item carries a `user_data`
 *                                            block `{favorite, rating}`)
 *
 * The `{message}` write envelopes carry no payload the client needs, so the
 * mutation methods resolve to `void`. Errors bubble — the store/screen owns the
 * try/catch + optimistic revert. Field names are the server payload verbatim
 * (snake_case `user_data`/`rating`); do NOT camelCase.
 *
 * The detail item's favorite/rating state is read off `MediaItem.user_data`
 * from `GET /media/{id}` (LibraryManager.getMediaItem) — this manager only
 * MUTATES that state and lists the favorited items.
 */

/** Whole envelope returned by `GET /users/me/favorites`. */
export interface FavoritesResponse {
  items: MediaItem[];
  limit: number;
  offset: number;
}

class FavoritesManager {
  // POST /api/v1/media/{id}/favorite → { message }
  async setFavorite(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(
      `/media/${encodeURIComponent(id)}/favorite`
    );
  }

  // DELETE /api/v1/media/{id}/favorite → { message }
  async removeFavorite(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(
      `/media/${encodeURIComponent(id)}/favorite`
    );
  }

  // PUT /api/v1/media/{id}/rating  body { rating } → { message }
  // `rating` is an integer 1–10; the server 400s out-of-range/non-numeric.
  async setRating(id: string, rating: number): Promise<void> {
    await apiClient.put<{ message: string }>(
      `/media/${encodeURIComponent(id)}/rating`,
      { rating }
    );
  }

  // DELETE /api/v1/media/{id}/rating → { message }
  async clearRating(id: string): Promise<void> {
    await apiClient.delete<{ message: string }>(
      `/media/${encodeURIComponent(id)}/rating`
    );
  }

  // GET /api/v1/users/me/favorites?limit&offset → { items, limit, offset }
  async getFavorites(
    opts: { limit?: number; offset?: number } = {}
  ): Promise<FavoritesResponse> {
    const params: Record<string, number> = {};
    if (opts.limit !== undefined) {
      params.limit = opts.limit;
    }
    if (opts.offset !== undefined) {
      params.offset = opts.offset;
    }
    return apiClient.get<FavoritesResponse>('/users/me/favorites', params);
  }
}

export const favoritesManager = new FavoritesManager();
export default favoritesManager;
