/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/useWatchHistoryStore.ts
//
// Watch history store (P4-S6). Holds the list of recently watched items
// plus actions to delete individual items or clear all history.

import { create } from 'zustand';
import { userManager } from '../api/UserManager';
import type { MediaItem } from '../types/media';

interface WatchHistoryState {
  items: MediaItem[];
  loading: boolean;
  error: string | null;

  /** Load watch history (replace list). */
  loadHistory: () => Promise<void>;
  /** Delete a single item from history. */
  deleteItem: (mediaItemId: string) => Promise<void>;
  /** Clear all watch history. */
  clearHistory: () => Promise<void>;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  items: [] as MediaItem[],
  loading: false,
  error: null as string | null,
};

export const useWatchHistoryStore = create<WatchHistoryState>((set, get) => ({
  ...initialState,

  loadHistory: async () => {
    if (get().loading) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const items = await userManager.getRecentlyWatched();
      set({ items, loading: false });
    } catch (error) {
      set({
        error: errMessage(error, 'Failed to load watch history'),
        loading: false,
      });
    }
  },

  deleteItem: async (mediaItemId) => {
    try {
      await userManager.deleteHistoryItem(mediaItemId);
      set((state) => ({
        items: state.items.filter((i) => i.id !== mediaItemId),
      }));
    } catch (error) {
      set({ error: errMessage(error, 'Failed to delete item') });
      throw error;
    }
  },

  clearHistory: async () => {
    try {
      await userManager.clearHistory();
      set({ items: [] });
    } catch (error) {
      set({ error: errMessage(error, 'Failed to clear history') });
      throw error;
    }
  },
}));