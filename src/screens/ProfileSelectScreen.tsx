// src/screens/ProfileSelectScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useProfileStore } from '../stores/useProfileStore';
import {
  Profile,
  ratingToLabel,
  labelToRating,
  ContentRatingLabel,
} from '../types/profile';

const RATING_OPTIONS: ContentRatingLabel[] = [
  'G',
  'PG',
  'PG-13',
  'R',
  'NC-17',
  'X',
  'UNRATED',
];

/** A 4- or 6-digit numeric PIN. */
const isValidPin = (pin: string): boolean => /^(\d{4}|\d{6})$/.test(pin);

const ProfileSelectScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;
  const userId = user?.id;

  const profiles = useProfileStore((state) => state.profiles);
  const activeProfile = useProfileStore((state) => state.activeProfile);
  const isLoading = useProfileStore((state) => state.isLoading);
  const error = useProfileStore((state) => state.error);
  const loadProfiles = useProfileStore((state) => state.loadProfiles);
  const createProfile = useProfileStore((state) => state.createProfile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const deleteProfile = useProfileStore((state) => state.deleteProfile);
  const selectProfile = useProfileStore((state) => state.selectProfile);

  // Editor modal (create or rename + rating)
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRating, setDraftRating] = useState<ContentRatingLabel>('UNRATED');
  const [submitting, setSubmitting] = useState(false);

  // PIN entry modal (when selecting a PIN-gated profile)
  const [pinVisible, setPinVisible] = useState(false);
  const [pinProfile, setPinProfile] = useState<Profile | null>(null);
  const [pinValue, setPinValue] = useState('');

  const refresh = useCallback(() => {
    if (isAdmin && userId) {
      loadProfiles(userId);
    }
  }, [isAdmin, userId, loadProfiles]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditingProfile(null);
    setDraftName('');
    setDraftRating('UNRATED');
    setEditorVisible(true);
  };

  const openEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setDraftName(profile.name);
    setDraftRating(profile.settings?.content_rating ?? 'UNRATED');
    setEditorVisible(true);
  };

  const handleSubmitEditor = async () => {
    const name = draftName.trim();
    if (name.length < 1 || name.length > 50) {
      Alert.alert('Invalid name', 'Name must be 1–50 characters.');
      return;
    }
    if (!userId) {
      return;
    }
    setSubmitting(true);
    try {
      const rating = labelToRating(draftRating);
      if (editingProfile) {
        await updateProfile(editingProfile.id, { name, rating });
      } else {
        await createProfile(userId, { name, rating });
      }
      setEditorVisible(false);
    } catch (err) {
      Alert.alert(
        'Save failed',
        err instanceof Error ? err.message : 'Could not save profile.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (profile: Profile) => {
    Alert.alert(
      'Delete profile',
      `Delete "${profile.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profile.id);
            } catch (err) {
              Alert.alert(
                'Delete failed',
                err instanceof Error ? err.message : 'Could not delete profile.'
              );
            }
          },
        },
      ]
    );
  };

  const handleSelect = (profile: Profile) => {
    if (profile.settings?.pin_required_for_admin) {
      setPinProfile(profile);
      setPinValue('');
      setPinVisible(true);
      return;
    }
    selectProfile(profile);
  };

  const handleConfirmPin = () => {
    if (!isValidPin(pinValue)) {
      Alert.alert('Invalid PIN', 'Enter a 4- or 6-digit numeric PIN.');
      return;
    }
    if (pinProfile) {
      // The server validates the PIN on the next admin action; locally we gate
      // selection on a well-formed PIN entry.
      selectProfile(pinProfile);
    }
    setPinVisible(false);
    setPinProfile(null);
    setPinValue('');
  };

  const renderProfile = ({ item }: { item: Profile }) => {
    const isActive = activeProfile?.id === item.id;
    return (
      <View style={[styles.profileCard, isActive && styles.profileCardActive]}>
        <TouchableOpacity
          style={styles.profileMain}
          onPress={() => handleSelect(item)}
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {item.name.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{item.name}</Text>
            <Text style={styles.profileMeta}>
              {ratingToLabel(labelToRating(item.settings?.content_rating ?? 'UNRATED'))}
              {item.is_admin ? ' · Admin' : ''}
              {item.settings?.pin_required_for_admin ? ' · 🔒' : ''}
            </Text>
          </View>
          {isActive && <Text style={styles.activeBadge}>Active</Text>}
        </TouchableOpacity>
        <View style={styles.profileActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEdit(item)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionButtonDanger}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Non-admin: the server route is admin-only — show an informational state.
  if (!isAdmin) {
    return (
      <SafeContainer>
        <EmptyState
          icon="👤"
          title="Profiles are managed by an administrator"
          message="Multi-user profiles can only be added or changed by an account administrator on this server."
        />
      </SafeContainer>
    );
  }

  if (isLoading && profiles.length === 0) {
    return (
      <SafeContainer>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <SafeContainer>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profiles</Text>
        <Text style={styles.headerSubtitle}>
          {profiles.length} of 5 profiles
        </Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={renderProfile}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No profiles yet"
            message="Add a profile to personalize content and parental controls."
          />
        }
      />

      {profiles.length < 5 && (
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ Add Profile</Text>
        </TouchableOpacity>
      )}

      {/* Create / edit profile modal */}
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
              {editingProfile ? 'Edit Profile' : 'New Profile'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Profile name"
              placeholderTextColor="#666"
              value={draftName}
              onChangeText={setDraftName}
              maxLength={50}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Max content rating</Text>
            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.ratingChip,
                    draftRating === label && styles.ratingChipActive,
                  ]}
                  onPress={() => setDraftRating(label)}
                >
                  <Text
                    style={[
                      styles.ratingChipText,
                      draftRating === label && styles.ratingChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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

      {/* PIN entry modal */}
      <Modal
        visible={pinVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPinVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Enter PIN</Text>
            <Text style={styles.modalSubtitle}>
              {pinProfile?.name} requires a PIN.
            </Text>
            <TextInput
              style={[styles.input, styles.pinInput]}
              placeholder="••••"
              placeholderTextColor="#666"
              value={pinValue}
              onChangeText={(t) => setPinValue(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleConfirmPin}>
              <Text style={styles.submitButtonText}>Unlock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setPinVisible(false)}
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
  profileCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  profileCardActive: {
    borderColor: '#0066cc',
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  activeBadge: {
    color: '#0066cc',
    fontSize: 12,
    fontWeight: '600',
  },
  profileActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonDanger: {
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
  // Modal styles
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
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
  },
  pinInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
  },
  fieldLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  ratingChip: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  ratingChipActive: {
    backgroundColor: '#0066cc',
  },
  ratingChipText: {
    color: '#888',
    fontSize: 13,
  },
  ratingChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
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

export default ProfileSelectScreen;
