/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/LiveTvManager.test.ts
//
// The global jest.setup.js axios mock does not provide `isAxiosError`, so this
// suite supplies its own axios mock that recognises errors carrying an
// `isAxiosError` flag (mirroring real axios) — needed for `isNotConfiguredError`.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    isAxiosError: (e: unknown): boolean =>
      typeof e === 'object' && e !== null && (e as { isAxiosError?: boolean }).isAxiosError === true,
  },
}));

import { liveTvManager, isNotConfiguredError } from '../LiveTvManager';
import apiClient, { getApiBaseUrl, buildRequestHeaders } from '../client';
import type { Channel, Program, Recording, SeriesRule } from '../../types/livetv';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getApiBaseUrl: jest.fn(() => 'https://srv.example/api/v1'),
  buildRequestHeaders: jest.fn(async () => ({ Authorization: 'Bearer tok' })),
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedGetApiBaseUrl = getApiBaseUrl as jest.MockedFunction<typeof getApiBaseUrl>;
const mockedBuildHeaders = buildRequestHeaders as jest.MockedFunction<
  typeof buildRequestHeaders
>;

const sampleChannel: Channel = {
  id: 'c1',
  name: 'BBC One',
  number: 101,
  type: 'tv',
  visibility: 'visible',
};

const sampleProgram: Program = {
  id: 'p1',
  channel_id: 'c1',
  title: 'News',
  start_time: 1000,
  end_time: 2000,
};

const sampleRecording: Recording = {
  id: 'r1',
  channel_id: 'c1',
  title: 'News',
  start_time: 1000,
  end_time: 2000,
  status: 'pending',
};

const sampleRule: SeriesRule = {
  id: 'sr1',
  title: 'Doctor Who',
};

/** Build an axios-like error (flagged + response.status) for notConfigured tests. */
const axiosErrorWithStatus = (status: number): unknown => ({
  isAxiosError: true,
  message: 'boom',
  response: { status },
});

