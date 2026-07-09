/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/ParentalControlsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { parentalControlsManager } from '../api';
import { SafeContainer } from '../components/layout';
import type { AccessSchedule, DayOfWeek, ProfileTag, ProfileStreamLimit } from '../types/parental';

// ── Constants ────────────────────────────────────────────────────────────────

type ActiveTab = 'schedules' | 'tags' | 'limits';

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
  { label: 'Sun', value: 'sun' },
];

// ── Pure helper functions ────────────────────────────────────────────────────

const formatTimeDisplay = (time: string): string => {
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const hour = parseInt(parts[0], 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${parts[1]} ${ampm}`;
};

const formatDaysDisplay = (days: DayOfWeek[]): string => {
  if (days.length === 0) return 'No days set';
  if (days.length === 7) return 'Every day';
  const labels: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  return days.map((d) => labels[d]).join(', ');
};

// ── Component ───────────────────────────────────────────────────────────────

interface ScheduleFormState {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: DayOfWeek[];
  isActive: boolean;
}

const ParentalControlsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const profileId = (user as any)?.profileId as number | undefined;

  // ── All hooks MUST be called before any early returns (Rules of Hooks) ───
  // ── Tab State ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('schedules');

  // ── Schedules State ────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<AccessSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [errorSchedules, setErrorSchedules] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<AccessSchedule | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    name: '',
    startTime: '08:00:00',
    endTime: '22:00:00',
    daysOfWeek: [],
    isActive: true,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ── Tags State ─────────────────────────────────────────────────────────
  const [tags, setTags] = useState<ProfileTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [errorTags, setErrorTags] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  // ── Stream Limits State ────────────────────────────────────────────────
  const [streamLimit, setStreamLimit] = useState<ProfileStreamLimit | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [errorLimits, setErrorLimits] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitForm, setLimitForm] = useState({
    maxConcurrentStreams: 1,
    maxTotalBandwidthKbps: null as number | null,
  });
  const [savingLimit, setSavingLimit] = useState(false);

  // ── Data Loading ───────────────────────────────────────────────────────
  const loadSchedules = useCallback(async () => {
    if (!profileId) return;
    setLoadingSchedules(true);
    setErrorSchedules(null);
    try {
      const data = await parentalControlsManager.getSchedules(profileId);
      setSchedules(data);
    } catch (e) {
      setErrorSchedules(e instanceof Error ? e.message : 'Failed to load schedules');
    } finally {
      setLoadingSchedules(false);
    }
  }, [profileId]);

  const loadTags = useCallback(async () => {
    if (!profileId) return;
    setLoadingTags(true);
    setErrorTags(null);
    try {
      const data = await parentalControlsManager.getTags(profileId);
      setTags(data.filter((t) => t.tagType === 'blocked'));
    } catch (e) {
      setErrorTags(e instanceof Error ? e.message : 'Failed to load tags');
    } finally {
      setLoadingTags(false);
    }
  }, [profileId]);

  const loadStreamLimit = useCallback(async () => {
    if (!profileId) return;
    setLoadingLimits(true);
    setErrorLimits(null);
    try {
      const data = await parentalControlsManager.getStreamLimit(profileId);
      setStreamLimit(data);
    } catch (e) {
      setErrorLimits(e instanceof Error ? e.message : 'Failed to load stream limit');
    } finally {
      setLoadingLimits(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadSchedules();
    loadTags();
    loadStreamLimit();
  }, [loadSchedules, loadTags, loadStreamLimit]);

  // ── Guard: must have a profile (after all hooks) ───────────────────────
  if (!profileId) {
    return (
      <SafeContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No profile selected</Text>
        </View>
      </SafeContainer>
    );
  }

  // ── Schedule Actions ───────────────────────────────────────────────────
  const openCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleForm({
      name: '',
      startTime: '08:00:00',
      endTime: '22:00:00',
      daysOfWeek: [],
      isActive: true,
    });
    setShowScheduleForm(true);
  };

  const openEditSchedule = (schedule: AccessSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      daysOfWeek: [...schedule.daysOfWeek],
      isActive: schedule.isActive,
    });
    setShowScheduleForm(true);
  };

  const closeScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
  };

  const toggleScheduleDay = (day: DayOfWeek) => {
    setScheduleForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists
          ? prev.daysOfWeek.filter((d) => d !== day)
          : [...prev.daysOfWeek, day],
      };
    });
  };

  const saveSchedule = async () => {
    if (!profileId || !scheduleForm.name.trim()) return;
    setSavingSchedule(true);
    try {
      if (editingSchedule) {
        await parentalControlsManager.updateSchedule(profileId, {
          id: editingSchedule.id,
          name: scheduleForm.name,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          daysOfWeek: scheduleForm.daysOfWeek,
          isActive: scheduleForm.isActive,
        });
      } else {
        await parentalControlsManager.createSchedule(profileId, {
          name: scheduleForm.name,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
          daysOfWeek: scheduleForm.daysOfWeek,
          isActive: scheduleForm.isActive,
        });
      }
      closeScheduleForm();
      await loadSchedules();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!profileId) return;
    Alert.alert('Delete Schedule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await parentalControlsManager.deleteSchedule(profileId, scheduleId);
            await loadSchedules();
          } catch {
            // Silently fail
          }
        },
      },
    ]);
  };

  // ── Tag Actions ─────────────────────────────────────────────────────────
  const addTag = async () => {
    const tag = newTagInput.trim();
    if (!tag || !profileId) return;
    setAddingTag(true);
    try {
      await parentalControlsManager.addTag(profileId, { tag, tagType: 'blocked' });
      setNewTagInput('');
      await loadTags();
    } catch {
      // Silently fail
    } finally {
      setAddingTag(false);
    }
  };

  const removeTag = async (tagId: number) => {
    if (!profileId) return;
    try {
      await parentalControlsManager.removeTag(profileId, tagId);
      await loadTags();
    } catch {
      // Silently fail
    }
  };

  // ── Stream Limit Actions ───────────────────────────────────────────────
  const openEditLimit = () => {
    setEditingLimit(true);
    setLimitForm({
      maxConcurrentStreams: streamLimit?.maxConcurrentStreams ?? 1,
      maxTotalBandwidthKbps: streamLimit?.maxTotalBandwidthKbps ?? null,
    });
  };

  const cancelEditLimit = () => {
    setEditingLimit(false);
  };

  const saveLimit = async () => {
    if (!profileId) return;
    setSavingLimit(true);
    try {
      await parentalControlsManager.updateStreamLimit(profileId, {
        maxConcurrentStreams: limitForm.maxConcurrentStreams,
        maxTotalBandwidthKbps: limitForm.maxTotalBandwidthKbps,
      });
      setEditingLimit(false);
      await loadStreamLimit();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save limits');
    } finally {
      setSavingLimit(false);
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────────
  const renderTab = (tab: ActiveTab, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#0066cc" />
    </View>
  );

  const renderError = (message: string, onRetry: () => void) => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = (message: string) => (
    <View style={styles.centerContainer}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  // ── Render Schedules Tab ───────────────────────────────────────────────
  const renderSchedulesTab = () => {
    if (loadingSchedules) return renderLoading();
    if (errorSchedules) return renderError(errorSchedules, loadSchedules);

    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Access Schedules</Text>
          <TouchableOpacity style={styles.addButton} onPress={openCreateSchedule}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {schedules.length === 0 ? (
          renderEmpty('No access schedules configured.')
        ) : (
          <View style={styles.list}>
            {schedules.map((schedule) => (
              <View
                key={schedule.id}
                style={[
                  styles.listItem,
                  !schedule.isActive && styles.listItemInactive,
                ]}
              >
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{schedule.name}</Text>
                  <Text style={styles.listItemDetail}>
                    {formatTimeDisplay(schedule.startTime)} –{' '}
                    {formatTimeDisplay(schedule.endTime)}
                  </Text>
                  <Text style={styles.listItemDetail}>
                    {formatDaysDisplay(schedule.daysOfWeek)}
                  </Text>
                  {!schedule.isActive && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Inactive</Text>
                    </View>
                  )}
                </View>
                <View style={styles.listItemActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditSchedule(schedule)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteSchedule(schedule.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Schedule Form Modal */}
        <Modal
          visible={showScheduleForm}
          transparent
          animationType="fade"
          onRequestClose={closeScheduleForm}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeScheduleForm}
          >
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>
                {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Schedule name"
                placeholderTextColor="#666"
                value={scheduleForm.name}
                onChangeText={(text) =>
                  setScheduleForm((prev) => ({ ...prev, name: text }))
                }
              />

              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:MM:SS"
                    placeholderTextColor="#666"
                    value={scheduleForm.startTime}
                    onChangeText={(text) =>
                      setScheduleForm((prev) => ({ ...prev, startTime: text }))
                    }
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:MM:SS"
                    placeholderTextColor="#666"
                    value={scheduleForm.endTime}
                    onChangeText={(text) =>
                      setScheduleForm((prev) => ({ ...prev, endTime: text }))
                    }
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Days of Week</Text>
              <View style={styles.dayPicker}>
                {DAYS.map((day) => (
                  <TouchableOpacity
                    key={day.value}
                    style={[
                      styles.dayButton,
                      scheduleForm.daysOfWeek.includes(day.value) &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleScheduleDay(day.value)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        scheduleForm.daysOfWeek.includes(day.value) &&
                          styles.dayButtonTextSelected,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Active</Text>
                <Switch
                  value={scheduleForm.isActive}
                  onValueChange={(value) =>
                    setScheduleForm((prev) => ({ ...prev, isActive: value }))
                  }
                  trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeScheduleForm}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    !scheduleForm.name.trim() && styles.saveButtonDisabled,
                  ]}
                  onPress={saveSchedule}
                  disabled={savingSchedule || !scheduleForm.name.trim()}
                >
                  <Text style={styles.saveButtonText}>
                    {savingSchedule ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  // ── Render Tags Tab ─────────────────────────────────────────────────────
  const renderTagsTab = () => {
    if (loadingTags) return renderLoading();
    if (errorTags) return renderError(errorTags, loadTags);

    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Blocked Tags</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Tags block content from appearing in search or recommendations.
        </Text>

        <View style={styles.tagAddRow}>
          <TextInput
            style={styles.tagInput}
            placeholder="Enter tag to block..."
            placeholderTextColor="#666"
            value={newTagInput}
            onChangeText={setNewTagInput}
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[
              styles.addTagButton,
              (!newTagInput.trim() || addingTag) && styles.addTagButtonDisabled,
            ]}
            onPress={addTag}
            disabled={!newTagInput.trim() || addingTag}
          >
            <Text style={styles.addTagButtonText}>
              {addingTag ? 'Adding...' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        {tags.length === 0 ? (
          renderEmpty('No blocked tags configured.')
        ) : (
          <View style={styles.tagList}>
            {tags.map((tag) => (
              <View key={tag.id} style={styles.tagItem}>
                <Text style={styles.tagLabel}>{tag.tag}</Text>
                <TouchableOpacity
                  style={styles.tagRemove}
                  onPress={() => removeTag(tag.id)}
                >
                  <Text style={styles.tagRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── Render Stream Limits Tab ────────────────────────────────────────────
  const renderLimitsTab = () => {
    if (loadingLimits) return renderLoading();
    if (errorLimits) return renderError(errorLimits, loadStreamLimit);

    if (editingLimit) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Edit Stream Limits</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Max Concurrent Streams</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={String(limitForm.maxConcurrentStreams)}
              onChangeText={(text) =>
                setLimitForm((prev) => ({
                  ...prev,
                  maxConcurrentStreams: parseInt(text, 10) || 1,
                }))
              }
            />

            <Text style={styles.inputLabel}>Max Bandwidth (kbps, 0 = unlimited)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={
                limitForm.maxTotalBandwidthKbps === null
                  ? ''
                  : String(limitForm.maxTotalBandwidthKbps)
              }
              onChangeText={(text) =>
                setLimitForm((prev) => ({
                  ...prev,
                  maxTotalBandwidthKbps: text ? parseInt(text, 10) : null,
                }))
              }
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelEditLimit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveLimit}
                disabled={savingLimit}
              >
                <Text style={styles.saveButtonText}>
                  {savingLimit ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stream Limits</Text>
          <TouchableOpacity style={styles.addButton} onPress={openEditLimit}>
            <Text style={styles.addButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.limitDisplay}>
          <View style={styles.limitItem}>
            <Text style={styles.limitLabel}>Max Concurrent Streams</Text>
            <Text style={styles.limitValue}>
              {streamLimit?.maxConcurrentStreams ?? '—'}
            </Text>
          </View>
          <View style={styles.limitItem}>
            <Text style={styles.limitLabel}>Max Total Bandwidth</Text>
            <Text style={styles.limitValue}>
              {streamLimit?.maxTotalBandwidthKbps
                ? `${streamLimit.maxTotalBandwidthKbps} kbps`
                : 'Unlimited'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────
  return (
    <SafeContainer>
      <ScrollView style={styles.scrollView}>
        <View style={styles.tabBar}>
          {renderTab('schedules', 'Schedules')}
          {renderTab('tags', 'Blocked Tags')}
          {renderTab('limits', 'Stream Limits')}
        </View>

        {activeTab === 'schedules' && renderSchedulesTab()}
        {activeTab === 'tags' && renderTagsTab()}
        {activeTab === 'limits' && renderLimitsTab()}
      </ScrollView>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0066cc',
  },
  tabText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionDesc: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#0066cc',
    borderRadius: 6,
  },
  addButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    marginBottom: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
  listItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemInactive: {
    opacity: 0.6,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listItemDetail: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#2d2d44',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#888',
    fontSize: 11,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
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
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  dayButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  dayButtonText: {
    color: '#888',
    fontSize: 13,
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#52525b',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 15,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Tags styles
  tagAddRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  addTagButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    justifyContent: 'center',
  },
  addTagButtonDisabled: {
    opacity: 0.5,
  },
  addTagButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  tagLabel: {
    color: '#fff',
    fontSize: 14,
  },
  tagRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagRemoveText: {
    color: '#ef4444',
    fontSize: 14,
    lineHeight: 16,
  },
  // Limits styles
  limitDisplay: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
  },
  limitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  limitLabel: {
    color: '#888',
    fontSize: 14,
  },
  limitValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
  },
});

export default ParentalControlsScreen;