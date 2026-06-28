// src/api/__tests__/FavoritesManager.test.ts
import { favoritesManager } from '../FavoritesManager';
import apiClient from '../client';
import type { MediaItem } from '../../types/media';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleItem: MediaItem = {
  id: 'm1',
  name: 'A Movie',
  type: 'movie',
  user_data: { favorite: true, rating: 8 },
};

describe('FavoritesManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('setFavorite POSTs /media/{id}/favorite and resolves void', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });
    await expect(favoritesManager.setFavorite('m1')).resolves.toBeUndefined();
    expect(mockedClient.post).toHaveBeenCalledWith('/media/m1/favorite');
  });

  it('setFavorite URL-encodes the id', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });
    await favoritesManager.setFavorite('a/b');
    expect(mockedClient.post).toHaveBeenCalledWith('/media/a%2Fb/favorite');
  });

  it('removeFavorite DELETEs /media/{id}/favorite and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });
    await expect(favoritesManager.removeFavorite('m1')).resolves.toBeUndefined();
    expect(mockedClient.delete).toHaveBeenCalledWith('/media/m1/favorite');
  });

  it('setRating PUTs /media/{id}/rating with a {rating} body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'ok' });
    await expect(favoritesManager.setRating('m1', 7)).resolves.toBeUndefined();
    expect(mockedClient.put).toHaveBeenCalledWith('/media/m1/rating', {
      rating: 7,
    });
  });

  it('clearRating DELETEs /media/{id}/rating and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });
    await expect(favoritesManager.clearRating('m1')).resolves.toBeUndefined();
    expect(mockedClient.delete).toHaveBeenCalledWith('/media/m1/rating');
  });

  it('getFavorites GETs /users/me/favorites and returns the whole envelope', async () => {
    const envelope = { items: [sampleItem], limit: 50, offset: 0 };
    mockedClient.get.mockResolvedValue(envelope);
    const result = await favoritesManager.getFavorites({ limit: 50, offset: 0 });
    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/favorites', {
      limit: 50,
      offset: 0,
    });
    expect(result).toEqual(envelope);
  });

  it('getFavorites with no opts sends an empty params object', async () => {
    mockedClient.get.mockResolvedValue({ items: [], limit: 50, offset: 0 });
    await favoritesManager.getFavorites();
    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/favorites', {});
  });

  it('getFavorites omits an undefined offset', async () => {
    mockedClient.get.mockResolvedValue({ items: [], limit: 10, offset: 0 });
    await favoritesManager.getFavorites({ limit: 10 });
    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/favorites', {
      limit: 10,
    });
  });

  it('propagates errors from the client', async () => {
    mockedClient.post.mockRejectedValue(new Error('boom'));
    await expect(favoritesManager.setFavorite('m1')).rejects.toThrow('boom');
  });
});
