/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/DownloadService.test.ts
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem } from '../../types/media';
import { useDownloadStore } from '../../store/downloadStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

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
  showNotification: jest.Mock;
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
  const showNotification = jest.fn();
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android },
      NativeModules: { PhlixDownloader: native ?? undefined },
      NativeEventEmitter: jest.fn().mockImplementation(() => emitter),
    }));
    // Keep the isolated DownloadService bound to the SAME store singleton the
    // test inspects (isolateModules would otherwise give it a fresh store copy).
    jest.doMock('../../store/downloadStore', () => ({ useDownloadStore }));
    // Same law for the settings singleton: the notification gate must read the
    // store instance the test mutates, not a fresh isolated copy.
    jest.doMock('../../stores/useSettingsStore', () => ({ useSettingsStore }));
    // Capture the completion-notification seam (review mobile__crossfe M3):
    // the wiring under test is the CALL SITE firing; NotificationService's own
    // notifee surface is pinned in NotificationService.test.ts.
    jest.doMock('../NotificationService', () => ({
      notificationService: { showLocalNotification: showNotification },
    }));
    serviceMod = require('../DownloadService');
  });

  return { service: serviceMod.downloadService, native, emitter, showNotification };
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

    it('sanitizes BOTH the id and the name out of the destination filename (M-MOBILE-30)', async () => {
      // `item.id` is server content too: the old code only sanitized the
      // title, letting '../../etc/passwd'-shaped ids escape the download
      // directory via the filename.
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: true });
      await service.startDownload(makeItem({ id: '../../etc/passwd', name: 'Bad/../Name' }));
      await flush();

      expect(native!.startDownload).toHaveBeenCalledTimes(1);
      const destination = String(native!.startDownload.mock.calls[0][2]);
      expect(destination.endsWith('______etc_passwd_Bad____Name.mp4')).toBe(true);
      expect(destination).not.toMatch(/\.\./);
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

    // Review mobile__crossfe M1: the Android arm used to hand the native
    // module a hardcoded /storage/emulated/0/Download/Phlix/ path — raw File
    // creation there is forbidden by enforced scoped storage at targetSdk 36,
    // while the module's OWN exported private-dir constant (reactContext
    // .filesDir as `documentsPath`) was simply ignored. This harness loads
    // the service under Platform.OS === 'android', so the test asserts the
    // real Android lane of the unified law: native-published constant, both
    // platforms.
    it('Android destination derives from the native-published private dir', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      const { service, native } = loadService({ withNative: true });
      await service.startDownload(makeItem({ id: 'item-1', name: 'Ep One' }));
      await flush();

      const destination = String(native!.startDownload.mock.calls[0][2]);
      expect(destination).toBe('/Documents/item_1_Ep_One.mp4');
      expect(destination).not.toMatch(/\/storage\//);
    });

    it('the scoped-storage-forbidden literal stays OUT of the service (permanent law pin)', () => {
      // fs-read gate precedent: versionSync.test.ts / routeManifest.gate.test.ts.
      const src = fs.readFileSync(
        path.resolve(__dirname, '../DownloadService.ts'),
        'utf8'
      );
      expect(src).not.toContain('/storage/emulated/0');
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

    // Review mobile__crossfe M3: the completion lane must reach the user.
    // handleNativeComplete is the one real production call site of the whole
    // NotificationService subsystem; the enableNotifications gate is what
    // makes the Settings toggle honest (the M-01 theater family).
    it('fires a completion notification through the service when the setting is ON', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      useSettingsStore.setState({ enableNotifications: true });
      const { service, showNotification } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativeComplete(taskId, '/Documents/item-1.mp4');
      expect(showNotification).toHaveBeenCalledWith({
        title: 'Download complete',
        message: 'Test Movie is ready for offline playback.',
        type: 'download_complete',
        data: { itemId: 'item-1' },
      });
    });

    it('stays silent when enableNotifications is OFF, and still completes the task', async () => {
      mockGetStreamUrl.mockResolvedValue('https://signed/stream.mp4');
      useSettingsStore.setState({ enableNotifications: false });
      const { service, showNotification } = loadService({ withNative: true });
      const taskId = await service.startDownload(makeItem({ id: 'item-1' }));
      await flush();

      service.handleNativeComplete(taskId, '/Documents/item-1.mp4');
      expect(showNotification).not.toHaveBeenCalled();
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('completed');
      useSettingsStore.setState({ enableNotifications: true });
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
