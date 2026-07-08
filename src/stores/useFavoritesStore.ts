/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/stores/useFavoritesStore.ts
//
// Favorites LIST store (slice E10 favorites). Holds the paginated list of the
// user's favorited items plus mutators that proxy FavoritesManager.
//
// Convention (matches useSearchStore/useMusicStore): the LOADER swallows errors
// into `error` (the Favorites screen renders an ErrorView). The MUTATORS
// (`toggleFavorite`/`rate`/`clearRating`) set `error` AND RETHROW so callers can
// surface an Alert + revert their own optimistic UI — the MediaDetailScreen owns
// optimistic local state for its single item; this store is the LIST.

import { create } from 'zustand';
import { favoritesManager } from '../api/FavoritesManager';
import type { MediaItem } from '../types/media';

/** Items fetched per page (server clamps `limit`). */
export const FAVORITES_PAGE_SIZE = 50;

interface FavoritesState {
  items: MediaItem[];
  offset: number;
  /** False once a page returns fewer than a full page (no more to load). */
  hasMore: boolean;
  loading: boolean;
  error: string | null;

  /** Load favorites. `reset` (default true) replaces from offset 0; false appends the next page. */
  loadFavorites: (reset?: boolean) => Promise<void>;
  /** Mark/unmark `id` as favorite to `next`. Rethrows on failure. */
  toggleFavorite: (id: string, next: boolean) => Promise<void>;
  /** Set `id`'s rating to `n` (1–10). Rethrows on failure. */
  rate: (id: string, n: number) => Promise<void>;
  /** Clear `id`'s rating. Rethrows on failure. */
  clearRating: (id: string) => Promise<void>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  items: [] as MediaItem[],
  offset: 0,
  hasMore: true,
  loading: false,
  error: null as string | null,
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ...initialState,

  loadFavorites: async (reset = true) => {
    // Reentrancy guard: a load-more must not fire while one is in flight.
    if (get().loading) {
      return;
    }
    const offset = reset ? 0 : get().offset;
    set({ loading: true, error: null });
    try {
      const res = await favoritesManager.getFavorites({
        limit: FAVORITES_PAGE_SIZE,
        offset,
      });
      const incoming = res.items ?? [];
      set((state) => ({
        items: reset ? incoming : [...state.items, ...incoming],
        offset: offset + incoming.length,
        hasMore: incoming.length >= FAVORITES_PAGE_SIZE,
        loading: false,
      }));
    } catch (error) {
      set({
        error: errMessage(error, 'Failed to load favorites'),
        loading: false,
      });
    }
  },

  toggleFavorite: async (id, next) => {
    try {
      if (next) {
        await favoritesManager.setFavorite(id);
      } else {
        await favoritesManager.removeFavorite(id);
        // When un-favoriting, drop it from the list so it disappears.
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      }
    } catch (error) {
      set({ error: errMessage(error, 'Failed to update favorite') });
      throw error;
    }
  },

  rate: async (id, n) => {
    try {
      await favoritesManager.setRating(id, n);
    } catch (error) {
      set({ error: errMessage(error, 'Failed to set rating') });
      throw error;
    }
  },

  clearRating: async (id) => {
    try {
      await favoritesManager.clearRating(id);
    } catch (error) {
      set({ error: errMessage(error, 'Failed to clear rating') });
      throw error;
    }
  },

  reset: () => set({ ...initialState }),
}));
