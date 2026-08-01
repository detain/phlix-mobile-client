/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useWatchHistoryStore.test.ts
import { useWatchHistoryStore } from '../useWatchHistoryStore';
import { userManager } from '../../api/UserManager';
import type { MediaItem } from '../../types/media';

jest.mock('../../api/UserManager', () => ({
  userManager: {
    getRecentlyWatched: jest.fn(),
    deleteHistoryItem: jest.fn(),
    clearHistory: jest.fn(),
  },
}));

const mockedUserManager = userManager as jest.Mocked<typeof userManager>;

const item = (id: string): MediaItem => ({ id, name: 'Test', type: 'movie' });

describe('useWatchHistoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWatchHistoryStore.setState({
      items: [],
      loading: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useWatchHistoryStore.getState();
      expect(state.items).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadHistory', () => {
    it('loads recently watched items', async () => {
      const items = [item('m1'), item('m2')];
      mockedUserManager.getRecentlyWatched.mockResolvedValue(items);

      await useWatchHistoryStore.getState().loadHistory();

      expect(mockedUserManager.getRecentlyWatched).toHaveBeenCalled();
      expect(useWatchHistoryStore.getState().items).toEqual(items);
      expect(useWatchHistoryStore.getState().loading).toBe(false);
      expect(useWatchHistoryStore.getState().error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockedUserManager.getRecentlyWatched.mockRejectedValue(new Error('network error'));

      await useWatchHistoryStore.getState().loadHistory();

      expect(useWatchHistoryStore.getState().error).toBe('network error');
      expect(useWatchHistoryStore.getState().loading).toBe(false);
    });

    it('uses fallback error message', async () => {
      mockedUserManager.getRecentlyWatched.mockRejectedValue('not an error object');

      await useWatchHistoryStore.getState().loadHistory();

      expect(useWatchHistoryStore.getState().error).toBe('Failed to load watch history');
    });

    it('early returns if already loading', async () => {
      useWatchHistoryStore.setState({ loading: true });
      mockedUserManager.getRecentlyWatched.mockResolvedValue([item('m1')]);

      await useWatchHistoryStore.getState().loadHistory();

      expect(mockedUserManager.getRecentlyWatched).not.toHaveBeenCalled();
    });

    it('clears previous error on successful load', async () => {
      useWatchHistoryStore.setState({ error: 'previous error' });
      mockedUserManager.getRecentlyWatched.mockResolvedValue([item('m1')]);

      await useWatchHistoryStore.getState().loadHistory();

      expect(useWatchHistoryStore.getState().error).toBeNull();
    });
  });

  describe('deleteItem', () => {
    it('removes item from list after deletion', async () => {
      useWatchHistoryStore.setState({ items: [item('m1'), item('m2'), item('m3')] });
      mockedUserManager.deleteHistoryItem.mockResolvedValue(undefined);

      await useWatchHistoryStore.getState().deleteItem('m2');

      expect(mockedUserManager.deleteHistoryItem).toHaveBeenCalledWith('m2');
      expect(useWatchHistoryStore.getState().items).toHaveLength(2);
      expect(useWatchHistoryStore.getState().items.map((i) => i.id)).toEqual(['m1', 'm3']);
    });

    it('sets error on deletion failure and throws', async () => {
      useWatchHistoryStore.setState({ items: [item('m1')] });
      mockedUserManager.deleteHistoryItem.mockRejectedValue(new Error('delete failed'));

      await expect(useWatchHistoryStore.getState().deleteItem('m1')).rejects.toThrow('delete failed');
      expect(useWatchHistoryStore.getState().error).toBe('delete failed');
    });

    it('uses fallback error message on deletion failure', async () => {
      useWatchHistoryStore.setState({ items: [item('m1')] });
      mockedUserManager.deleteHistoryItem.mockRejectedValue(null);

      await expect(useWatchHistoryStore.getState().deleteItem('m1')).rejects.toThrow();
      expect(useWatchHistoryStore.getState().error).toBe('Failed to delete item');
    });

    it('keeps other items when one deletion fails', async () => {
      useWatchHistoryStore.setState({ items: [item('m1'), item('m2')] });
      mockedUserManager.deleteHistoryItem
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('failed'));

      // First deletion should work
      await useWatchHistoryStore.getState().deleteItem('m1');
      expect(useWatchHistoryStore.getState().items).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('clears all items after API call', async () => {
      useWatchHistoryStore.setState({ items: [item('m1'), item('m2')] });
      mockedUserManager.clearHistory.mockResolvedValue(undefined);

      await useWatchHistoryStore.getState().clearHistory();

      expect(mockedUserManager.clearHistory).toHaveBeenCalled();
      expect(useWatchHistoryStore.getState().items).toEqual([]);
    });

    it('sets error on clear failure and throws', async () => {
      useWatchHistoryStore.setState({ items: [item('m1')] });
      mockedUserManager.clearHistory.mockRejectedValue(new Error('clear failed'));

      await expect(useWatchHistoryStore.getState().clearHistory()).rejects.toThrow('clear failed');
      expect(useWatchHistoryStore.getState().error).toBe('clear failed');
    });

    it('keeps items when clear fails', async () => {
      useWatchHistoryStore.setState({ items: [item('m1')] });
      mockedUserManager.clearHistory.mockRejectedValue(new Error('clear failed'));

      await expect(useWatchHistoryStore.getState().clearHistory()).rejects.toThrow();
      expect(useWatchHistoryStore.getState().items).toHaveLength(1);
    });
  });
});
