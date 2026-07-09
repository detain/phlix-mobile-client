/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/LibraryManager.test.ts
import { libraryManager } from '../LibraryManager';
import apiClient from '../client';

jest.mock('../client');

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('LibraryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLibraries hits /libraries and unwraps { libraries }', async () => {
    mockedClient.get.mockResolvedValue({ libraries: [{ id: 'l1', name: 'Movies', type: 'video' }] });

    const libs = await libraryManager.getLibraries();

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries');
    expect(libs).toEqual([{ id: 'l1', name: 'Movies', type: 'video' }]);
  });

  it('getLibraryItems hits /libraries/{id}/items with type/limit/offset', async () => {
    mockedClient.get.mockResolvedValue({ items: [], limit: 50, offset: 0 });

    const res = await libraryManager.getLibraryItems('lib-1', { type: 'movie', limit: 50, offset: 0 });

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries/lib-1/items', {
      type: 'movie',
      limit: 50,
      offset: 0,
    });
    expect(res.limit).toBe(50);
  });

  it('browseMedia hits /media with the full filter set', async () => {
    mockedClient.get.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await libraryManager.browseMedia({ search: 'matrix', genres: ['Action'], sort: 'year', order: 'desc' });

    expect(mockedClient.get).toHaveBeenCalledWith('/media', {
      search: 'matrix',
      genres: ['Action'],
      sort: 'year',
      order: 'desc',
    });
  });

  it('getRecentlyAdded queries /media?sort=date_added&order=desc and returns items', async () => {
    mockedClient.get.mockResolvedValue({ items: [{ id: 'm1', name: 'A', type: 'movie' }], total: 1, limit: 20, offset: 0 });

    const items = await libraryManager.getRecentlyAdded(20);

    expect(mockedClient.get).toHaveBeenCalledWith('/media', {
      sort: 'date_added',
      order: 'desc',
      limit: 20,
    });
    expect(items).toHaveLength(1);
  });

  it('getMediaItem hits /media/{id} and unwraps { item }', async () => {
    mockedClient.get.mockResolvedValue({ item: { id: 'm1', name: 'A', type: 'movie', stream_url: 'https://s/x' } });

    const item = await libraryManager.getMediaItem('m1');

    expect(mockedClient.get).toHaveBeenCalledWith('/media/m1');
    expect(item.stream_url).toBe('https://s/x');
  });

  it('getSeasons queries /media?parentId={seriesId}', async () => {
    mockedClient.get.mockResolvedValue({ items: [{ id: 's1', name: 'Season 1', type: 'season' }], total: 1, limit: 50, offset: 0 });

    await libraryManager.getSeasons('series-1');

    expect(mockedClient.get).toHaveBeenCalledWith('/media', { parentId: 'series-1' });
  });

  it('getEpisodes queries /media?parentId={seasonId}', async () => {
    mockedClient.get.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await libraryManager.getEpisodes('season-1');

    expect(mockedClient.get).toHaveBeenCalledWith('/media', { parentId: 'season-1' });
  });

  it('search queries /media?search={query} and returns items', async () => {
    mockedClient.get.mockResolvedValue({ items: [{ id: 'm1', name: 'A', type: 'movie' }], total: 1, limit: 50, offset: 0 });

    const items = await libraryManager.search('alien', { limit: 50 });

    expect(mockedClient.get).toHaveBeenCalledWith('/media', { search: 'alien', limit: 50 });
    expect(items).toHaveLength(1);
  });

  it('getLetterIndex hits /media/letter-index and returns { letters, total }', async () => {
    mockedClient.get.mockResolvedValue({
      letters: [
        { letter: '#', offset: 0, count: 2 },
        { letter: 'A', offset: 2, count: 5 },
      ],
      total: 7,
    });

    const index = await libraryManager.getLetterIndex({
      genres: ['Action'],
      libraryId: 'lib-1',
    });

    expect(mockedClient.get).toHaveBeenCalledWith('/media/letter-index', {
      genres: ['Action'],
      libraryId: 'lib-1',
    });
    expect(index.total).toBe(7);
    expect(index.letters).toHaveLength(2);
    expect(index.letters[1]).toEqual({ letter: 'A', offset: 2, count: 5 });
  });

  it('getLetterIndex defaults to no params', async () => {
    mockedClient.get.mockResolvedValue({ letters: [], total: 0 });

    await libraryManager.getLetterIndex();

    expect(mockedClient.get).toHaveBeenCalledWith('/media/letter-index', {});
  });
});
