/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/DownloadService.ts
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { MediaItem } from '../types/media';
import { useDownloadStore, DownloadTask } from '../store/downloadStore';
import { playbackManager } from '../api/PlaybackManager';
import {
  DOWNLOAD_EVENTS,
  type PhlixDownloaderInterface,
  type DownloadProgressPayload,
  type DownloadCompletePayload,
  type DownloadErrorPayload,
  type DownloadPausedPayload,
} from '../native/types';

const MAX_CONCURRENT_DOWNLOADS = 2;

// Re-export the native event-name constants so callers/tests share one source.
export { DOWNLOAD_EVENTS };

function getNativeDownloader(): PhlixDownloaderInterface | undefined {
  return NativeModules.PhlixDownloader as PhlixDownloaderInterface | undefined;
}

class DownloadService {
  private activeDownloads: Set<string> = new Set();
  private listeners: Set<(task: DownloadTask) => void> = new Set();
  private resumeData: Map<string, { downloadedBytes: number }> = new Map();
  private eventSubscriptions: EmitterSubscription[] = [];

  constructor() {
    useDownloadStore.getState().loadPersistedTasks();
    this.initNativeEvents();
  }

  /**
   * Subscribe to the native PhlixDownloader event stream. Guarded so it is a
   * no-op when the native module is absent (Jest + the simulated fallback path),
   * which keeps the app working before the native side is built.
   */
  private initNativeEvents(): void {
    const downloader = getNativeDownloader();
    if (!downloader) {
      return;
    }
    let emitter: NativeEventEmitter;
    try {
      emitter = new NativeEventEmitter(
        downloader as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
      );
    } catch {
      // NativeEventEmitter can throw if the module isn't a real emitter — stay
      // on the simulated path rather than crashing.
      return;
    }
    this.eventSubscriptions = [
      emitter.addListener(DOWNLOAD_EVENTS.progress, (p: DownloadProgressPayload) => {
        this.handleNativeProgress(p.taskId, p.downloadedBytes, p.totalBytes);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.complete, (p: DownloadCompletePayload) => {
        this.handleNativeComplete(p.taskId, p.localPath);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.error, (p: DownloadErrorPayload) => {
        this.handleNativeError(p.taskId, p.error);
      }),
      emitter.addListener(DOWNLOAD_EVENTS.paused, (p: DownloadPausedPayload) => {
        this.handleNativePaused(p.taskId, p.downloadedBytes);
      }),
    ];
  }

  /**
   * Remove all native event subscriptions. Not used in the normal app lifecycle
   * (the service is an app-lifetime singleton) but provided for completeness /
   * tests so listeners can be torn down deterministically.
   */
  dispose(): void {
    this.eventSubscriptions.forEach((sub) => sub.remove());
    this.eventSubscriptions = [];
  }

  async startDownload(item: MediaItem, quality = 'original'): Promise<string> {
    const store = useDownloadStore.getState();
    const existingTask = Object.values(store.tasks).find(
      (t) => t.itemId === item.id && t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
    );
    if (existingTask) {
      return existingTask.id;
    }

    const taskId = await store.addDownload(item, quality);
    this.processQueue();
    return taskId;
  }

  pauseDownload(taskId: string): void {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'downloading') {
      return;
    }

    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.pauseDownload) {
      PhlixDownloader.pauseDownload(taskId);
    } else {
      store.updateTaskStatus(taskId, 'paused');
    }
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  resumeDownload(taskId: string): void {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'paused') {
      return;
    }
    store.updateTaskStatus(taskId, 'queued');
    this.processQueue();
  }

