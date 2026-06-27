// src/screens/AdminLibrariesScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useAdminStore } from '../stores/useAdminStore';
import type { Library } from '../types/media';
import type { ScanJob } from '../types/admin';
import {
  LIBRARY_TYPES,
  type LibraryType,
  supportsSeriesPerDirectory,
  parsePathsInput,
  pathsToInput,
  isScanJobActive,
  scanJobBadge,
} from './admin/adminScreenHelpers';

const POLL_INTERVAL_MS = 2500;

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const AdminLibrariesScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const libraries = useAdminStore((state) => state.libraries);
  const isLoading = useAdminStore((state) => state.librariesLoading);
  const error = useAdminStore((state) => state.librariesError);
  const loadLibraries = useAdminStore((state) => state.loadLibraries);
  const createLibrary = useAdminStore((state) => state.createLibrary);
  const updateLibrary = useAdminStore((state) => state.updateLibrary);
  const deleteLibrary = useAdminStore((state) => state.deleteLibrary);
  const scanLibrary = useAdminStore((state) => state.scanLibrary);
  const rescanLibrary = useAdminStore((state) => state.rescanLibrary);
  const matchMetadata = useAdminStore((state) => state.matchMetadata);
  const getScanStatus = useAdminStore((state) => state.getScanStatus);
  const getScanHistory = useAdminStore((state) => state.getScanHistory);

  // Per-library live scan job (keyed by library id), driven by the poll.
  const [scanJobs, setScanJobs] = useState<Record<string, ScanJob | null>>({});

  // Set of library ids currently being polled. A single interval ticks all of
  // them; it is started lazily and torn down when none remain active OR on
  // unmount (cleanup below) so no timer leaks.
  const pollingIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Create / edit modal
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<LibraryType>('movie');
  const [draftPaths, setDraftPaths] = useState('');
  const [draftSeriesPerDir, setDraftSeriesPerDir] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Scan-history sheet
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLibrary, setHistoryLibrary] = useState<Library | null>(null);
  const [historyJobs, setHistoryJobs] = useState<ScanJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const stopTimerIfIdle = useCallback(() => {
    if (pollingIds.current.size === 0 && timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async () => {
    const ids = Array.from(pollingIds.current);
    for (const id of ids) {
      try {
        const job = await getScanStatus(id);
        if (!mountedRef.current) {
          return;
        }
        setScanJobs((prev) => ({ ...prev, [id]: job }));
        // Terminal (or absent) → stop polling THIS library.
        if (!isScanJobActive(job)) {
          pollingIds.current.delete(id);
        }
      } catch {
        // A transient status error stops polling this library; the badge keeps
        // its last value. (The store already recorded librariesError.)
        pollingIds.current.delete(id);
      }
    }
    stopTimerIfIdle();
  }, [getScanStatus, stopTimerIfIdle]);

  const startPolling = useCallback(
    (id: string) => {
      pollingIds.current.add(id);
      if (timerRef.current === null) {
        timerRef.current = setInterval(() => {
          // eslint-disable-next-line no-void -- fire-and-forget; pollOnce owns its errors
          void pollOnce();
        }, POLL_INTERVAL_MS);
      }
      // Kick an immediate poll so the badge appears without waiting a full tick.
      // eslint-disable-next-line no-void -- fire-and-forget; pollOnce owns its errors
      void pollOnce();
    },
    [pollOnce]
  );

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadLibraries();
    }
  }, [isAdmin, loadLibraries]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Single source of truth for timer teardown on unmount — no leaked intervals.
  useEffect(() => {
    mountedRef.current = true;
    // Capture the stable ref objects so the cleanup operates on the same
    // Set/interval the component mutates (these refs never get reassigned).
    const mounted = mountedRef;
    const ids = pollingIds;
    const timer = timerRef;
    return () => {
      mounted.current = false;
      ids.current.clear();
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, []);

  const triggerJob = async (
    library: Library,
    label: string,
    fn: () => Promise<{ status: string }>
  ) => {
    try {
      await fn();
      // Seed an optimistic "queued" badge then start polling for live status.
      setScanJobs((prev) => ({
        ...prev,
        [library.id]: {
          id: `pending-${library.id}`,
          library_id: library.id,
          job_type:
            label === 'Rescan'
              ? 'rescan'
              : label === 'Match metadata'
                ? 'metadata'
                : 'scan',
          status: 'queued',
          created_at: new Date().toISOString(),
        },
      }));
      startPolling(library.id);
    } catch (err) {
      Alert.alert(`${label} failed`, errText(err, `Could not start ${label.toLowerCase()}.`));
    }
  };

  const handleScan = (library: Library) =>
    triggerJob(library, 'Scan', () => scanLibrary(library.id));

  const handleRescan = (library: Library) =>
    triggerJob(library, 'Rescan', () => rescanLibrary(library.id));

  const handleMatch = (library: Library) =>
    triggerJob(library, 'Match metadata', () => matchMetadata(library.id));

  const openCreate = () => {
    setEditingLibrary(null);
    setDraftName('');
    setDraftType('movie');
    setDraftPaths('');
    setDraftSeriesPerDir(false);
    setEditorVisible(true);
  };

  const openEdit = (library: Library) => {
    setEditingLibrary(library);
    setDraftName(library.name);
    setDraftType((library.type as LibraryType) ?? 'movie');
    setDraftPaths(pathsToInput(library.paths));
    setDraftSeriesPerDir(
      Boolean(library.series_per_directory ?? library.options?.series_per_directory)
    );
    setEditorVisible(true);
  };

  const handleSubmitEditor = async () => {
    const name = draftName.trim();
    if (name.length < 1) {
      Alert.alert('Invalid name', 'Library name is required.');
      return;
    }
    const paths = parsePathsInput(draftPaths);
    if (paths.length < 1) {
      Alert.alert('Invalid paths', 'Add at least one path (comma- or line-separated).');
      return;
    }
    const seriesPerDir =
      supportsSeriesPerDirectory(draftType) && draftSeriesPerDir;
    setSubmitting(true);
    try {
      if (editingLibrary) {
        await updateLibrary(editingLibrary.id, {
          name,
          type: draftType,
          paths,
          series_per_directory: seriesPerDir,
        });
      } else {
        await createLibrary({
          name,
          type: draftType,
          paths,
          series_per_directory: seriesPerDir,
        });
      }
      setEditorVisible(false);
    } catch (err) {
      Alert.alert('Save failed', errText(err, 'Could not save library.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (library: Library) => {
    Alert.alert(
      'Delete library',
      `Delete "${library.name}"? Media files on disk are not removed, but the library and its catalog entries are.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLibrary(library.id);
              // Stop any in-flight poll for the now-gone library.
              pollingIds.current.delete(library.id);
              stopTimerIfIdle();
              setScanJobs((prev) => {
                const { [library.id]: _removed, ...rest } = prev;
                return rest;
              });
            } catch (err) {
              Alert.alert('Delete failed', errText(err, 'Could not delete library.'));
            }
          },
        },
      ]
    );
  };

  const openHistory = async (library: Library) => {
    setHistoryLibrary(library);
    setHistoryJobs([]);
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const jobs = await getScanHistory(library.id);
      if (mountedRef.current) {
        setHistoryJobs(jobs);
      }
    } catch (err) {
      Alert.alert('History failed', errText(err, 'Could not load scan history.'));
    } finally {
      if (mountedRef.current) {
        setHistoryLoading(false);
      }
    }
  };

  const renderLibrary = ({ item }: { item: Library }) => {
    const job = scanJobs[item.id] ?? null;
    const badge = scanJobBadge(job);
    return (
      <View style={styles.libCard}>
        <View style={styles.libHeader}>
          <View style={styles.libIdentity}>
            <Text style={styles.libName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.libMeta} numberOfLines={1}>
              {item.type}
              {typeof item.item_count === 'number'
                ? ` · ${item.item_count} items`
                : ''}
            </Text>
          </View>
          {badge ? <Text style={styles.scanBadge}>{badge}</Text> : null}
        </View>

        {job && job.status === 'running' && job.current_path ? (
          <Text style={styles.currentPath} numberOfLines={1}>
            {job.current_path}
          </Text>
        ) : null}
        {job && job.status === 'failed' && job.error_message ? (
          <Text style={styles.errorPath} numberOfLines={2}>
            {job.error_message}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleScan(item)}
          >
            <Text style={styles.actionText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRescan(item)}
          >
            <Text style={styles.actionText}>Rescan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleMatch(item)}
          >
            <Text style={styles.actionText}>Match metadata</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openHistory(item)}
          >
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEdit(item)}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionTextDanger}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Non-admin: the routes are admin-only — show an informational state.
  if (!isAdmin) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="🔒"
          title="Admin access required"
          message="This area is only available to server administrators."
        />
      </SafeContainer>
    );
  }

  if (isLoading && libraries.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && libraries.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Libraries</Text>
        <Text style={styles.headerSubtitle}>{libraries.length} libraries</Text>
      </View>

      <FlatList
        data={libraries}
        keyExtractor={(item) => item.id}
        renderItem={renderLibrary}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="No libraries"
            message="Add a library to start scanning your media."
          />
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={openCreate}>
        <Text style={styles.addButtonText}>+ Add Library</Text>
      </TouchableOpacity>

      {/* Create / edit library modal */}
      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditorVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              {editingLibrary ? 'Edit Library' : 'New Library'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Library name"
              placeholderTextColor="#666"
              value={draftName}
              onChangeText={setDraftName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {LIBRARY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, draftType === t && styles.chipActive]}
                  onPress={() => setDraftType(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draftType === t && styles.chipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Paths (one per line or comma)</Text>
            <TextInput
              style={[styles.input, styles.pathsInput]}
              placeholder={'/media/movies\n/mnt/share/films'}
              placeholderTextColor="#666"
              value={draftPaths}
              onChangeText={setDraftPaths}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />

            {supportsSeriesPerDirectory(draftType) ? (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Series per directory</Text>
                <Switch
                  value={draftSeriesPerDir}
                  onValueChange={setDraftSeriesPerDir}
                  trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
                />
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitEditor}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditorVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Scan-history sheet */}
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {historyLibrary?.name ?? 'Library'} — Scan History
            </Text>
            {historyLoading ? (
              <LoadingSpinner />
            ) : historyJobs.length === 0 ? (
              <Text style={styles.sheetEmpty}>No scan history yet.</Text>
            ) : (
              <ScrollView style={styles.sheetScroll}>
                {historyJobs.map((job) => (
                  <View key={job.id} style={styles.historyRow}>
                    <View style={styles.historyMain}>
                      <Text style={styles.historyType}>{job.job_type}</Text>
                      <Text style={styles.historyDate}>
                        {job.completed_at || job.started_at || job.created_at}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyStatus,
                        job.status === 'failed' && styles.historyStatusFailed,
                      ]}
                    >
                      {scanJobBadge(job) ?? job.status}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setHistoryVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  libCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  libIdentity: {
    flex: 1,
    marginRight: 8,
  },
  libName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  libMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  scanBadge: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '600',
  },
  currentPath: {
    color: '#888',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  errorPath: {
    color: '#dc3545',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  },
  actionTextDanger: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#0066cc',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    color: '#fff',
    fontSize: 16,
  },
  pathsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    color: '#888',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
  // Scan-history sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sheetEmpty: {
    color: '#666',
    fontSize: 14,
    paddingVertical: 16,
  },
  sheetScroll: {
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  historyMain: {
    flex: 1,
    marginRight: 8,
  },
  historyType: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  historyDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  historyStatus: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '600',
  },
  historyStatusFailed: {
    color: '#dc3545',
  },
});

export default AdminLibrariesScreen;