describe('LiveTvManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetApiBaseUrl.mockReturnValue('https://srv.example/api/v1');
    mockedBuildHeaders.mockResolvedValue({ Authorization: 'Bearer tok' });
  });

  // ── Channels ──
  it('getChannels GETs /admin/livetv/channels and unwraps .channels', async () => {
    mockedClient.get.mockResolvedValue({ success: true, channels: [sampleChannel] });
    const result = await liveTvManager.getChannels();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/channels');
    expect(result).toEqual([sampleChannel]);
  });

  it('getChannel GETs /admin/livetv/channels/{id} and unwraps .channel', async () => {
    mockedClient.get.mockResolvedValue({ success: true, channel: sampleChannel });
    const result = await liveTvManager.getChannel('c1');
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/channels/c1');
    expect(result).toEqual(sampleChannel);
  });

  it('updateChannel PUTs name+enabled and unwraps .channel', async () => {
    mockedClient.put.mockResolvedValue({ success: true, channel: sampleChannel });
    const result = await liveTvManager.updateChannel('c1', { name: 'X', enabled: false });
    expect(mockedClient.put).toHaveBeenCalledWith('/admin/livetv/channels/c1', {
      name: 'X',
      enabled: false,
    });
    expect(result).toEqual(sampleChannel);
  });

  // ── Guide ──
  it('getGuide GETs /admin/livetv/guide with snake_case channel_id/from/to', async () => {
    mockedClient.get.mockResolvedValue({ success: true, programs: [sampleProgram] });
    const result = await liveTvManager.getGuide({ channelId: 'c1', from: 100, to: 200 });
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/guide', {
      channel_id: 'c1',
      from: 100,
      to: 200,
    });
    expect(result).toEqual([sampleProgram]);
  });

  it('getGuide with no args sends an empty params object', async () => {
    mockedClient.get.mockResolvedValue({ success: true, programs: [] });
    await liveTvManager.getGuide();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/guide', {});
  });

  it('getProgram GETs /admin/livetv/guide/programs/{id} and unwraps .program', async () => {
    mockedClient.get.mockResolvedValue({ success: true, program: sampleProgram });
    const result = await liveTvManager.getProgram('p1');
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/guide/programs/p1');
    expect(result).toEqual(sampleProgram);
  });

  it('refreshGuide POSTs /admin/livetv/guide/refresh', async () => {
    mockedClient.post.mockResolvedValue({ success: true });
    await liveTvManager.refreshGuide();
    expect(mockedClient.post).toHaveBeenCalledWith('/admin/livetv/guide/refresh');
  });

  // ── Recordings ──
  it('getRecordings GETs /admin/livetv/recordings with status filter', async () => {
    mockedClient.get.mockResolvedValue({ success: true, recordings: [sampleRecording] });
    const result = await liveTvManager.getRecordings('pending');
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/recordings', {
      status: 'pending',
    });
    expect(result).toEqual([sampleRecording]);
  });

  it('getRecordings without status omits the params', async () => {
    mockedClient.get.mockResolvedValue({ success: true, recordings: [] });
    await liveTvManager.getRecordings();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/recordings', undefined);
  });

  it('getUpcomingRecordings GETs /admin/livetv/recordings/upcoming', async () => {
    mockedClient.get.mockResolvedValue({ success: true, recordings: [sampleRecording] });
    const result = await liveTvManager.getUpcomingRecordings();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/recordings/upcoming');
    expect(result).toEqual([sampleRecording]);
  });

  it('getRecording GETs /admin/livetv/recordings/{id} and unwraps .recording', async () => {
    mockedClient.get.mockResolvedValue({ success: true, recording: sampleRecording });
    const result = await liveTvManager.getRecording('r1');
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/recordings/r1');
    expect(result).toEqual(sampleRecording);
  });

  it('createRecording POSTs the body and unwraps .recording', async () => {
    mockedClient.post.mockResolvedValue({ success: true, recording: sampleRecording });
    const body = {
      channel_id: 'c1',
      title: 'News',
      start_time: 1000,
      end_time: 2000,
      program_id: 'p1',
    };
    const result = await liveTvManager.createRecording(body);
    expect(mockedClient.post).toHaveBeenCalledWith('/admin/livetv/recordings', body);
    expect(result).toEqual(sampleRecording);
  });

  it('deleteRecording DELETEs /admin/livetv/recordings/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ success: true });
    await liveTvManager.deleteRecording('r1');
    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/livetv/recordings/r1');
  });

  // ── Series rules ──
  it('getSeriesRules GETs /admin/livetv/series-rules and unwraps .rules', async () => {
    mockedClient.get.mockResolvedValue({ success: true, rules: [sampleRule] });
    const result = await liveTvManager.getSeriesRules();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/livetv/series-rules');
    expect(result).toEqual([sampleRule]);
  });

  // ── getChannelStreamUrl (manual fetch redirect resolve) ──
  describe('getChannelStreamUrl', () => {
    const endpoint = 'https://srv.example/api/v1/admin/livetv/channels/c1/stream';

    afterEach(() => {
      // @ts-expect-error -- cleanup the test-injected global
      delete global.fetch;
    });

    it('resolves the Location header from a manual-redirect fetch', async () => {
      const headers = new Map<string, string>([
        ['location', 'https://tuner.local/hls/c1.m3u8'],
      ]);
      global.fetch = jest.fn(async () => ({
        headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      })) as unknown as typeof fetch;

      const url = await liveTvManager.getChannelStreamUrl('c1');

      expect(global.fetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({ method: 'GET', redirect: 'manual' })
      );
      expect(mockedBuildHeaders).toHaveBeenCalled();
      expect(url).toBe('https://tuner.local/hls/c1.m3u8');
    });

    it('falls back to the endpoint URL when Location is missing (opaque redirect)', async () => {
      global.fetch = jest.fn(async () => ({
        headers: { get: () => null },
      })) as unknown as typeof fetch;

      const url = await liveTvManager.getChannelStreamUrl('c1');
      expect(url).toBe(endpoint);
    });

    it('falls back to the endpoint URL when fetch throws (network error)', async () => {
      global.fetch = jest.fn(async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch;

      const url = await liveTvManager.getChannelStreamUrl('c1');
      expect(url).toBe(endpoint);
    });
  });

  // ── isNotConfiguredError ──
  describe('isNotConfiguredError', () => {
    it('is true for a 404 axios error', () => {
      expect(isNotConfiguredError(axiosErrorWithStatus(404))).toBe(true);
    });

    it('is true for a 500 axios error', () => {
      expect(isNotConfiguredError(axiosErrorWithStatus(500))).toBe(true);
    });

    it('is false for a 401 axios error', () => {
      expect(isNotConfiguredError(axiosErrorWithStatus(401))).toBe(false);
    });

    it('is false for a non-axios error', () => {
      expect(isNotConfiguredError(new Error('plain'))).toBe(false);
    });
  });
});