  async cancelDownload(taskId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.cancelDownload) {
      PhlixDownloader.cancelDownload(taskId);
    }
    this.activeDownloads.delete(taskId);
    this.resumeData.delete(taskId);
    await store.removeDownload(taskId);
    this.processQueue();
  }

  retryDownload(taskId: string): void {
    useDownloadStore.getState().retryDownload(taskId);
    this.processQueue();
  }

  subscribe(callback: (task: DownloadTask) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getAllDownloads(): DownloadTask[] {
    return Object.values(useDownloadStore.getState().tasks);
  }

  getCompletedDownloads(): DownloadTask[] {
    return useDownloadStore.getState().getCompletedDownloads();
  }

  getDownloadForItem(itemId: string): DownloadTask | undefined {
    return useDownloadStore.getState().getDownloadForItem(itemId);
  }

  isItemDownloaded(itemId: string): boolean {
    return useDownloadStore.getState().isItemDownloaded(itemId);
  }

  getItemLocalPath(itemId: string): string | null {
    return useDownloadStore.getState().getItemLocalPath(itemId);
  }

  async deleteDownload(taskId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'completed') {
      return;
    }

    const PhlixDownloader = getNativeDownloader();
    if (PhlixDownloader?.deleteFile) {
      try { await PhlixDownloader.deleteFile(task.localPath); } catch {}
    }
    await store.removeDownload(taskId);
  }

  private processQueue(): void {
    const store = useDownloadStore.getState();
    const activeCount = Object.values(store.tasks).filter((t) => t.status === 'downloading').length;
    if (activeCount >= MAX_CONCURRENT_DOWNLOADS) {
      return;
    }

    const queued = Object.values(store.tasks).filter((t) => t.status === 'queued');
    if (queued.length === 0) {
      return;
    }
    this.beginDownload(queued[0]);
  }

  private async beginDownload(task: DownloadTask): Promise<void> {
    const taskId = task.id;
    this.activeDownloads.add(taskId);

    const store = useDownloadStore.getState();
    store.updateTaskStatus(taskId, 'downloading');

    try {
      // E2: getStreamUrl resolves the signed direct-play URL from media detail.
      // The total size is not known up front (no transcode probe here) — pass 0
      // and let the native downloader report the real size as it streams.
      // TODO(E3): use the transcode probe / Content-Length for an accurate total.
      const streamUrl = await playbackManager.getStreamUrl(task.itemId);
      if (!streamUrl) {
        throw new Error('No downloadable stream available for this item');
      }
      const localPath = this.getLocalPath(task.item);
      store.updateTaskProgress(taskId, task.resumeOffset ?? 0, 0);

      const PhlixDownloader = getNativeDownloader();
      if (PhlixDownloader?.startDownload) {
        // 5-arg shape (taskId, url, localPath, resumeOffset, totalBytesHint) —
        // identical across the TS interface and both native modules.
        PhlixDownloader.startDownload(taskId, streamUrl, localPath, task.resumeOffset ?? 0, 0);
      } else {
        this.downloadSimulated(taskId, 0);
      }
    } catch (err) {
      store.updateTaskStatus(taskId, 'failed', err instanceof Error ? err.message : 'Failed to start download');
      this.activeDownloads.delete(taskId);
      this.processQueue();
    }
  }

  private downloadSimulated(taskId: string, totalBytes: number): void {
    const store = useDownloadStore.getState();
    let downloaded = store.tasks[taskId]?.downloadedBytes ?? 0;

    const interval = setInterval(() => {
      const task = store.tasks[taskId];
      if (!task || task.status !== 'downloading') {
        clearInterval(interval);
        return;
      }
      downloaded = Math.min(downloaded + Math.floor(totalBytes * 0.1), totalBytes);
      store.updateTaskProgress(taskId, downloaded, totalBytes);

      const updated = store.tasks[taskId];
      this.notifyListeners(updated);

      if (downloaded >= totalBytes) {
        clearInterval(interval);
        const localPath = this.getLocalPath(updated.item);
        store.updateTaskLocalPath(taskId, localPath);
        store.updateTaskStatus(taskId, 'completed');
        this.activeDownloads.delete(taskId);
        this.processQueue();
      }
    }, 500);
  }

  private getLocalPath(item: MediaItem): string {
    const filename = `${item.id}_${item.name.replace(/[^a-z0-9]/gi, '_')}.mp4`;
    if (Platform.OS === 'ios') {
      return `${getNativeDownloader()?.documentsPath || ''}/${filename}`;
    }
    return `/storage/emulated/0/Download/Phlix/${filename}`;
  }

  handleNativeProgress(taskId: string, downloadedBytes: number, totalBytes: number): void {
    const store = useDownloadStore.getState();
    store.updateTaskProgress(taskId, downloadedBytes, totalBytes);
    this.resumeData.set(taskId, { downloadedBytes });
    const updated = store.tasks[taskId];
    if (updated) {
      this.notifyListeners(updated);
    }
  }

  handleNativeComplete(taskId: string, localPath: string): void {
    const store = useDownloadStore.getState();
    store.updateTaskLocalPath(taskId, localPath);
    store.updateTaskStatus(taskId, 'completed');
    this.activeDownloads.delete(taskId);
    this.resumeData.delete(taskId);
    const updated = store.tasks[taskId];
    if (updated) {
      this.notifyListeners(updated);
    }
    this.processQueue();
  }

  handleNativeError(taskId: string, error: string): void {
    const store = useDownloadStore.getState();
    store.updateTaskStatus(taskId, 'failed', error);
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  handleNativePaused(taskId: string, downloadedBytes: number): void {
    const store = useDownloadStore.getState();
    this.resumeData.set(taskId, { downloadedBytes });
    store.updateTaskStatus(taskId, 'paused');
    this.activeDownloads.delete(taskId);
    this.processQueue();
  }

  private notifyListeners(task: DownloadTask): void {
    this.listeners.forEach((cb) => cb(task));
  }
}

export const downloadService = new DownloadService();
export default downloadService;
