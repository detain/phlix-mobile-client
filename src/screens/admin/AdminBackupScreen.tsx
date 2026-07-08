/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/admin/AdminBackupScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import type { Backup } from '../../types/admin';
import { formatBackupSize, validateScheduleInput } from './adminScreenHelpers';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const AdminBackupScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const backups = useAdminStore((state) => state.backups);
  const backupsLoading = useAdminStore((state) => state.backupsLoading);
  const backupsError = useAdminStore((state) => state.backupsError);
  const loadBackups = useAdminStore((state) => state.loadBackups);
  const createBackup = useAdminStore((state) => state.createBackup);
  const deleteBackup = useAdminStore((state) => state.deleteBackup);
  const restoreBackup = useAdminStore((state) => state.restoreBackup);
  const uploadBackupS3 = useAdminStore((state) => state.uploadBackupS3);

  const schedule = useAdminStore((state) => state.backupSchedule);
  const scheduleLoading = useAdminStore((state) => state.backupScheduleLoading);
  const loadBackupSchedule = useAdminStore((state) => state.loadBackupSchedule);
  const updateBackupSchedule = useAdminStore(
    (state) => state.updateBackupSchedule
  );

  // Create-backup modal (optional label).
  const [createVisible, setCreateVisible] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [creating, setCreating] = useState(false);

  // Schedule edit fields.
  const [draftDays, setDraftDays] = useState('');
  const [draftRetention, setDraftRetention] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadBackups();
      loadBackupSchedule();
    }
  }, [isAdmin, loadBackups, loadBackupSchedule]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Seed the schedule inputs whenever the loaded schedule changes.
  useEffect(() => {
    if (schedule) {
      setDraftDays(String(schedule.auto_backup_interval_days));
      setDraftRetention(String(schedule.retention_count));
    }
  }, [schedule]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const label = draftLabel.trim();
      await createBackup(label.length > 0 ? label : undefined);
      setCreateVisible(false);
      setDraftLabel('');
    } catch (err) {
      Alert.alert('Backup failed', errText(err, 'Could not create the backup.'));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = (backup: Backup) => {
    Alert.alert(
      'Restore backup',
      `Restore "${backup.label || backup.id}"? This OVERWRITES the current database and configuration. The server may restart.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreBackup(backup.id);
              Alert.alert('Restore started', 'The backup was restored.');
            } catch (err) {
              Alert.alert(
                'Restore failed',
                errText(err, 'Could not restore the backup.')
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = (backup: Backup) => {
    Alert.alert(
      'Delete backup',
      `Delete "${backup.label || backup.id}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBackup(backup.id);
            } catch (err) {
              Alert.alert(
                'Delete failed',
                errText(err, 'Could not delete the backup.')
              );
            }
          },
        },
      ]
    );
  };

  const handleUploadS3 = async (backup: Backup) => {
    try {
      await uploadBackupS3(backup.id);
      Alert.alert('Uploaded', 'Backup uploaded to S3.');
    } catch (err) {
      Alert.alert('Upload failed', errText(err, 'Could not upload to S3.'));
    }
  };

  const handleSaveSchedule = async () => {
    const validation = validateScheduleInput(draftDays, draftRetention);
    if (validation) {
      Alert.alert('Invalid schedule', validation);
      return;
    }
    const input: {
      auto_backup_interval_days?: number;
      retention_count?: number;
    } = {};
    if (draftDays.trim() !== '') {
      input.auto_backup_interval_days = Number(draftDays.trim());
    }
    if (draftRetention.trim() !== '') {
      input.retention_count = Number(draftRetention.trim());
    }
    setSavingSchedule(true);
    try {
      await updateBackupSchedule(input);
      Alert.alert('Saved', 'Backup schedule updated.');
    } catch (err) {
      Alert.alert('Save failed', errText(err, 'Could not save the schedule.'));
    } finally {
      setSavingSchedule(false);
    }
  };

  const renderBackup = ({ item }: { item: Backup }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIdentity}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.label || item.id}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatBackupSize(item.size)} · {item.created_at}
          </Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleRestore(item)}
        >
          <Text style={styles.actionText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUploadS3(item)}
        >
          <Text style={styles.actionText}>Upload to S3</Text>
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

  if (backupsLoading && backups.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (backupsError && backups.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={backupsError} onRetry={refresh} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={backups}
        keyExtractor={(item) => item.id}
        renderItem={renderBackup}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={backupsLoading || scheduleLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Backups</Text>
              <Text style={styles.headerSubtitle}>
                {backups.length} backup{backups.length === 1 ? '' : 's'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                setDraftLabel('');
                setCreateVisible(true);
              }}
            >
              <Text style={styles.createButtonText}>+ Create backup</Text>
            </TouchableOpacity>

            {/* Schedule section */}
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Schedule</Text>
              {schedule?.next_scheduled_backup ? (
                <Text style={styles.scheduleMeta}>
                  Next: {schedule.next_scheduled_backup}
                </Text>
              ) : null}
              <Text style={styles.fieldLabel}>
                Auto-backup interval (days, 0 = off)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#666"
                value={draftDays}
                onChangeText={setDraftDays}
                keyboardType="numeric"
              />
              <Text style={styles.fieldLabel}>Retention count</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor="#666"
                value={draftRetention}
                onChangeText={setDraftRetention}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.saveScheduleButton}
                onPress={handleSaveSchedule}
                disabled={savingSchedule}
              >
                <Text style={styles.saveScheduleText}>
                  {savingSchedule ? 'Saving…' : 'Save schedule'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.listSectionTitle}>Existing backups</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="💾"
            title="No backups yet"
            message="Create a backup to capture the current database and configuration."
          />
        }
      />

      {/* Create-backup label modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCreateVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Create backup</Text>
            <Text style={styles.fieldLabel}>Label (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. before-upgrade"
              placeholderTextColor="#666"
              value={draftLabel}
              onChangeText={setDraftLabel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreate}
              disabled={creating}
            >
              <Text style={styles.submitButtonText}>
                {creating ? 'Creating…' : 'Create'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCreateVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
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
    paddingBottom: 24,
    flexGrow: 1,
  },
  createButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  scheduleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  scheduleMeta: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
  },
  listSectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
  },
  cardIdentity: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
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
  fieldLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    color: '#fff',
    fontSize: 16,
  },
  saveScheduleButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveScheduleText: {
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
});

export default AdminBackupScreen;
