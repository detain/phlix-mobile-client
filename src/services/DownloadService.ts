// src/services/DownloadService.ts
import { NativeModules, Platform } from 'react-native';
import { MediaItem } from '../types/media';
import { useDownloadStore, DownloadTask } from '../store/downloadStore';
import { playbackManager } from '../api/PlaybackManager';

const MAX_CONCURRENT_DOWNLOADS = 2;

class DownloadService {
  private activeDownloads: Set<string> = new Set();
  private listeners: Set<(task: DownloadTask) => void> = new Set();
  private resumeData: Map<string, { downloadedBytes: number }> = new Map();

  constructor() {
    useDownloadStore.getState().loadPersistedTasks();
  }

  async startDownload(item: MediaItem, quality = 'original'): Promise<string> {
    const store = useDownloadStore.getState();
    const existingTask = Object.values(store.tasks).find(
      (t) => t.itemId === item.id && t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
    );
    if (existingTask) return existingTask.id;

    const taskId = await store.addDownload(item, quality);
    this.processQueue();
    return taskId;
  }

  pauseDownload(taskId: string): void {
    const store = useDownloadStore.getState();
    const task = store.tasks[taskId];
    if (!task || task.status !== 'downloading') return;

    const PhlixDownloader = NativeModules.PhlixDownloader;
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
    if (!task || task.status !== 'paused') return;
    store.updateTaskStatus(taskId, 'queued');
    this.processQueue();
  }

  async cancelDownload(taskId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const PhlixDownloader = NativeModules.PhlixDownloader;
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
    if (!task || task.status !== 'completed') return;

    const PhlixDownloader = NativeModules.PhlixDownloader;
    if (PhlixDownloader?.deleteFile) {
      try { await PhlixDownloader.deleteFile(task.localPath); } catch {}
    }
    await store.removeDownload(taskId);
  }

  private processQueue(): void {
    const store = useDownloadStore.getState();
    const activeCount = Object.values(store.tasks).filter((t) => t.status === 'downloading').length;
    if (activeCount >= MAX_CONCURRENT_DOWNLOADS) return;

    const queued = Object.values(store.tasks).filter((t) => t.status === 'queued');
    if (queued.length === 0) return;
    this.beginDownload(queued[0]);
  }

  private async beginDownload(task: DownloadTask): Promise<void> {
    const taskId = task.id;
    this.activeDownloads.add(taskId);

    const store = useDownloadStore.getState();
    store.updateTaskStatus(taskId, 'downloading');

    try {
      const streamInfo = await playbackManager.getStreamUrl(task.itemId, { quality: task.quality });
      const localPath = this.getLocalPath(task.item);
      store.updateTaskProgress(taskId, task.resumeOffset ?? 0, streamInfo.size);

      const PhlixDownloader = NativeModules.PhlixDownloader;
      if (PhlixDownloader?.startDownload) {
        PhlixDownloader.startDownload(taskId, streamInfo.url, localPath, task.resumeOffset ?? 0, streamInfo.size);
      } else {
        this.downloadSimulated(taskId, streamInfo.size);
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
      return `${NativeModules.PhlixDownloader?.documentsPath || ''}/${filename}`;
    }
    return `/storage/emulated/0/Download/Phlix/${filename}`;
  }

  handleNativeProgress(taskId: string, downloadedBytes: number, totalBytes: number): void {
    const store = useDownloadStore.getState();
    store.updateTaskProgress(taskId, downloadedBytes, totalBytes);
    this.resumeData.set(taskId, { downloadedBytes });
  }

  handleNativeComplete(taskId: string, localPath: string): void {
    const store = useDownloadStore.getState();
    store.updateTaskLocalPath(taskId, localPath);
    store.updateTaskStatus(taskId, 'completed');
    this.activeDownloads.delete(taskId);
    this.resumeData.delete(taskId);
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
