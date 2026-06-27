// src/services/__tests__/DownloadService.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem } from '../../types/media';
import { useDownloadStore } from '../../store/downloadStore';

// ── playbackManager mock (E2 signed stream URL resolver) ───────────────────────
const mockGetStreamUrl = jest.fn();
jest.mock('../../api/PlaybackManager', () => ({
  playbackManager: {
    getStreamUrl: (id: string) => mockGetStreamUrl(id),
  },
}));

// Flush pending micro + macro tasks so the async beginDownload chain settles.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'media-1',
    name: 'Test Movie',
    type: 'movie',
    overview: 'A test movie',
    poster_url: 'https://example.com/poster.jpg',
    year: 2024,
    runtime: 7200,
    genres: ['Action'],
    ...overrides,
  };
}

// Native module shapes captured per test so we can flip presence/absence.
interface NativeDownloaderMock {
  startDownload: jest.Mock;
  pauseDownload: jest.Mock;
  resumeDownload: jest.Mock;
  cancelDownload: jest.Mock;
  deleteFile: jest.Mock;
  documentsPath: string;
}

interface EmitterMock {
  addListener: jest.Mock;
  listeners: Record<string, (payload: unknown) => void>;
}

/**
 * Load a FRESH copy of DownloadService (and its module graph) with react-native
 * mocked so we control whether NativeModules.PhlixDownloader exists and capture
 * the NativeEventEmitter listener registrations. Returns the service singleton.
 */
function loadService(opts: { withNative: boolean }): {
  service: typeof import('../DownloadService').downloadService;
  native: NativeDownloaderMock | null;
  emitter: EmitterMock;
} {
  const native: NativeDownloaderMock | null = opts.withNative
    ? {
        startDownload: jest.fn(),
        pauseDownload: jest.fn(),
        resumeDownload: jest.fn(),
        cancelDownload: jest.fn(),
        deleteFile: jest.fn().mockResolvedValue(true),
        documentsPath: '/Documents',
      }
    : null;

  const emitter: EmitterMock = {
    listeners: {},
    addListener: jest.fn((name: string, cb: (payload: unknown) => void) => {
      emitter.listeners[name] = cb;
      return { remove: jest.fn() };
    }),
  };

  let serviceMod!: typeof import('../DownloadService');
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android },
      NativeModules: { PhlixDownloader: native ?? undefined },
      NativeEventEmitter: jest.fn().mockImplementation(() => emitter),
    }));
    // Keep the isolated DownloadService bound to the SAME store singleton the
    // test inspects (isolateModules would otherwise give it a fresh store copy).
    jest.doMock('../../store/downloadStore', () => ({ useDownloadStore }));
    serviceMod = require('../DownloadService');
  });

  return { service: serviceMod.downloadService, native, emitter };
}

function resetStore(): void {
  useDownloadStore.setState({
    tasks: {},
    queue: { id: 'main', maxConcurrent: 2, currentDownloadIds: [] },
    isLoading: false,
    error: null,
    totalStorageUsed: 0,
    availableStorage: 10 * 1024 * 1024 * 1024,
  });
}

