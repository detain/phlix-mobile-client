/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/DownloadService.failureCopy.test.ts
//
// MW-045 (review mobile__casualgamer #2): a failed download used to render
// the RAW native string — "Failed: HTTP 404", OkHttp exception text, iOS
// NSURLError prose — with no path to action. The full failure inventory
// (Android finishError emits "HTTP ${code}" / "Empty response body" / raw
// e.message; iOS emits error.localizedDescription; the JS lane adds axios +
// the store's own throws) now lands on short, actionable user copy via the
// pure boundary mapper `describeDownloadFailure`. The mapper is pinned
// table-first; the handleNativeError wiring is pinned behaviourally.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem } from '../../types/media';
import { useDownloadStore } from '../../store/downloadStore';
import { downloadService, describeDownloadFailure } from '../DownloadService';

const CONNECTIVITY = 'Your connection was interrupted — check the network and try again.';
const DISK = 'Not enough free storage on this device — make space and try again.';
const EXPIRED = 'The download link expired — start the download again.';
const GONE = 'That item could not be found on this server.';
const SERVER = 'The server had a problem delivering the file — try again later.';
const NO_DATA = 'The server sent no data — try again later.';
const GENERIC = 'The download failed — try again.';

describe('describeDownloadFailure — the native failure inventory mapped to action', () => {
  // [raw from the wire/native lanes, expected user copy]
  const table: ReadonlyArray<readonly [string, string]> = [
    // Android PhlixDownloaderModule.kt finishError inventory:
    ['HTTP 401', EXPIRED],
    ['HTTP 403', EXPIRED],
    ['HTTP 404', GONE],
    ['HTTP 410', GONE],
    ['HTTP 500', SERVER],
    ['HTTP 503', SERVER],
    ['HTTP 418', 'The server rejected the download (HTTP 418).'],
    ['Empty response body', NO_DATA],
    ['Unable to resolve host "phlix.example.test": No address associated with hostname', CONNECTIVITY],
    ['Connection closed', CONNECTIVITY],
    ['java.net.SocketTimeoutException: failed to connect', CONNECTIVITY],
    ['Download failed', GENERIC],
    // iOS PhlixDownloader.swift localizedDescription inventory:
    ['The Internet connection appears to be offline.', CONNECTIVITY],
    ['A server with the specified hostname could not be found.', CONNECTIVITY],
    ['The request timed out.', CONNECTIVITY],
    ['The resource could not be found.', GONE],
    ['No space left on device', DISK],
    ['The volume “Data” is full.', DISK],
    // Junk lanes: empty/whitespace and unmappable text never reach users raw.
    ['', GENERIC],
    ['   ', GENERIC],
    ['??? *** ???', GENERIC],
  ];

  it.each([...table.keys()])('maps inventory row %i', (i) => {
    const [raw, expected] = table[i];
    expect(describeDownloadFailure(raw)).toBe(expected);
  });

  it('never echoes an unmappable raw string back to the user', () => {
    expect(describeDownloadFailure('SSLHandshakeException: Chain validation failed'))
      .toBe(GENERIC);
  });
});

describe('DownloadService.handleNativeError — the mapped copy is what the store holds', () => {
  const makeItem = (overrides: Partial<MediaItem> = {}): MediaItem => ({
    id: 'media-1',
    name: 'Test Movie',
    type: 'movie',
    overview: 'A test movie',
    poster_url: 'https://example.com/poster.jpg',
    year: 2024,
    runtime: 7200,
    genres: ['Action'],
    ...overrides,
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    useDownloadStore.setState({ tasks: {} });
  });

  it('an HTTP 404 from the native lane stores the catalog-styled GONE copy', async () => {
    const taskId = await useDownloadStore.getState().addDownload(makeItem(), 'original');
    downloadService.handleNativeError(taskId, 'HTTP 404');
    const stored = useDownloadStore.getState().tasks[taskId];
    expect(stored.status).toBe('failed');
    expect(stored.error).toBe(GONE);
    expect(stored.error).not.toContain('HTTP');
  });
});
