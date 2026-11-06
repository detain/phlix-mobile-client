/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/DownloadService.wifiGate.test.ts
// M3 (deferred lane): the Wi-Fi-only setting is REAL now. These pins hold
// the gate to its contract: cellular + switch-on => tasks STAY queued (no
// stream URL is even resolved); leaving cellular => they auto-start with no
// user action; switch-off => cellular starts immediately.
//
// MW-027 (review mobile__crossfe #14) removed the module-absent simulator:
// an unregistered PhlixDownloader now FAILS the task loudly. These gate pins
// are about WHEN a start is attempted, not about the missing-module refusal,
// so the file installs a minimal native downloader for its own module graph
// — the gate runs on the REAL native start path, exactly as shipped.
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaItem } from '../../types/media';
import { useDownloadStore } from '../../store/downloadStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { downloadService } from '../DownloadService';

// Full-replacement react-native mock for this file's graph — the same minimal
// shape DownloadService.test.ts pins (requireActual does not boot under
// `testEnvironment: node`). The graph's total RN surface is NativeModules +
// NativeEventEmitter (DownloadService) and Platform (NotificationService).
// Factory-local jest.fn()s — a hoisted factory must not reference outer consts.
jest.mock('react-native', () => {
  const downloader = {
    startDownload: jest.fn(),
    pauseDownload: jest.fn(),
    resumeDownload: jest.fn(),
    cancelDownload: jest.fn(),
    deleteFile: jest.fn(),
    documentsPath: '/Documents',
  };
  return {
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
    NativeModules: { PhlixDownloader: downloader },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
  };
});

const mockGetStreamUrl = jest.fn();
jest.mock('../../api/PlaybackManager', () => ({
  playbackManager: {
    getStreamUrl: (id: string) => mockGetStreamUrl(id),
  },
}));

const netinfo = NetInfo as unknown as {
  __setNetwork: (patch: Record<string, unknown>) => void;
  __resetNetwork: () => void;
};

// Fake timers stay: advanceTimersByTimeAsync(0) drains the async gate chain
// (fetch → pump → beginDownload) deterministically without letting any queue
// timer fire early. (The old hazard this file cited — a simulator interval
// outliving the registry — was retired with the simulator itself by MW-027.)
beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

// Drain promises (fetch → pump → beginDownload chain) without firing timers.
const settle = async () => {
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
};

function makeItem(id: string): MediaItem {
  return {
    id,
    name: `Gate Movie ${id}`,
    type: 'movie',
    overview: 'x',
    poster_url: '',
    year: 2026,
    runtime: 1000,
    genres: [],
  } as unknown as MediaItem;
}

async function taskOf(itemId: string) {
  const tasks = useDownloadStore.getState().tasks;
  return Object.values(tasks).find((t) => t.itemId === itemId);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await useDownloadStore.setState({ tasks: {} } as never);
  useSettingsStore.setState({ downloadOverWifiOnly: true });
  netinfo.__resetNetwork(); // Wi-Fi baseline; the service watcher is live.
  mockGetStreamUrl.mockResolvedValue('https://server.example/stream/master.m3u8');
});

afterAll(async () => {
  // Cancel stragglers so no task stays marked active past the file's life.
  for (const t of Object.values(useDownloadStore.getState().tasks)) {
    await downloadService.cancelDownload(t.id);
  }
  downloadService.dispose();
});

describe('download Wi-Fi gate (M3)', () => {
  it('holds a new download in queued state on cellular — no stream is resolved', async () => {
    netinfo.__setNetwork({ type: 'cellular' });
    await downloadService.startDownload(makeItem('cell-held'));
    await settle();
    const task = await taskOf('cell-held');
    expect(task?.status).toBe('queued');
    expect(mockGetStreamUrl).not.toHaveBeenCalled();
  });

  it('auto-starts a held task the moment the connection leaves cellular', async () => {
    netinfo.__setNetwork({ type: 'cellular' });
    await downloadService.startDownload(makeItem('cell-wait'));
    await settle();
    expect((await taskOf('cell-wait'))?.status).toBe('queued');

    netinfo.__setNetwork({ type: 'wifi' }); // watcher fires with no user action
    await settle();
    expect(mockGetStreamUrl).toHaveBeenCalledWith('cell-wait');
    expect((await taskOf('cell-wait'))?.status).toBe('downloading');
  });

  it('starts immediately on cellular when the switch is OFF (opt-out honored)', async () => {
    netinfo.__setNetwork({ type: 'cellular' });
    useSettingsStore.setState({ downloadOverWifiOnly: false });
    await downloadService.startDownload(makeItem('cell-off'));
    await settle();
    expect((await taskOf('cell-off'))?.status).toBe('downloading');
  });

  it('flipping the switch OFF while cellular-held wakes the queue', async () => {
    netinfo.__setNetwork({ type: 'cellular' });
    await downloadService.startDownload(makeItem('flip-wake'));
    await settle();
    expect((await taskOf('flip-wake'))?.status).toBe('queued');

    useSettingsStore.getState().setDownloadOverWifiOnly(false);
    await settle();
    expect((await taskOf('flip-wake'))?.status).toBe('downloading');
  });

  it('an ACTIVE download is never interrupted by joining cellular (gate starts only)', async () => {
    await downloadService.startDownload(makeItem('running'));
    await settle();
    expect((await taskOf('running'))?.status).toBe('downloading');

    netinfo.__setNetwork({ type: 'cellular' });
    await settle();
    expect((await taskOf('running'))?.status).toBe('downloading');
  });
});