describe('DownloadService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    await AsyncStorage.clear();
    resetStore();
    mockGetStreamUrl.mockReset();
  });

  describe('startDownload + queue', () => {
    it('enqueues a download and reflects it in the store', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task).toBeDefined();
      expect(task.itemId).toBe('item-1');
    });

    it('reuses the existing task id for an in-progress item', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const item = makeItem({ id: 'item-1' });
      const id1 = await service.startDownload(item);
      const id2 = await service.startDownload(item);
      expect(id1).toBe(id2);
    });

    it('respects MAX_CONCURRENT=2 (third stays queued)', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      await service.startDownload(makeItem({ id: 'a' }));
      await service.startDownload(makeItem({ id: 'b' }));
      await service.startDownload(makeItem({ id: 'c' }));
      // let the async beginDownload chains settle
      await flush();

      const tasks = Object.values(useDownloadStore.getState().tasks);
      const downloading = tasks.filter((t) => t.status === 'downloading');
      const queued = tasks.filter((t) => t.status === 'queued');
      expect(downloading.length).toBe(2);
      expect(queued.length).toBe(1);
    });
  });

  describe('beginDownload', () => {
    it('resolves the signed URL then calls native startDownload (5-arg shape)', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: true });
      await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      expect(mockGetStreamUrl).toHaveBeenCalledWith('item-1');
      expect(native!.startDownload).toHaveBeenCalledTimes(1);
      const args = native!.startDownload.mock.calls[0];
      expect(args.length).toBe(5);
      expect(args[1]).toBe('https://signed/stream.mp4'); // url
      expect(typeof args[0]).toBe('string'); // taskId
    });

    it('falls back to simulated download when native module is absent', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: false });
      expect(native).toBeNull();
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();
      // task moved to downloading via the simulated path (no crash)
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('downloading');
      // Cancel to clear the simulated-download interval (no leaked timer).
      await service.cancelDownload(taskId);
    });

    it('marks the task failed when no stream URL is available', async () => {
      mockGetStreamUrl.mockResolvedValue(undefined);
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('failed');
    });
  });

  describe('native event handlers', () => {
    it('handleNativeProgress updates store progress', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativeProgress(taskId, 50, 100);
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.downloadedBytes).toBe(50);
      expect(task.totalBytes).toBe(100);
      expect(task.progress).toBe(0.5);
    });

    it('handleNativeComplete marks completed with local path', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativeComplete(taskId, '/Documents/item-1.mp4');
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.status).toBe('completed');
      expect(task.localPath).toBe('/Documents/item-1.mp4');
    });

    it('handleNativeError marks failed with message', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativeError(taskId, 'Network down');
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.status).toBe('failed');
      expect(task.error).toBe('Network down');
    });

    it('handleNativePaused marks paused', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativePaused(taskId, 42);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('paused');
    });
  });

  describe('native event-emitter subscription', () => {
    it('subscribes to all 4 event names when the module is present', () => {
      const { emitter } = loadService({ withNative: true });
      const names = emitter.addListener.mock.calls.map((c) => c[0]);
      expect(names).toEqual(
        expect.arrayContaining([
          'PhlixDownloadProgress',
          'PhlixDownloadComplete',
          'PhlixDownloadError',
          'PhlixDownloadPaused',
        ]),
      );
    });

    it('routes emitted events to the matching handlers', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, emitter } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      // Simulate a native progress event arriving over the emitter.
      emitter.listeners.PhlixDownloadProgress({ taskId, downloadedBytes: 30, totalBytes: 60 });
      expect(useDownloadStore.getState().tasks[taskId].progress).toBe(0.5);

      // Simulate completion.
      emitter.listeners.PhlixDownloadComplete({ taskId, localPath: '/Documents/x.mp4' });
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('completed');
    });

    it('does not subscribe (no crash) when the module is absent', () => {
      const { emitter } = loadService({ withNative: false });
      expect(emitter.addListener).not.toHaveBeenCalled();
    });
  });

  describe('cancel / delete via native', () => {
    it('cancelDownload calls native cancel and removes the task', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      await service.cancelDownload(taskId);
      expect(native!.cancelDownload).toHaveBeenCalledWith(taskId);
      expect(useDownloadStore.getState().tasks[taskId]).toBeUndefined();
    });

    it('deleteDownload calls native deleteFile for a completed task', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();
      service.handleNativeComplete(taskId, '/Documents/item-1.mp4');

      await service.deleteDownload(taskId);
      expect(native!.deleteFile).toHaveBeenCalledWith('/Documents/item-1.mp4');
      expect(useDownloadStore.getState().tasks[taskId]).toBeUndefined();
    });
  });
});
