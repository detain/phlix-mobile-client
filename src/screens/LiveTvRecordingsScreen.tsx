/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/LiveTvRecordingsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useLiveTvStore } from '../stores/useLiveTvStore';
import {
  formatProgramTime,
  programIsLive,
  type Program,
  type Recording,
  type RecordingStatus,
} from '../types/livetv';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const statusLabel = (status: RecordingStatus): string => {
  switch (status) {
    case 'pending':
      return 'Scheduled';
    case 'recording':
      return 'Recording';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

const LiveTvRecordingsScreen: React.FC = () => {
  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);

  const recordings = useLiveTvStore((s) => s.recordings);
  const upcoming = useLiveTvStore((s) => s.upcoming);
  const seriesRules = useLiveTvStore((s) => s.seriesRules);
  const recordingsLoading = useLiveTvStore((s) => s.recordingsLoading);
  const recordingsError = useLiveTvStore((s) => s.recordingsError);
  const notConfigured = useLiveTvStore((s) => s.notConfigured);
  const guide = useLiveTvStore((s) => s.guide);

  const loadRecordings = useLiveTvStore((s) => s.loadRecordings);
  const loadUpcoming = useLiveTvStore((s) => s.loadUpcoming);
  const loadSeriesRules = useLiveTvStore((s) => s.loadSeriesRules);
  const loadGuide = useLiveTvStore((s) => s.loadGuide);
  const createRecording = useLiveTvStore((s) => s.createRecording);
  const deleteRecording = useLiveTvStore((s) => s.deleteRecording);

  const [showCreate, setShowCreate] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const refreshAll = useCallback(() => {
    // eslint-disable-next-line no-void -- loaders own their errors
    void loadRecordings();
    // eslint-disable-next-line no-void
    void loadUpcoming();
    // eslint-disable-next-line no-void
    void loadSeriesRules();
  }, [loadRecordings, loadUpcoming, loadSeriesRules]);

  useEffect(() => {
    if (isAdmin) {
      refreshAll();
    }
  }, [isAdmin, refreshAll]);

  const openCreate = useCallback(() => {
    // Pull the upcoming-week guide so the picker has programs to choose from.
    // eslint-disable-next-line no-void -- loader owns its errors
    void loadGuide();
    setShowCreate(true);
  }, [loadGuide]);

  const handleCreateFromProgram = useCallback(
    async (program: Program) => {
      setCreatingId(program.id);
      try {
        await createRecording({
          channel_id: program.channel_id,
          title: program.title,
          start_time: program.start_time,
          end_time: program.end_time,
          program_id: program.id,
        });
        setShowCreate(false);
        Alert.alert('Scheduled', `“${program.title}” will be recorded.`);
      } catch (err) {
        Alert.alert('Create failed', errText(err, 'Could not schedule the recording.'));
      } finally {
        setCreatingId(null);
      }
    },
    [createRecording]
  );

  const handleDelete = useCallback(
    (recording: Recording) => {
      Alert.alert(
        'Delete recording',
        `Delete “${recording.title}”? This also removes the recorded file.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteRecording(recording.id).catch((err) => {
                Alert.alert('Delete failed', errText(err, 'Could not delete the recording.'));
              });
            },
          },
        ]
      );
    },
    [deleteRecording]
  );

  // ── Gating + states ──
  if (!isAdmin) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="🔒"
          title="Admin access required"
          message="DVR recordings are managed by server administrators."
        />
      </SafeContainer>
    );
  }

  if (notConfigured) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="📺"
          title="Live TV is not set up"
          message="This server has no tuner or DVR configuration."
        />
      </SafeContainer>
    );
  }

  if (recordingsLoading && recordings.length === 0 && upcoming.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (recordingsError && recordings.length === 0 && upcoming.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={recordingsError} onRetry={refreshAll} />
      </SafeContainer>
    );
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const guidePrograms = guide.filter((p) => p.end_time > nowSecs);

  const renderRecording = (recording: Recording) => (
    <View key={recording.id} style={styles.recordingCard}>
      <View style={styles.recordingBody}>
        <Text style={styles.recordingTitle} numberOfLines={1}>
          {recording.title}
        </Text>
        <Text style={styles.recordingMeta}>
          {statusLabel(recording.status)} ·{' '}
          {formatProgramTime({
            id: recording.id,
            channel_id: recording.channel_id,
            title: recording.title,
            start_time: recording.start_time,
            end_time: recording.end_time,
          })}
        </Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(recording)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeContainer edges={['top']}>
      <FlatList<never>
        data={[]}
        renderItem={() => null}
        keyExtractor={(_item, index) => String(index)}
        refreshControl={
          <RefreshControl
            refreshing={recordingsLoading}
            onRefresh={refreshAll}
            tintColor="#0066cc"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Recordings</Text>
              <TouchableOpacity style={styles.createButton} onPress={openCreate}>
                <Text style={styles.createButtonText}>+ Schedule</Text>
              </TouchableOpacity>
            </View>

            {/* Upcoming */}
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcoming.length === 0 ? (
              <Text style={styles.emptyHint}>No upcoming recordings.</Text>
            ) : (
              upcoming.map(renderRecording)
            )}

            {/* All recordings */}
            <Text style={styles.sectionTitle}>All recordings</Text>
            {recordings.length === 0 ? (
              <Text style={styles.emptyHint}>No recordings yet.</Text>
            ) : (
              recordings.map(renderRecording)
            )}

            {/* Series rules (list-only) */}
            <Text style={styles.sectionTitle}>Series rules</Text>
            {seriesRules.length === 0 ? (
              <Text style={styles.emptyHint}>No series rules.</Text>
            ) : (
              seriesRules.map((rule) => (
                <View key={rule.id} style={styles.ruleRow}>
                  <Text style={styles.ruleTitle} numberOfLines={1}>
                    {rule.title}
                  </Text>
                  <Text style={styles.ruleMeta}>
                    {rule.enabled === false ? 'Disabled' : 'Active'}
                  </Text>
                </View>
              ))
            )}
          </View>
        }
      />

      {/* Create-from-program modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule a recording</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Pick an upcoming program to record.
            </Text>
            <ScrollView style={styles.programScroll}>
              {guidePrograms.length === 0 ? (
                <Text style={styles.emptyHint}>
                  No upcoming programs in the guide. Refresh the guide on the Live
                  TV screen first.
                </Text>
              ) : (
                guidePrograms.map((program) => {
                  const live = programIsLive(program, nowSecs);
                  return (
                    <TouchableOpacity
                      key={program.id}
                      style={styles.programPick}
                      onPress={() => handleCreateFromProgram(program)}
                      disabled={creatingId === program.id}
                    >
                      <Text style={styles.programPickTitle} numberOfLines={1}>
                        {program.title}
                        {live ? ' · LIVE' : ''}
                      </Text>
                      <Text style={styles.programPickTime}>
                        {creatingId === program.id
                          ? 'Scheduling…'
                          : formatProgramTime(program)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyHint: {
    color: '#888',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  recordingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingBody: {
    flex: 1,
    marginRight: 8,
  },
  recordingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#5a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
  },
  ruleTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  ruleMeta: {
    color: '#888',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    color: '#fff',
    fontSize: 20,
  },
  modalHint: {
    color: '#888',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  programScroll: {
    maxHeight: 380,
  },
  programPick: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  programPickTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  programPickTime: {
    color: '#0066cc',
    fontSize: 13,
    marginTop: 4,
  },
});

export default LiveTvRecordingsScreen;
