// src/api/__tests__/TranscodeManager.test.ts
/* eslint-disable jest/valid-expect -- rejection expectation is intentionally
   created before flushing fake timers (to attach the handler) and awaited after */
import { transcodeManager } from '../TranscodeManager';
import apiClient from '../client';

jest.mock('../client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  setActiveSessionId: jest.fn(),
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const makeJob = (over: Partial<Record<string, unknown>> = {}) => ({
  job_id: 'job-1',
  master_url: 'https://srv/hls/job-1/master.m3u8?sig=a',
  hls_url: 'https://srv/hls/job-1/master.m3u8?sig=a',
  dash_url: 'https://srv/dash/job-1/manifest.mpd?sig=a',
  status: 'encoding',
  reused: false,
  subtitles: [],
  ...over,
});

const makeStatus = (over: Partial<Record<string, unknown>> = {}) => ({
  job_id: 'job-1',
  status: 'encoding',
  segments: 0,
  playlist_ready: false,
  progress: 0,
  master_url: 'https://srv/hls/job-1/master.m3u8?sig=a',
  dash_url: 'https://srv/dash/job-1/manifest.mpd?sig=a',
  subtitles: [],
  ...over,
});

describe('TranscodeManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('startTranscode POSTs /media/{id}/transcode with NO body and no profile param', async () => {
    mockedClient.post.mockResolvedValue(makeJob());

    await transcodeManager.startTranscode('m1');

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/media/m1/transcode',
      undefined,
      undefined,
    );
  });

  it('startTranscode appends ?profile= when provided', async () => {
    mockedClient.post.mockResolvedValue(makeJob());

    await transcodeManager.startTranscode('m1', 'tv-4k');

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/media/m1/transcode',
      undefined,
      { params: { profile: 'tv-4k' } },
    );
  });

  it('getStatus GETs /transcode/{jobId}/status', async () => {
    mockedClient.get.mockResolvedValue(makeStatus());

    const res = await transcodeManager.getStatus('job-1');

    expect(mockedClient.get).toHaveBeenCalledWith('/transcode/job-1/status');
    expect(res.job_id).toBe('job-1');
  });

  describe('prepare', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves immediately when the job is already ready (reused)', async () => {
      mockedClient.post.mockResolvedValue(
        makeJob({
          status: 'ready',
          reused: true,
          subtitles: [{ language: 'en', url: 'https://srv/sub/en.vtt?sig=z' }],
        }),
      );

      const { promise } = transcodeManager.prepare('m1');
      await jest.runOnlyPendingTimersAsync();
      const result = await promise;

      expect(result.masterUrl).toBe('https://srv/hls/job-1/master.m3u8?sig=a');
      expect(result.subtitles).toEqual([
        { language: 'en', url: 'https://srv/sub/en.vtt?sig=z' },
      ]);
      expect(mockedClient.get).not.toHaveBeenCalled();
    });

    it('polls status until playlist_ready, then resolves with master + subtitles', async () => {
      mockedClient.post.mockResolvedValue(makeJob({ status: 'encoding' }));
      mockedClient.get
        .mockResolvedValueOnce(makeStatus({ status: 'encoding', progress: 40 }))
        .mockResolvedValueOnce(
          makeStatus({
            status: 'encoding',
            playlist_ready: true,
            progress: 100,
            subtitles: [{ language: 'fr', url: 'https://srv/sub/fr.vtt?sig=z' }],
          }),
        );

      const onProgress = jest.fn();
      const { promise } = transcodeManager.prepare('m1', {
        onProgress,
        pollIntervalMs: 1000,
      });

      // Let the start POST + first poll resolve, then advance the timer.
      await jest.runOnlyPendingTimersAsync();
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.masterUrl).toBe('https://srv/hls/job-1/master.m3u8?sig=a');
      expect(result.subtitles[0].language).toBe('fr');
      expect(onProgress).toHaveBeenCalledWith(40);
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('rejects when the job status is failed', async () => {
      mockedClient.post.mockResolvedValue(makeJob({ status: 'failed' }));

      const { promise } = transcodeManager.prepare('m1');
      // Attach the rejection handler BEFORE flushing timers — otherwise the
      // promise rejects with no handler during the flush (unhandled rejection).
      const expectation = expect(promise).rejects.toThrow('Transcode failed');
      await jest.runOnlyPendingTimersAsync();
      await expectation;
    });

    it('rejects when a polled status is failed', async () => {
      mockedClient.post.mockResolvedValue(makeJob({ status: 'encoding' }));
      mockedClient.get.mockResolvedValue(makeStatus({ status: 'failed' }));

      const { promise } = transcodeManager.prepare('m1', { pollIntervalMs: 1000 });
      const expectation = expect(promise).rejects.toThrow('Transcode failed');
      await jest.runOnlyPendingTimersAsync();
      await expectation;
    });

    it('rejects on timeout when never ready', async () => {
      mockedClient.post.mockResolvedValue(makeJob({ status: 'encoding' }));
      mockedClient.get.mockResolvedValue(makeStatus({ status: 'encoding' }));

      const { promise } = transcodeManager.prepare('m1', {
        pollIntervalMs: 1000,
        maxWaitMs: 2000,
      });
      const expectation = expect(promise).rejects.toThrow(/timed out/);

      await jest.runOnlyPendingTimersAsync();
      await jest.advanceTimersByTimeAsync(3000);

      await expectation;
    });

    it('cancel() stops polling and rejects the pending promise', async () => {
      mockedClient.post.mockResolvedValue(makeJob({ status: 'encoding' }));
      mockedClient.get.mockResolvedValue(makeStatus({ status: 'encoding' }));

      const handle = transcodeManager.prepare('m1', { pollIntervalMs: 1000 });
      const expectation = expect(handle.promise).rejects.toThrow(/cancelled/);
      await jest.runOnlyPendingTimersAsync();
      handle.cancel();
      await expectation;
    });
  });
});
