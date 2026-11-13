/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useSearchStore.test.ts
import { useSearchStore, SEARCH_PAGE_SIZE } from '../useSearchStore';
import { libraryManager } from '../../api/LibraryManager';
import type { MediaItem } from '../../types/media';

jest.mock('../../api/LibraryManager', () => ({
  libraryManager: {
    browseMedia: jest.fn(),
    getLetterIndex: jest.fn(),
  },
}));

const mocked = libraryManager as jest.Mocked<typeof libraryManager>;

const item = (id: string, name: string): MediaItem => ({ id, name, type: 'movie' });

describe('useSearchStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSearchStore.getState().reset();
  });

  it('search(reset) populates results, total and offset', async () => {
    mocked.browseMedia.mockResolvedValue({
      items: [item('m1', 'Alien'), item('m2', 'Aliens')],
      total: 5,
      limit: SEARCH_PAGE_SIZE,
      offset: 0,
    });

    useSearchStore.getState().setQuery('alien');
    await useSearchStore.getState().search(true);

    const s = useSearchStore.getState();
    expect(mocked.browseMedia).toHaveBeenCalledWith({
      search: 'alien',
      limit: SEARCH_PAGE_SIZE,
      offset: 0,
    });
    expect(s.results).toHaveLength(2);
    expect(s.total).toBe(5);
    expect(s.offset).toBe(2);
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('search(false) appends the next page at the current offset', async () => {
    mocked.browseMedia
      .mockResolvedValueOnce({
        items: [item('m1', 'A'), item('m2', 'B')],
        total: 4,
        limit: SEARCH_PAGE_SIZE,
        offset: 0,
      })
      .mockResolvedValueOnce({
        items: [item('m3', 'C'), item('m4', 'D')],
        total: 4,
        limit: SEARCH_PAGE_SIZE,
        offset: 2,
      });

    useSearchStore.getState().setQuery('x');
    await useSearchStore.getState().search(true);
    await useSearchStore.getState().search(false);

    const s = useSearchStore.getState();
    expect(s.results.map((r) => r.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(s.offset).toBe(4);
    expect(mocked.browseMedia).toHaveBeenLastCalledWith({
      search: 'x',
      limit: SEARCH_PAGE_SIZE,
      offset: 2,
    });
  });

  it('search maps advanced filters into browse params', async () => {
    mocked.browseMedia.mockResolvedValue({
      items: [],
      total: 0,
      limit: SEARCH_PAGE_SIZE,
      offset: 0,
    });

    useSearchStore.getState().setFilters({
      genres: ['Action'],
      ratings: ['R'],
      yearFrom: 2000,
      sort: 'year',
      order: 'desc',
      libraryId: 'lib-1',
    });
    await useSearchStore.getState().search(true);

    expect(mocked.browseMedia).toHaveBeenCalledWith({
      genres: ['Action'],
      ratings: ['R'],
      yearFrom: 2000,
      sort: 'year',
      order: 'desc',
      libraryId: 'lib-1',
      limit: SEARCH_PAGE_SIZE,
      offset: 0,
    });
  });

  it('search swallows errors into error', async () => {
    mocked.browseMedia.mockRejectedValue(new Error('boom'));
    await useSearchStore.getState().search(true);
    const s = useSearchStore.getState();
    expect(s.error).toBe('boom');
    expect(s.loading).toBe(false);
  });

  it('loadLetterIndex populates the letter index', async () => {
    mocked.getLetterIndex.mockResolvedValue({
      letters: [
        { letter: 'A', offset: 0, count: 3 },
        { letter: 'B', offset: 3, count: 2 },
      ],
      total: 5,
    });

    await useSearchStore.getState().loadLetterIndex();

    const s = useSearchStore.getState();
    expect(s.letterIndex?.total).toBe(5);
    expect(s.letterIndex?.letters).toHaveLength(2);
    expect(s.letterIndexError).toBeNull();
  });

  it('loadLetterIndex swallows errors into letterIndexError', async () => {
    mocked.getLetterIndex.mockRejectedValue(new Error('idx'));
    await useSearchStore.getState().loadLetterIndex();
    expect(useSearchStore.getState().letterIndexError).toBe('idx');
  });

  it('jumpToLetter fetches at the letter cumulative offset', async () => {
    mocked.getLetterIndex.mockResolvedValue({
      letters: [
        { letter: 'A', offset: 0, count: 10 },
        { letter: 'M', offset: 10, count: 4 },
      ],
      total: 14,
    });
    await useSearchStore.getState().loadLetterIndex();

    mocked.browseMedia.mockResolvedValue({
      items: [item('m1', 'Matrix')],
      total: 14,
      limit: SEARCH_PAGE_SIZE,
      offset: 10,
    });

    await useSearchStore.getState().jumpToLetter('M');

    const s = useSearchStore.getState();
    expect(mocked.browseMedia).toHaveBeenCalledWith({
      limit: SEARCH_PAGE_SIZE,
      offset: 10,
    });
    expect(s.results.map((r) => r.id)).toEqual(['m1']);
    expect(s.offset).toBe(11);
  });

  it('jumpToLetter is a no-op for a letter not in the index', async () => {
    mocked.getLetterIndex.mockResolvedValue({
      letters: [{ letter: 'A', offset: 0, count: 1 }],
      total: 1,
    });
    await useSearchStore.getState().loadLetterIndex();

    await useSearchStore.getState().jumpToLetter('Z');

    expect(mocked.browseMedia).not.toHaveBeenCalled();
  });

  it('reset restores the initial state', async () => {
    mocked.browseMedia.mockResolvedValue({
      items: [item('m1', 'A')],
      total: 1,
      limit: SEARCH_PAGE_SIZE,
      offset: 0,
    });
    useSearchStore.getState().setQuery('hi');
    await useSearchStore.getState().search(true);

    useSearchStore.getState().reset();

    const s = useSearchStore.getState();
    expect(s.query).toBe('');
    expect(s.results).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.filters).toEqual({});
  });

  it('latest search supersedes a slower in-flight one (MOB-5)', async () => {
    let resolveOld: (v: any) => void = () => undefined;
    mocked.browseMedia
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
      .mockResolvedValueOnce({ items: [item('n1', 'New')], total: 1, limit: SEARCH_PAGE_SIZE, offset: 0 });
    useSearchStore.getState().setQuery('old');
    const oldP = useSearchStore.getState().search(true);
    useSearchStore.getState().setQuery('new');
    await useSearchStore.getState().search(true);
    resolveOld({ items: [item('o1', 'Old')], total: 1, limit: SEARCH_PAGE_SIZE, offset: 0 });
    await oldP;
    const s = useSearchStore.getState();
    expect(s.results.map((r) => r.id)).toEqual(['n1']);
    expect(s.loading).toBe(false);
  });

  it('jumpToLetter supersedes an in-flight search and clears stale results on error', async () => {
    let resolveOld: (v: any) => void = () => undefined;
    mocked.browseMedia
      .mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }))
      .mockRejectedValueOnce(new Error('boom'));
    useSearchStore.setState({
      results: [item('x', 'Stale')],
      letterIndex: { letters: [{ letter: 'A', offset: 0 }, { letter: 'B', offset: 3 }] } as any,
    });
    const oldP = useSearchStore.getState().search(true);
    await useSearchStore.getState().jumpToLetter('B');
    resolveOld({ items: [item('o1', 'Old')], total: 1, limit: SEARCH_PAGE_SIZE, offset: 0 });
    await oldP;
    const s = useSearchStore.getState();
    expect(s.results).toEqual([]);
    expect(s.error).toBe('boom');
    expect(s.loading).toBe(false);
  });
});
