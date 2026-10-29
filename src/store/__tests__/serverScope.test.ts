/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/store/__tests__/serverScope.test.ts
//
// M-MOBILE-18 (review mobile__gameux M-G): the cascade itself. When the hub
// active-server identity moves, EVERY piece of state addressed by the old
// server must vanish in the same frame: cached rows (they must never render
// as the new server's truth) and queued old-id mutations (a favorite/play/
// download id from server A aimed at server B is at best a 404 and at worst
// an unrelated same-id title). This file pins what `resetServerScopedState`
// clears, what it deliberately keeps, and the idempotence of a repeat sweep.
//
// Deliberately NOT cleared (each law commented in serverScope.ts and here):
// the playing session in `usePlayerStore`, syncplay ROOM state, `useCastStore`,
// direct-login `useSettingsStore`/`useAuthStore` — none is an old-server cache.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetServerScopedState } from '../serverScope';

import { useCollectionStore } from '../../stores/useCollectionStore';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useLiveTvStore } from '../../stores/useLiveTvStore';
import { useMusicStore } from '../../stores/useMusicStore';
import { usePhotoStore } from '../../stores/usePhotoStore';
import { useProfileStore } from '../../stores/useProfileStore';
import { useSearchStore } from '../../stores/useSearchStore';
import { useWatchHistoryStore } from '../../stores/useWatchHistoryStore';

import { useDownloadStore, DownloadTask } from '../downloadStore';
import { useSyncplayStore } from '../syncplayStore';

jest.mock('@react-native-async-storage/async-storage');

// The stores' API managers pull axios in at module load; nothing here may
// reach a network — every seed is a direct setState, every law is local.
jest.mock('../../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    getServerRoot: jest.fn(() => 'https://server.invalid'),
  },
}));

const oldItem = { id: 'old-1', title: 'Old Server Truth' } as never;

const downloadTask = (id: string, status: DownloadTask['status']): DownloadTask =>
  ({
    id,
    itemId: `item-${id}`,
    item: oldItem,
    status,
    progress: status === 'completed' ? 1 : 0,
    downloadedBytes: 0,
    totalBytes: 100,
    localPath: '',
    quality: 'original',
    createdAt: 1,
  }) as DownloadTask;

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

  // Seed every cache with unmistakable OLD-server rows — if the sweep misses
  // one, the sentinel renders as the new server's truth (the review's bug).
  useLibraryStore.setState({
    libraries: [{ id: 'lib-old' } as never],
    libraryItems: { 'lib-old': [oldItem] },
    recentlyAdded: [oldItem],
    continueWatching: [oldItem],
    searchResults: [oldItem],
    searchQuery: 'stale',
    error: 'stale error',
  });
  useFavoritesStore.setState({
    items: [oldItem],
    offset: 10,
    hasMore: true,
    error: 'stale error',
  });
  useWatchHistoryStore.setState({ items: [oldItem], loading: true, error: 'stale' });
  useSearchStore.setState({
    query: 'old query',
    results: [oldItem],
    total: 42,
    letterIndex: { letters: ['A'] } as never,
    error: 'stale',
  });
  useCollectionStore.setState({
    collections: [{ id: 'col-old' } as never],
    currentCollection: { id: 'col-old' } as never,
    currentItems: [oldItem],
    collectionsError: 'stale',
  });
  useMusicStore.setState({
    artists: [{ id: 'art-old' } as never],
    albums: [{ id: 'alb-old' } as never],
    tracks: [{ id: 'trk-old' } as never],
    nowPlaying: { id: 'np-old' } as never,
  });
  usePhotoStore.setState({
    photoLibraries: [{ id: 'plib-old' } as never],
    albums: [{ id: 'palb-old' } as never],
    currentAlbum: { id: 'palb-old' } as never,
  });
  useLiveTvStore.setState({
    channels: [{ id: 'ch-old' } as never],
    guide: [{ id: 'prog-old' } as never],
    recordings: [{ id: 'rec-old' } as never],
    seriesRules: [{ id: 'rule-old' } as never],
  });
  useProfileStore.setState({
    profiles: [{ id: 'prof-old', name: 'Old' } as never],
    activeProfile: { id: 'prof-old', name: 'Old' } as never,
    activeProfileId: 'prof-old',
    isLoading: true,
    error: 'stale',
  });
  // Queued old-server-id mutations that could still fire post-switch:
  useSyncplayStore.setState({
    pendingPlayMedia: {
      type: 'pending_command',
      command: 'play_media',
      serverId: 'server-old',
      mediaId: 'media-old',
      title: 'Voice-picked old-server title',
      source: 'alexa',
      issuedAt: 1,
    },
  });
  useDownloadStore.setState({
    tasks: {
      't-queued': downloadTask('t-queued', 'queued'),
      't-paused': downloadTask('t-paused', 'paused'),
      't-downloading': downloadTask('t-downloading', 'downloading'),
      't-completed': downloadTask('t-completed', 'completed'),
      't-failed': downloadTask('t-failed', 'failed'),
    },
  });
});

