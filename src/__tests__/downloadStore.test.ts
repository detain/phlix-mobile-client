// src/__tests__/downloadStore.test.ts
import { useDownloadStore, DownloadTask } from '../store/downloadStore';
import { MediaItem } from '../types/media';

function makeItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'media-1',
    name: 'Test Movie',
    type: 'movie',
    overview: 'A test movie',
    poster_url: 'https://example.com/poster.jpg',
    year: 2024,
    run_time_ticks: 720000000000,
    genres: ['Action'],
    ...overrides,
  };
}

function makeTask(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 'dl_media-1_1234567890',
    itemId: 'media-1',
    item: makeItem(),
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 1024 * 1024 * 500,
    localPath: '/storage/emulated/0/Download/Phlex/media-1_Test_Movie.mp4',
    quality: 'original',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('downloadStore', () => {
  beforeEach(() => {
    useDownloadStore.setState({
      tasks: {},
      queue: { id: 'main', maxConcurrent: 2, currentDownloadIds: [] },
      isLoading: false,
      error: null,
      totalStorageUsed: 0,
      availableStorage: 10 * 1024 * 1024 * 1024,
    });
  });

  describe('addDownload', () => {
    it('adds a new download task to the store', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1', name: 'Movie 1' }));
      const tasks = useDownloadStore.getState().tasks;
      expect(tasks[taskId]).toBeDefined();
      expect(tasks[taskId].status).toBe('queued');
      expect(tasks[taskId].itemId).toBe('item-1');
    });

    it('reuses existing task id for same item if not completed', async () => {
      const store = useDownloadStore.getState();
      const item = makeItem({ id: 'item-1', name: 'Movie 1' });
      const taskId1 = await store.addDownload(item);
      const taskId2 = await store.addDownload(item);
      expect(taskId1).toBe(taskId2);
      expect(Object.keys(useDownloadStore.getState().tasks).length).toBe(1);
    });

    it('creates separate tasks for different items', async () => {
      const store = useDownloadStore.getState();
      const taskId1 = await store.addDownload(makeItem({ id: 'item-1' }));
      const taskId2 = await store.addDownload(makeItem({ id: 'item-2' }));
      expect(taskId1).not.toBe(taskId2);
      expect(Object.keys(useDownloadStore.getState().tasks).length).toBe(2);
    });

    it('sets default quality to original', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      expect(useDownloadStore.getState().tasks[taskId].quality).toBe('original');
    });

    it('accepts custom quality', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }), '1080p');
      expect(useDownloadStore.getState().tasks[taskId].quality).toBe('1080p');
    });
  });

  describe('removeDownload', () => {
    it('removes a task from the store', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      await store.removeDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId]).toBeUndefined();
    });

    it('handles non-existent task id gracefully', async () => {
      const store = useDownloadStore.getState();
      await store.addDownload(makeItem({ id: 'item-1' }));
      await store.removeDownload('non-existent-id');
      expect(Object.keys(useDownloadStore.getState().tasks).length).toBe(1);
    });
  });

  describe('pauseDownload', () => {
    it('changes downloading task to paused', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskStatus(taskId, 'downloading');
      store.pauseDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('paused');
    });

    it('does nothing for non-downloading task', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.pauseDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('queued');
    });
  });

  describe('resumeDownload', () => {
    it('changes paused task back to queued', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskStatus(taskId, 'paused');
      store.resumeDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('queued');
    });

    it('does nothing for non-paused task', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.resumeDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('queued');
    });
  });

  describe('cancelDownload', () => {
    it('marks task as cancelled', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.cancelDownload(taskId);
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('cancelled');
    });
  });

  describe('retryDownload', () => {
    it('resets failed task to queued and clears error', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      useDownloadStore.setState((state) => ({
        tasks: {
          ...state.tasks,
          [taskId]: { ...state.tasks[taskId], status: 'failed' as const, error: 'Network timeout', progress: 0.5, downloadedBytes: 250000 },
        },
      }));
      store.retryDownload(taskId);
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.status).toBe('queued');
      expect(task.error).toBeUndefined();
      expect(task.progress).toBe(0);
    });
  });

  describe('updateTaskProgress', () => {
    it('updates progress correctly', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskProgress(taskId, 50 * 1024 * 1024, 100 * 1024 * 1024);
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.downloadedBytes).toBe(50 * 1024 * 1024);
      expect(task.totalBytes).toBe(100 * 1024 * 1024);
      expect(task.progress).toBe(0.5);
    });

    it('handles zero totalBytes gracefully', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskProgress(taskId, 0, 0);
      expect(useDownloadStore.getState().tasks[taskId].progress).toBe(0);
    });
  });

  describe('updateTaskStatus', () => {
    it('updates status correctly', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskStatus(taskId, 'downloading');
      expect(useDownloadStore.getState().tasks[taskId].status).toBe('downloading');
    });

    it('sets completedAt when status is completed', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskStatus(taskId, 'completed');
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.status).toBe('completed');
      expect(task.completedAt).toBeDefined();
    });

    it('sets error message when provided', async () => {
      const store = useDownloadStore.getState();
      const taskId = await store.addDownload(makeItem({ id: 'item-1' }));
      store.updateTaskStatus(taskId, 'failed', 'Connection refused');
      const task = useDownloadStore.getState().tasks[taskId];
      expect(task.status).toBe('failed');
      expect(task.error).toBe('Connection refused');
    });
  });

  describe('clearCompleted', () => {
    it('removes all completed tasks', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', status: 'completed' }),
          'task-2': makeTask({ id: 'task-2', status: 'downloading' }),
          'task-3': makeTask({ id: 'task-3', status: 'completed' }),
        },
      });
      useDownloadStore.getState().clearCompleted();
      const tasks = useDownloadStore.getState().tasks;
      expect(Object.keys(tasks).length).toBe(1);
      expect(tasks['task-2']).toBeDefined();
    });
  });

  describe('clearFailed', () => {
    it('removes all failed tasks', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', status: 'failed' }),
          'task-2': makeTask({ id: 'task-2', status: 'downloading' }),
        },
      });
      useDownloadStore.getState().clearFailed();
      const tasks = useDownloadStore.getState().tasks;
      expect(Object.keys(tasks).length).toBe(1);
      expect(tasks['task-2']).toBeDefined();
    });
  });

  describe('getActiveDownloads', () => {
    it('returns only downloading and queued tasks', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', status: 'downloading' }),
          'task-2': makeTask({ id: 'task-2', status: 'queued' }),
          'task-3': makeTask({ id: 'task-3', status: 'completed' }),
          'task-4': makeTask({ id: 'task-4', status: 'failed' }),
        },
      });
      const active = useDownloadStore.getState().getActiveDownloads();
      expect(active.length).toBe(2);
      expect(active.map((t) => t.id)).toEqual(['task-1', 'task-2']);
    });
  });

  describe('getCompletedDownloads', () => {
    it('returns only completed tasks', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', status: 'completed' }),
          'task-2': makeTask({ id: 'task-2', status: 'downloading' }),
          'task-3': makeTask({ id: 'task-3', status: 'completed' }),
        },
      });
      expect(useDownloadStore.getState().getCompletedDownloads().length).toBe(2);
    });
  });

  describe('getDownloadForItem', () => {
    it('returns completed download for item', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', itemId: 'item-1', status: 'completed' }),
          'task-2': makeTask({ id: 'task-2', itemId: 'item-2', status: 'downloading' }),
        },
      });
      const download = useDownloadStore.getState().getDownloadForItem('item-1');
      expect(download).toBeDefined();
      expect(download!.itemId).toBe('item-1');
    });

    it('returns undefined for non-downloaded item', () => {
      useDownloadStore.setState({
        tasks: { 'task-1': makeTask({ id: 'task-1', itemId: 'item-1', status: 'downloading' }) },
      });
      expect(useDownloadStore.getState().getDownloadForItem('item-1')).toBeUndefined();
    });
  });

  describe('isItemDownloaded', () => {
    it('returns true for downloaded item', () => {
      useDownloadStore.setState({
        tasks: { 'task-1': makeTask({ id: 'task-1', itemId: 'item-1', status: 'completed' }) },
      });
      expect(useDownloadStore.getState().isItemDownloaded('item-1')).toBe(true);
    });

    it('returns false for non-downloaded item', () => {
      useDownloadStore.setState({
        tasks: { 'task-1': makeTask({ id: 'task-1', itemId: 'item-1', status: 'downloading' }) },
      });
      expect(useDownloadStore.getState().isItemDownloaded('item-1')).toBe(false);
    });
  });

  describe('getItemLocalPath', () => {
    it('returns local path for completed download', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', itemId: 'item-1', status: 'completed', localPath: '/storage/downloads/movie.mp4' }),
        },
      });
      expect(useDownloadStore.getState().getItemLocalPath('item-1')).toBe('/storage/downloads/movie.mp4');
    });

    it('returns null for non-downloaded item', () => {
      expect(useDownloadStore.getState().getItemLocalPath('non-existent')).toBeNull();
    });
  });

  describe('calculateTotalStorageUsed', () => {
    it('sums only completed downloads', () => {
      useDownloadStore.setState({
        tasks: {
          'task-1': makeTask({ id: 'task-1', status: 'completed', totalBytes: 100 * 1024 * 1024 }),
          'task-2': makeTask({ id: 'task-2', status: 'completed', totalBytes: 200 * 1024 * 1024 }),
          'task-3': makeTask({ id: 'task-3', status: 'downloading', totalBytes: 300 * 1024 * 1024 }),
        },
      });
      expect(useDownloadStore.getState().calculateTotalStorageUsed()).toBe(300 * 1024 * 1024);
    });

    it('returns 0 when no completed downloads', () => {
      expect(useDownloadStore.getState().calculateTotalStorageUsed()).toBe(0);
    });
  });
});
