// src/store/downloadStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem } from '../types/media';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface DownloadTask {
  id: string;
  itemId: string;
  item: MediaItem;
  status: DownloadStatus;
  progress: number; // 0-1
  downloadedBytes: number;
  totalBytes: number;
  localPath: string;
  quality: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  resumeOffset?: number;
}

interface DownloadState {
  tasks: Record<string, DownloadTask>;
  queue: { id: string; maxConcurrent: number; currentDownloadIds: string[] };
  isLoading: boolean;
  error: string | null;
  totalStorageUsed: number;
  availableStorage: number;

  addDownload: (item: MediaItem, quality?: string) => Promise<string>;
  removeDownload: (taskId: string) => Promise<void>;
  pauseDownload: (taskId: string) => void;
  resumeDownload: (taskId: string) => void;
  cancelDownload: (taskId: string) => void;
  retryDownload: (taskId: string) => void;
  clearCompleted: () => void;
  clearFailed: () => void;
  updateTaskProgress: (taskId: string, downloadedBytes: number, totalBytes: number) => void;
  updateTaskStatus: (taskId: string, status: DownloadStatus, error?: string) => void;
  updateTaskLocalPath: (taskId: string, localPath: string) => void;
  loadPersistedTasks: () => Promise<void>;
  persistTasks: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  calculateTotalStorageUsed: () => number;
  getActiveDownloads: () => DownloadTask[];
  getQueuedDownloads: () => DownloadTask[];
  getCompletedDownloads: () => DownloadTask[];
  getDownloadForItem: (itemId: string) => DownloadTask | undefined;
  isItemDownloaded: (itemId: string) => boolean;
  getItemLocalPath: (itemId: string) => string | null;
}

const DOWNLOADS_KEY = 'phlix_downloads_v2';
const STORAGE_KEY = 'phlix_download_storage';

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: {},
  queue: { id: 'main', maxConcurrent: 2, currentDownloadIds: [] },
  isLoading: false,
  error: null,
  totalStorageUsed: 0,
  availableStorage: 0,

  addDownload: async (item: MediaItem, quality = 'original') => {
    const { tasks } = get();
    const existing = Object.values(tasks).find(
      (t) => t.itemId === item.id && t.status !== 'completed' && t.status !== 'cancelled'
    );
    if (existing) return existing.id;

    const taskId = `dl_${item.id}_${Date.now()}`;
    const task: DownloadTask = {
      id: taskId,
      itemId: item.id,
      item,
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      localPath: '',
      quality,
      createdAt: Date.now(),
    };

    set((state) => ({ tasks: { ...state.tasks, [taskId]: task }, error: null }));
    await get().persistTasks();
    return taskId;
  },

  removeDownload: async (taskId: string) => {
    const { tasks } = get();
    if (!tasks[taskId]) return;
    set((state) => {
      const next = { ...state.tasks };
      delete next[taskId];
      return { tasks: next };
    });
    await get().persistTasks();
    await get().refreshStorageStats();
  },

  pauseDownload: (taskId: string) => {
    const task = get().tasks[taskId];
    if (task && task.status === 'downloading') {
      get().updateTaskStatus(taskId, 'paused');
    }
  },

  resumeDownload: (taskId: string) => {
    const task = get().tasks[taskId];
    if (task && task.status === 'paused') {
      get().updateTaskStatus(taskId, 'queued');
    }
  },

  cancelDownload: (taskId: string) => {
    const task = get().tasks[taskId];
    if (task) get().updateTaskStatus(taskId, 'cancelled');
  },

  retryDownload: (taskId: string) => {
    const task = get().tasks[taskId];
    if (task && task.status === 'failed') {
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: { ...task, status: 'queued', progress: 0, downloadedBytes: 0, error: undefined, resumeOffset: undefined },
        },
      }));
      get().persistTasks();
    }
  },

  clearCompleted: () => {
    const { tasks } = get();
    const completedIds = Object.values(tasks).filter((t) => t.status === 'completed').map((t) => t.id);
    set((state) => {
      const next = { ...state.tasks };
      completedIds.forEach((id) => delete next[id]);
      return { tasks: next };
    });
    get().persistTasks();
  },

  clearFailed: () => {
    const { tasks } = get();
    const failedIds = Object.values(tasks).filter((t) => t.status === 'failed').map((t) => t.id);
    set((state) => {
      const next = { ...state.tasks };
      failedIds.forEach((id) => delete next[id]);
      return { tasks: next };
    });
    get().persistTasks();
  },

  updateTaskProgress: (taskId: string, downloadedBytes: number, totalBytes: number) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const progress = totalBytes > 0 ? downloadedBytes / totalBytes : 0;
      return {
        tasks: {
          ...state.tasks,
          [taskId]: { ...task, status: 'downloading', downloadedBytes, totalBytes, progress, resumeOffset: downloadedBytes },
        },
      };
    });
  },

  updateTaskStatus: (taskId: string, status: DownloadStatus, error?: string) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const updates: Partial<DownloadTask> = { status };
      if (error !== undefined) updates.error = error;
      if (status === 'completed') { updates.completedAt = Date.now(); updates.progress = 1; }
      return { tasks: { ...state.tasks, [taskId]: { ...task, ...updates } } };
    });
    get().persistTasks();
    get().refreshStorageStats();
  },

  updateTaskLocalPath: (taskId: string, localPath: string) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      return { tasks: { ...state.tasks, [taskId]: { ...task, localPath } } };
    });
    get().persistTasks();
  },

  loadPersistedTasks: async () => {
    try {
      const [data, storageData] = await Promise.all([
        AsyncStorage.getItem(DOWNLOADS_KEY),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      if (data) set({ tasks: JSON.parse(data) });
      if (storageData) {
        const { totalStorageUsed = 0, availableStorage = 0 } = JSON.parse(storageData);
        set({ totalStorageUsed, availableStorage });
      }
    } catch (err) { console.error('[downloadStore] Failed to load:', err); }
  },

  persistTasks: async () => {
    try {
      const { tasks, totalStorageUsed, availableStorage } = get();
      await Promise.all([
        AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(tasks)),
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ totalStorageUsed, availableStorage })),
      ]);
    } catch (err) { console.error('[downloadStore] Failed to persist:', err); }
  },

  refreshStorageStats: async () => {
    const totalUsed = get().calculateTotalStorageUsed();
    const available = 10 * 1024 * 1024 * 1024 - totalUsed;
    set({ totalStorageUsed: totalUsed, availableStorage: Math.max(0, available) });
  },

  calculateTotalStorageUsed: () => {
    return Object.values(get().tasks)
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.totalBytes, 0);
  },

  getActiveDownloads: () => Object.values(get().tasks).filter((t) => t.status === 'downloading' || t.status === 'queued'),
  getQueuedDownloads: () => Object.values(get().tasks).filter((t) => t.status === 'queued'),
  getCompletedDownloads: () => Object.values(get().tasks).filter((t) => t.status === 'completed'),
  getDownloadForItem: (itemId: string) => Object.values(get().tasks).find((t) => t.itemId === itemId && t.status === 'completed'),
  isItemDownloaded: (itemId: string) => get().getDownloadForItem(itemId) !== undefined,
  getItemLocalPath: (itemId: string) => get().getDownloadForItem(itemId)?.localPath ?? null,
}));
