// src/screens/DownloadsScreen.tsx
import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeContainer } from '../components/layout';
import { EmptyState } from '../components/ui/EmptyState';
import { downloadService } from '../services/DownloadService';
import { useDownloadStore, DownloadTask, DownloadStatus } from '../store/downloadStore';
import { formatFileSize } from '../utils/formatters';

function getStatusLabel(status: DownloadStatus): string {
  switch (status) {
    case 'queued': return 'Queued';
    case 'downloading': return 'Downloading';
    case 'paused': return 'Paused';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function getStatusColor(status: DownloadStatus): string {
  switch (status) {
    case 'downloading': return '#0066cc';
    case 'queued': return '#888';
    case 'paused': return '#ffc107';
    case 'completed': return '#28a745';
    case 'failed': return '#dc3545';
    default: return '#888';
  }
}

const DownloadItemRow: React.FC<{
  task: DownloadTask;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ task, onPause, onResume, onCancel, onRetry, onDelete }) => {
  const isDownloading = task.status === 'downloading';
  const isPaused = task.status === 'paused';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const isQueued = task.status === 'queued';

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Download', `Cancel downloading "${task.item.name}"?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => onCancel(task.id) },
    ]);
  }, [task.id, task.item.name, onCancel]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Download', `Remove "${task.item.name}" from downloads? This will free ${formatFileSize(task.totalBytes)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(task.id) },
    ]);
  }, [task.id, task.item.name, task.totalBytes, onDelete]);

  return (
    <View style={styles.downloadItem}>
      <View style={styles.thumbnail}>
        <Text style={styles.thumbnailText}>🎬</Text>
      </View>
      <View style={styles.downloadInfo}>
        <Text style={styles.downloadName} numberOfLines={1}>{task.item.name}</Text>
        <Text style={styles.downloadMeta}>
          {task.item.type === 'movie' ? 'Movie' : 'Episode'}
          {task.item.year ? ` • ${task.item.year}` : ''}
          {' • '}{formatFileSize(task.totalBytes)}
        </Text>
        <View style={styles.statusRow}>
          {(isDownloading || isQueued) && (
            <>
              <Text style={styles.progressText}>
                {isQueued ? 'Queued' : `${Math.round(task.progress * 100)}%`}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${task.progress * 100}%`, backgroundColor: getStatusColor(task.status) }]} />
              </View>
            </>
          )}
          {isPaused && (
            <Text style={[styles.statusText, { color: getStatusColor('paused') }]}>
              Paused — {formatFileSize(task.downloadedBytes)} / {formatFileSize(task.totalBytes)}
            </Text>
          )}
          {isCompleted && (
            <Text style={[styles.statusText, { color: getStatusColor('completed') }]}>
              {formatFileSize(task.totalBytes)} — Ready offline
            </Text>
          )}
          {isFailed && (
            <Text style={[styles.statusText, { color: getStatusColor('failed') }]}>
              Failed{task.error ? `: ${task.error}` : ''}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {isPaused && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onResume(task.id)}>
            <Text style={styles.actionBtnText}>▶️</Text>
          </TouchableOpacity>
        )}
        {isDownloading && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onPause(task.id)}>
            <Text style={styles.actionBtnText}>⏸️</Text>
          </TouchableOpacity>
        )}
        {isFailed && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onRetry(task.id)}>
            <Text style={styles.actionBtnText}>🔄</Text>
          </TouchableOpacity>
        )}
        {(isQueued || isDownloading || isPaused) && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
            <Text style={styles.actionBtnText}>✕</Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Text style={styles.actionBtnText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const StorageHeader: React.FC<{ used: number; available: number }> = ({ used, available }) => {
  const total = used + available;
  const usedPercent = total > 0 ? (used / total) * 100 : 0;
  return (
    <View style={styles.storageHeader}>
      <View style={styles.storageRow}>
        <Text style={styles.storageLabel}>Storage Used</Text>
        <Text style={styles.storageValue}>{formatFileSize(used)} of {formatFileSize(total)}</Text>
      </View>
      <View style={styles.storageBar}>
        <View style={[styles.storageFill, { width: `${usedPercent}%` }]} />
      </View>
    </View>
  );
};

const DownloadsScreen: React.FC = () => {
  const tasks = useDownloadStore((state) => state.tasks);
  const totalStorageUsed = useDownloadStore((state) => state.totalStorageUsed);
  const availableStorage = useDownloadStore((state) => state.availableStorage);
  const pauseDownload = useDownloadStore((state) => state.pauseDownload);
  const resumeDownload = useDownloadStore((state) => state.resumeDownload);
  const cancelDownload = useDownloadStore((state) => state.cancelDownload);
  const retryDownload = useDownloadStore((state) => state.retryDownload);
  const removeDownload = useDownloadStore((state) => state.removeDownload);
  const refreshStorageStats = useDownloadStore((state) => state.refreshStorageStats);
  const loadPersistedTasks = useDownloadStore((state) => state.loadPersistedTasks);

  useEffect(() => {
    loadPersistedTasks();
    refreshStorageStats();
  }, [loadPersistedTasks, refreshStorageStats]);

  const downloads = Object.values(tasks).sort((a, b) => {
    const order: Record<DownloadStatus, number> = { downloading: 0, queued: 1, paused: 2, failed: 3, completed: 4, cancelled: 5 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return b.createdAt - a.createdAt;
  });

  const activeDownloads = downloads.filter((t) => t.status === 'downloading' || t.status === 'queued');
  const otherDownloads = downloads.filter((t) => t.status !== 'downloading' && t.status !== 'queued');
  const sortedDownloads = [...activeDownloads, ...otherDownloads];

  const handlePause = useCallback((id: string) => downloadService.pauseDownload(id), []);
  const handleResume = useCallback((id: string) => downloadService.resumeDownload(id), []);
  const handleCancel = useCallback((id: string) => downloadService.cancelDownload(id), []);
  const handleRetry = useCallback((id: string) => downloadService.retryDownload(id), []);
  const handleDelete = useCallback(async (id: string) => { await downloadService.deleteDownload(id); }, []);

  const renderItem = useCallback(({ item }: { item: DownloadTask }) => (
    <DownloadItemRow task={item} onPause={handlePause} onResume={handleResume} onCancel={handleCancel} onRetry={handleRetry} onDelete={handleDelete} />
  ), [handlePause, handleResume, handleCancel, handleRetry, handleDelete]);

  if (downloads.length === 0) {
    return (
      <SafeContainer>
        <EmptyState icon="⬇️" title="No Downloads" message="Download movies and shows to watch offline" />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={sortedDownloads}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<StorageHeader used={totalStorageUsed} available={availableStorage} />}
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  listContent: { padding: 16 },
  storageHeader: { marginBottom: 16, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 12 },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  storageLabel: { color: '#888', fontSize: 13 },
  storageValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  storageBar: { height: 4, backgroundColor: '#3d3d3d', borderRadius: 2 },
  storageFill: { height: '100%', backgroundColor: '#0066cc', borderRadius: 2 },
  downloadItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 10 },
  thumbnail: { width: 48, height: 64, borderRadius: 6, backgroundColor: '#2d2d44', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  thumbnailText: { fontSize: 20 },
  downloadInfo: { flex: 1, marginRight: 8 },
  downloadName: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  downloadMeta: { color: '#888', fontSize: 12, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', minHeight: 20 },
  progressBar: { flex: 1, height: 4, backgroundColor: '#3d3d3d', borderRadius: 2, marginLeft: 10 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { color: '#888', fontSize: 12, minWidth: 38 },
  statusText: { fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2d2d44', justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 },
});

export default DownloadsScreen;
