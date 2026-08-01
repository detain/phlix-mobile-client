/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useLibraryStore.test.ts
import { useLibraryStore } from '../useLibraryStore';
import type { MediaItem, Library } from '../../types/media';

const item = (id: string, name: string): MediaItem => ({ id, name, type: 'movie' });

const library: Library = {
  id: 'lib-1',
  name: 'Movies',
  type: 'movie',
  item_count: 42,
};

describe('useLibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      libraries: [],
      libraryItems: {},
      recentlyAdded: [],
      continueWatching: [],
      searchResults: [],
      searchQuery: '',
      isSearching: false,
      isLoadingLibraries: false,
      isLoadingItems: false,
      isLoadingHome: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useLibraryStore.getState();
      expect(state.libraries).toEqual([]);
      expect(state.libraryItems).toEqual({});
      expect(state.recentlyAdded).toEqual([]);
      expect(state.continueWatching).toEqual([]);
      expect(state.searchResults).toEqual([]);
      expect(state.searchQuery).toBe('');
      expect(state.isSearching).toBe(false);
      expect(state.isLoadingLibraries).toBe(false);
      expect(state.isLoadingItems).toBe(false);
      expect(state.isLoadingHome).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setLibraries', () => {
    it('sets libraries array', () => {
      useLibraryStore.getState().setLibraries([library]);
      expect(useLibraryStore.getState().libraries).toEqual([library]);
    });
  });

  describe('setLibraryItems', () => {
    it('sets items for a specific library', () => {
      const items = [item('m1', 'Movie 1'), item('m2', 'Movie 2')];
      useLibraryStore.getState().setLibraryItems('lib-1', items);

      const state = useLibraryStore.getState();
      expect(state.libraryItems['lib-1']).toEqual(items);
    });

    it('merges with existing library items', () => {
      useLibraryStore.getState().setLibraryItems('lib-1', [item('m1', 'Movie 1')]);
      useLibraryStore.getState().setLibraryItems('lib-2', [item('m2', 'Movie 2')]);

      const state = useLibraryStore.getState();
      expect(state.libraryItems['lib-1']).toHaveLength(1);
      expect(state.libraryItems['lib-2']).toHaveLength(1);
    });

    it('overwrites items for same library', () => {
      useLibraryStore.getState().setLibraryItems('lib-1', [item('m1', 'Movie 1')]);
      useLibraryStore.getState().setLibraryItems('lib-1', [item('m2', 'Movie 2')]);

      expect(useLibraryStore.getState().libraryItems['lib-1']).toHaveLength(1);
      expect(useLibraryStore.getState().libraryItems['lib-1'][0].id).toBe('m2');
    });
  });

  describe('setRecentlyAdded', () => {
    it('sets recently added items', () => {
      const items = [item('m1', 'New Movie')];
      useLibraryStore.getState().setRecentlyAdded(items);
      expect(useLibraryStore.getState().recentlyAdded).toEqual(items);
    });
  });

  describe('setContinueWatching', () => {
    it('sets continue watching items', () => {
      const items = [item('m1', 'Continue Movie')];
      useLibraryStore.getState().setContinueWatching(items);
      expect(useLibraryStore.getState().continueWatching).toEqual(items);
    });
  });

  describe('search state', () => {
    it('setSearchResults', () => {
      const results = [item('m1', 'Search Result')];
      useLibraryStore.getState().setSearchResults(results);
      expect(useLibraryStore.getState().searchResults).toEqual(results);
    });

    it('setSearchQuery', () => {
      useLibraryStore.getState().setSearchQuery('alien');
      expect(useLibraryStore.getState().searchQuery).toBe('alien');
    });

    it('setIsSearching', () => {
      useLibraryStore.getState().setIsSearching(true);
      expect(useLibraryStore.getState().isSearching).toBe(true);
    });

    it('clearSearch resets query and results', () => {
      useLibraryStore.getState().setSearchQuery('alien');
      useLibraryStore.getState().setSearchResults([item('m1', 'Alien')]);

      useLibraryStore.getState().clearSearch();

      const state = useLibraryStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
    });
  });

  describe('loading state setters', () => {
    it('setLoadingLibraries', () => {
      useLibraryStore.getState().setLoadingLibraries(true);
      expect(useLibraryStore.getState().isLoadingLibraries).toBe(true);
    });

    it('setLoadingItems', () => {
      useLibraryStore.getState().setLoadingItems(true);
      expect(useLibraryStore.getState().isLoadingItems).toBe(true);
    });

    it('setLoadingHome', () => {
      useLibraryStore.getState().setLoadingHome(true);
      expect(useLibraryStore.getState().isLoadingHome).toBe(true);
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      useLibraryStore.getState().setError('Failed to load libraries');
      expect(useLibraryStore.getState().error).toBe('Failed to load libraries');
    });

    it('can clear error', () => {
      useLibraryStore.getState().setError('Some error');
      useLibraryStore.getState().setError(null);
      expect(useLibraryStore.getState().error).toBeNull();
    });
  });
});