describe('resetServerScopedState — every old-server cache drops (M-MOBILE-18)', () => {
  it('library/home/search rails are gone in the same frame', () => {
    resetServerScopedState();
    const s = useLibraryStore.getState();
    expect(s.libraries).toEqual([]);
    expect(s.libraryItems).toEqual({});
    expect(s.recentlyAdded).toEqual([]);
    expect(s.continueWatching).toEqual([]);
    expect(s.searchResults).toEqual([]);
    expect(s.searchQuery).toBe('');
    expect(s.error).toBeNull();
  });

  it('favorites, watch history, search, collections, music, photos, live TV and profiles are gone', () => {
    resetServerScopedState();
    expect(useFavoritesStore.getState().items).toEqual([]);
    expect(useFavoritesStore.getState().offset).toBe(0);
    expect(useWatchHistoryStore.getState().items).toEqual([]);
    expect(useSearchStore.getState().results).toEqual([]);
    expect(useSearchStore.getState().query).toBe('');
    expect(useCollectionStore.getState().collections).toEqual([]);
    expect(useCollectionStore.getState().currentItems).toEqual([]);
    expect(useMusicStore.getState().artists).toEqual([]);
    expect(useMusicStore.getState().tracks).toEqual([]);
    expect(usePhotoStore.getState().albums).toEqual([]);
    expect(useLiveTvStore.getState().channels).toEqual([]);
    expect(useLiveTvStore.getState().recordings).toEqual([]);
    expect(useProfileStore.getState().profiles).toEqual([]);
    expect(useProfileStore.getState().activeProfile).toBeNull();
  });

  it('watch-history reset is a LOCAL eviction — it must never fire the server DELETE', () => {
    // The review's trap in miniature: `clearHistory` is the user's destructive
    // verb; the switch cure must not silently erase the old server's history.
    resetServerScopedState();
    expect(useWatchHistoryStore.getState().items).toEqual([]);
    // api/client is jest-mocked above; if any DELETE walked out, it lands here:
    const { apiClient } = jest.requireMock('../../api/client') as {
      apiClient: Record<string, jest.Mock>;
    };
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('an unconsumed voice pick for the OLD server is discarded, never re-aimed', () => {
    resetServerScopedState();
    expect(useSyncplayStore.getState().pendingPlayMedia).toBeNull();
  });

  it('the download queue drops its old-id entries: queued/paused cancel, downloading/completed/failed keep their state', () => {
    resetServerScopedState();
    const { tasks } = useDownloadStore.getState();
    expect(tasks['t-queued'].status).toBe('cancelled');
    expect(tasks['t-paused'].status).toBe('cancelled');
    // Streaming keeps going: its signed URL was resolved from the old server
    // BEFORE the switch, so the bytes landing are content-correct anyway.
    expect(tasks['t-downloading'].status).toBe('downloading');
    expect(tasks['t-completed'].status).toBe('completed');
    expect(tasks['t-failed'].status).toBe('failed');
    // The cancel must persist (the list survives an app restart as cancelled,
    // so the drain cannot resurrect old-id tasks on a later launch).
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'phlix_downloads_v2',
      expect.any(String)
    );
  });

  it('the persisted profile PIN survives in-memory reset — a foreign id rehydrates inert', () => {
    resetServerScopedState();
    expect(useProfileStore.getState().activeProfileId).toBeNull();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('phlix_active_profile_id');
  });

  it('a repeat sweep is inert: no fresh cancels, no duplicate persist', () => {
    resetServerScopedState();
    (AsyncStorage.setItem as jest.Mock).mockClear();

    resetServerScopedState();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled(); // nothing queued left
    expect(useDownloadStore.getState().tasks['t-queued'].status).toBe('cancelled');
    expect(useDownloadStore.getState().tasks['t-downloading'].status).toBe('downloading');
  });

  it('the syncplay ROOM a user is still in is NOT silently blanked (M-MOBILE-16 law)', () => {
    useSyncplayStore.setState({
      currentGroup: { id: 'group-old', name: 'Movie night' } as never,
      isConnected: true,
    });
    resetServerScopedState();
    // The socket is still live in the old server's room; pretending the join
    // ended would lie about the user's own state. Room lifecycle is driven by
    // the socket's reality (explicit leave / server word), not by cache sweeps.
    expect(useSyncplayStore.getState().currentGroup).not.toBeNull();
    expect(useSyncplayStore.getState().isConnected).toBe(true);
  });
});
