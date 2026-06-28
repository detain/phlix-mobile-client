// src/stores/useSearchStore.ts
//
// Advanced-search store (slice E10b). Holds the text query, advanced filters,
// paginated results, the A–Z letter index, and section-scoped loading/error.
//
// Convention (matches useMusicStore/useLiveTvStore): LOADERS swallow errors into
// the section `*Error` (screens render an ErrorView). The text query + filters
// are plain setters; `search`/`loadLetterIndex`/`jumpToLetter` perform I/O.
//
// `search(reset)` paginates via `libraryManager.browseMedia`: on `reset` it
// replaces results from offset 0; otherwise it appends the next page. The page
// size is fixed; `jumpToLetter` re-anchors the result window at a letter's
// cumulative offset (from the letter index).

import { create } from 'zustand';
import { libraryManager } from '../api/LibraryManager';
import type { MediaItem } from '../types/media';
import type { MediaFilters, LetterIndex } from '../types/search';
import { buildBrowseParams } from '../types/search';
import { offsetForLetter } from '../screens/search/searchScreenHelpers';

/** Items fetched per page (server clamps `limit` to 1–100). */
export const SEARCH_PAGE_SIZE = 50;

interface SearchState {
  query: string;
  filters: MediaFilters;

  results: MediaItem[];
  total: number;
  offset: number;
  loading: boolean;
  error: string | null;

  letterIndex: LetterIndex | null;
  letterIndexLoading: boolean;
  letterIndexError: string | null;

  // Setters
  setQuery: (query: string) => void;
  setFilters: (filters: MediaFilters) => void;

  // I/O
  /** Run the query+filters. `reset` (default true) replaces from offset 0; false appends the next page. */
  search: (reset?: boolean) => Promise<void>;
  /** Load the A–Z letter index for the current filters (no text query). */
  loadLetterIndex: () => Promise<void>;
  /** Jump the result window to a letter's cumulative offset (from the index). */
  jumpToLetter: (letter: string) => Promise<void>;

  reset: () => void;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const initialState = {
  query: '',
  filters: {} as MediaFilters,
  results: [] as MediaItem[],
  total: 0,
  offset: 0,
  loading: false,
  error: null as string | null,
  letterIndex: null as LetterIndex | null,
  letterIndexLoading: false,
  letterIndexError: null as string | null,
};

export const useSearchStore = create<SearchState>((set, get) => ({
  ...initialState,

  setQuery: (query) => set({ query }),
  setFilters: (filters) => set({ filters }),

  search: async (reset = true) => {
    if (get().loading) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const { query, filters } = get();
      const startOffset = reset ? 0 : get().offset;
      const params = buildBrowseParams(query, filters);
      const res = await libraryManager.browseMedia({
        ...params,
        limit: SEARCH_PAGE_SIZE,
        offset: startOffset,
      });
      set((s) => ({
        results: reset ? res.items : [...s.results, ...res.items],
        total: res.total ?? res.items.length,
        offset: startOffset + res.items.length,
        loading: false,
      }));
    } catch (error) {
      set({ error: errMessage(error, 'Search failed'), loading: false });
    }
  },

  loadLetterIndex: async () => {
    set({ letterIndexLoading: true, letterIndexError: null });
    try {
      const { query, filters } = get();
      const params = buildBrowseParams(query, filters);
      const letterIndex = await libraryManager.getLetterIndex(params);
      set({ letterIndex, letterIndexLoading: false });
    } catch (error) {
      set({
        letterIndexError: errMessage(error, 'Failed to load index'),
        letterIndexLoading: false,
      });
    }
  },

  jumpToLetter: async (letter) => {
    const startOffset = offsetForLetter(get().letterIndex, letter);
    if (startOffset === null || get().loading) {
      return;
    }
    set({ loading: true, error: null, offset: startOffset });
    try {
      const { query, filters } = get();
      const params = buildBrowseParams(query, filters);
      const res = await libraryManager.browseMedia({
        ...params,
        limit: SEARCH_PAGE_SIZE,
        offset: startOffset,
      });
      set({
        results: res.items,
        total: res.total ?? res.items.length,
        offset: startOffset + res.items.length,
        loading: false,
      });
    } catch (error) {
      set({ error: errMessage(error, 'Jump failed'), loading: false });
    }
  },

  reset: () => set({ ...initialState, filters: {} }),
}));
