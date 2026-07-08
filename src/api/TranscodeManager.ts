// src/api/TranscodeManager.ts
/* eslint-disable no-void -- `void` marks intentional fire-and-forget polling promises */
import apiClient from './client';
import type {
  Rendition,
  TranscodeJob,
  TranscodeStatus,
  TranscodeSubtitle,
} from '../types/playback';

export interface PrepareOptions {
  /** Optional transcode profile override (`?profile=`). */
  profile?: string;
  /** Progress callback (0-100) called on each poll while encoding. */
  onProgress?: (progress: number) => void;
  /** Overall bound on prepare polling. Default ~120s. */
  maxWaitMs?: number;
  /** Poll interval. Default 1500ms. */
  pollIntervalMs?: number;
}

export interface PrepareResult {
  /** ABSOLUTE signed HLS master URL — play directly (bypasses axios baseURL). */
  masterUrl: string;
  /** Signed VTT subtitle tracks discovered during transcode. */
  subtitles: TranscodeSubtitle[];
  /**
   * The playable ABR quality ladder (server A7 `variants[]`), highest-first.
   * Empty `[]` when the server is legacy/pre-ABR (client falls back to Auto-only
   * native ABR on `masterUrl`). Feeds the mobile `QualityMenu` (G3).
   */
  variants: Rendition[];
}

/** A cancellable, polling prepare handle. */
export interface PrepareHandle {
  /** Resolves with the ready HLS master URL + subtitles; rejects on failure/timeout/cancel. */
  promise: Promise<PrepareResult>;
  /** Stop polling (e.g. on screen unmount). Rejects the promise if still pending. */
  cancel: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_MAX_WAIT_MS = 120_000;

class TranscodeManager {
  /**
   * Start (or reuse) a transcode job → POST /api/v1/media/{id}/transcode.
   * NO body — the server picks the profile from the X-Phlix-Device-Type header
   * (sent globally by client.ts). `?profile=` is appended only when provided.
   * `master_url`/`hls_url`/`dash_url` come back ABSOLUTE + signed.
   */
  async startTranscode(itemId: string, profile?: string): Promise<TranscodeJob> {
    const params = profile ? { profile } : undefined;
    return apiClient.post<TranscodeJob>(
      `/media/${itemId}/transcode`,
      undefined,
      params ? { params } : undefined,
    );
  }

  /** Poll a job → GET /api/v1/transcode/{jobId}/status. */
  async getStatus(jobId: string): Promise<TranscodeStatus> {
    return apiClient.get<TranscodeStatus>(`/transcode/${jobId}/status`);
  }

  /**
   * Start a transcode and poll its status until the HLS playlist is ready,
   * returning the signed master URL + subtitle tracks. Throws on a failed job
   * or timeout. The returned handle exposes `cancel()` so a screen can stop
   * polling on unmount.
   */
  prepare(itemId: string, opts: PrepareOptions = {}): PrepareHandle {
    const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

    let cancelled = false;
    let jobId = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rejectOuter: ((reason: Error) => void) | null = null;
    // The ladder can arrive on the start response and/or any status poll; keep
    // the most recent non-empty list so the resolved result always carries it.
    let lastVariants: Rendition[] = [];

    const clearTimer = (): void => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const isReady = (status: string, playlistReady: boolean): boolean =>
      status === 'ready' || playlistReady;

    const promise = new Promise<PrepareResult>((resolve, reject) => {
      rejectOuter = reject;
      const deadline = Date.now() + maxWaitMs;

      const finishReady = (
        masterUrl: string,
        subtitles: TranscodeSubtitle[],
      ): void => {
        clearTimer();
        if (!masterUrl) {
          reject(new Error('Transcode ready but no master URL was returned'));
          return;
        }
        resolve({ masterUrl, subtitles: subtitles ?? [], variants: lastVariants });
      };

      // Remember the ladder off any response that carries one (start or poll).
      const rememberVariants = (variants?: Rendition[] | null): void => {
        if (Array.isArray(variants) && variants.length > 0) {
          lastVariants = variants;
        }
      };

      const poll = async (lastMasterUrl: string): Promise<void> => {
        if (cancelled) {
          return;
        }
        try {
          const status = await this.getStatus(jobId);
          if (cancelled) {
            return;
          }
          rememberVariants(status.variants);
          opts.onProgress?.(status.progress);

          if (status.status === 'failed') {
            clearTimer();
            reject(new Error('Transcode failed'));
            return;
          }
          if (isReady(status.status, status.playlist_ready)) {
            finishReady(status.master_url || lastMasterUrl, status.subtitles);
            return;
          }
          if (Date.now() >= deadline) {
            clearTimer();
            reject(new Error('Transcode timed out while preparing playback'));
            return;
          }
          timer = setTimeout(() => {
            void poll(lastMasterUrl);
          }, pollIntervalMs);
        } catch (err) {
          clearTimer();
          reject(err instanceof Error ? err : new Error('Transcode status check failed'));
        }
      };

      // Kick off: start the job, then poll. A reused/already-ready job short-circuits.
      void (async () => {
        try {
          const job = await this.startTranscode(itemId, opts.profile);
          if (cancelled) {
            return;
          }
          jobId = job.job_id;
          rememberVariants(job.variants);
          if (job.status === 'failed') {
            reject(new Error('Transcode failed'));
            return;
          }
          if (isReady(job.status, false)) {
            finishReady(job.master_url, job.subtitles);
            return;
          }
          void poll(job.master_url);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to start transcode'));
        }
      })();
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        clearTimer();
        rejectOuter?.(new Error('Transcode preparation cancelled'));
      },
    };
  }
}

export const transcodeManager = new TranscodeManager();
export default transcodeManager;
