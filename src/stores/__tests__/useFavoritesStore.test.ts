/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useFavoritesStore.test.ts
import {
  useFavoritesStore,
  FAVORITES_PAGE_SIZE,
} from '../useFavoritesStore';
import { favoritesManager } from '../../api/FavoritesManager';
import type { MediaItem } from '../../types/media';

jest.mock('../../api/FavoritesManager', () => ({
  favoritesManager: {
    getFavorites: jest.fn(),
    setFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    setRating: jest.fn(),
    clearRating: jest.fn(),
  },
}));

const mocked = favoritesManager as jest.Mocked<typeof favoritesManager>;

const makeItem = (id: string): MediaItem => ({
  id,
  name: `Item ${id}`,
  type: 'movie',
});

const fullPage = (): MediaItem[] =>
  Array.from({ length: FAVORITES_PAGE_SIZE }, (_, i) => makeItem(`f${i}`));

describe('useFavoritesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFavoritesStore.getState().reset();
  });

  // ── Loader ──
  it('loadFavorites(reset) replaces items from offset 0', async () => {
    mocked.getFavorites.mockResolvedValue({
      items: [makeItem('a')],
      limit: FAVORITES_PAGE_SIZE,
      offset: 0,
    });
    await useFavoritesStore.getState().loadFavorites(true);
    const s = useFavoritesStore.getState();
    expect(mocked.getFavorites).toHaveBeenCalledWith({
      limit: FAVORITES_PAGE_SIZE,
      offset: 0,
    });
    expect(s.items.map((i) => i.id)).toEqual(['a']);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    // One short page → no more.
    expect(s.hasMore).toBe(false);
  });

  it('loadFavorites(false) appends the next page at the advanced offset', async () => {
    // First page is full → hasMore true, offset advances.
    mocked.getFavorites.mockResolvedValueOnce({
      items: fullPage(),
      limit: FAVORITES_PAGE_SIZE,
      offset: 0,
    });
    await useFavoritesStore.getState().loadFavorites(true);
    expect(useFavoritesStore.getState().hasMore).toBe(true);
    expect(useFavoritesStore.getState().offset).toBe(FAVORITES_PAGE_SIZE);

    mocked.getFavorites.mockResolvedValueOnce({
      items: [makeItem('z')],
      limit: FAVORITES_PAGE_SIZE,
      offset: FAVORITES_PAGE_SIZE,
    });
    await useFavoritesStore.getState().loadFavorites(false);
    expect(mocked.getFavorites).toHaveBeenLastCalledWith({
      limit: FAVORITES_PAGE_SIZE,
      offset: FAVORITES_PAGE_SIZE,
    });
    const s = useFavoritesStore.getState();
    expect(s.items).toHaveLength(FAVORITES_PAGE_SIZE + 1);
    expect(s.items[s.items.length - 1].id).toBe('z');
    expect(s.hasMore).toBe(false);
  });

  it('loadFavorites sets error on failure', async () => {
    mocked.getFavorites.mockRejectedValue(new Error('boom'));
    await useFavoritesStore.getState().loadFavorites(true);
    const s = useFavoritesStore.getState();
    expect(s.error).toBe('boom');
    expect(s.loading).toBe(false);
  });

  it('loadFavorites is reentrancy-guarded while loading', async () => {
    useFavoritesStore.setState({ loading: true });
    await useFavoritesStore.getState().loadFavorites(true);
    expect(mocked.getFavorites).not.toHaveBeenCalled();
  });

  // ── Mutators ──
  it('toggleFavorite(true) calls setFavorite', async () => {
    mocked.setFavorite.mockResolvedValue(undefined);
    await useFavoritesStore.getState().toggleFavorite('m1', true);
    expect(mocked.setFavorite).toHaveBeenCalledWith('m1');
  });

  it('toggleFavorite(false) removes the item from the list', async () => {
    useFavoritesStore.setState({ items: [makeItem('m1'), makeItem('m2')] });
    mocked.removeFavorite.mockResolvedValue(undefined);
    await useFavoritesStore.getState().toggleFavorite('m1', false);
    expect(mocked.removeFavorite).toHaveBeenCalledWith('m1');
    expect(useFavoritesStore.getState().items.map((i) => i.id)).toEqual(['m2']);
  });

  it('toggleFavorite rethrows + sets error on failure', async () => {
    mocked.setFavorite.mockRejectedValue(new Error('fav'));
    await expect(
      useFavoritesStore.getState().toggleFavorite('m1', true)
    ).rejects.toThrow('fav');
    expect(useFavoritesStore.getState().error).toBe('fav');
  });

  it('rate calls setRating', async () => {
    mocked.setRating.mockResolvedValue(undefined);
    await useFavoritesStore.getState().rate('m1', 8);
    expect(mocked.setRating).toHaveBeenCalledWith('m1', 8);
  });

  it('rate rethrows + sets error on failure', async () => {
    mocked.setRating.mockRejectedValue(new Error('rate'));
    await expect(
      useFavoritesStore.getState().rate('m1', 8)
    ).rejects.toThrow('rate');
    expect(useFavoritesStore.getState().error).toBe('rate');
  });

  it('clearRating calls clearRating', async () => {
    mocked.clearRating.mockResolvedValue(undefined);
    await useFavoritesStore.getState().clearRating('m1');
    expect(mocked.clearRating).toHaveBeenCalledWith('m1');
  });

  it('clearRating rethrows + sets error on failure', async () => {
    mocked.clearRating.mockRejectedValue(new Error('clr'));
    await expect(
      useFavoritesStore.getState().clearRating('m1')
    ).rejects.toThrow('clr');
    expect(useFavoritesStore.getState().error).toBe('clr');
  });
});
