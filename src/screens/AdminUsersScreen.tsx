/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/AdminUsersScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useAdminStore } from '../stores/useAdminStore';
import type { AdminUser } from '../types/admin';
import {
  USER_STATUS_FILTERS,
  filterUsersByStatus,
  type UserStatusFilter,
} from './admin/adminScreenHelpers';

/** Title-cased label for a status filter chip. */
const filterLabel = (f: UserStatusFilter): string =>
  f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const AdminUsersScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const users = useAdminStore((state) => state.users);
  const isLoading = useAdminStore((state) => state.usersLoading);
  const error = useAdminStore((state) => state.usersError);
  const loadUsers = useAdminStore((state) => state.loadUsers);
  const createUser = useAdminStore((state) => state.createUser);
  const updateUser = useAdminStore((state) => state.updateUser);
  const deleteUser = useAdminStore((state) => state.deleteUser);
  const setUserAdmin = useAdminStore((state) => state.setUserAdmin);
  const resetPassword = useAdminStore((state) => state.resetPassword);
  const approveUser = useAdminStore((state) => state.approveUser);
  const disableUser = useAdminStore((state) => state.disableUser);
  const rejectUser = useAdminStore((state) => state.rejectUser);

  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');

  // Create / edit modal
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [draftIsAdmin, setDraftIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditingUser(null);
    setDraftUsername('');
    setDraftEmail('');
    setDraftPassword('');
    setDraftIsAdmin(false);
    setEditorVisible(true);
  };

  const openEdit = (target: AdminUser) => {
    setEditingUser(target);
    setDraftUsername(target.username);
    setDraftEmail(target.email);
    setDraftPassword('');
    setDraftIsAdmin(!!target.is_admin);
    setEditorVisible(true);
  };

  const handleSubmitEditor = async () => {
    const username = draftUsername.trim();
    const email = draftEmail.trim();
    if (username.length < 1) {
      Alert.alert('Invalid username', 'Username is required.');
      return;
    }
    if (email.length < 1) {
      Alert.alert('Invalid email', 'Email is required.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingUser) {
        // Edit: username/email + optional password (omit when left blank).
        await updateUser(editingUser.id, {
          username,
          email,
          ...(draftPassword.length > 0 ? { password: draftPassword } : {}),
        });
      } else {
        if (draftPassword.length < 1) {
          Alert.alert('Invalid password', 'Password is required for a new user.');
          setSubmitting(false);
          return;
        }
        await createUser({
          username,
          email,
          password: draftPassword,
          is_admin: draftIsAdmin,
        });
      }
      setEditorVisible(false);
    } catch (err) {
      Alert.alert('Save failed', errText(err, 'Could not save user.'));
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      Alert.alert(`${label} failed`, errText(err, `Could not ${label.toLowerCase()}.`));
    }
  };

  const handleApprove = (target: AdminUser) =>
    runAction('Approve', () => approveUser(target.id));

  const handleDisable = (target: AdminUser) =>
    runAction('Disable', () => disableUser(target.id));

  const handleReject = (target: AdminUser) => {
    Alert.alert(
      'Reject user',
      `Reject and remove the pending account "${target.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => runAction('Reject', () => rejectUser(target.id)),
        },
      ]
    );
  };

  const handleToggleAdmin = (target: AdminUser) =>
    runAction('Change admin status', () =>
      setUserAdmin(target.id, !target.is_admin)
    );

  const handleResetPassword = (target: AdminUser) => {
    Alert.alert(
      'Reset password',
      `Generate a new password for "${target.username}"? The old password stops working immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await resetPassword(target.id);
              // The new password is returned ONCE — surface it now so the admin
              // can hand it off; it cannot be retrieved again.
              Alert.alert(
                'New password',
                `${result.new_password}\n\nCopy this now — it will not be shown again.`
              );
            } catch (err) {
              Alert.alert(
                'Reset failed',
                errText(err, 'Could not reset password.')
              );
            }
          },
        },
      ]
    );
  };

  const handleDelete = (target: AdminUser) => {
    Alert.alert(
      'Delete user',
      `Permanently delete "${target.username}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(target.id);
            } catch (err) {
              // Surfaces the server's 400 message (self / last-admin guard).
              Alert.alert('Delete failed', errText(err, 'Could not delete user.'));
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: AdminUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userIdentity}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            @{item.username} · {item.email}
          </Text>
        </View>
        <View style={styles.badges}>
          {item.is_admin ? (
            <Text style={[styles.badge, styles.badgeAdmin]}>Admin</Text>
          ) : null}
          <Text style={[styles.badge, statusBadgeStyle(item.status)]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {item.status === 'pending' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleApprove(item)}
          >
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>
        ) : null}
        {item.status === 'pending' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleReject(item)}
          >
            <Text style={styles.actionTextDanger}>Reject</Text>
          </TouchableOpacity>
        ) : null}
        {item.status !== 'disabled' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDisable(item)}
          >
            <Text style={styles.actionText}>Disable</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleAdmin(item)}
        >
          <Text style={styles.actionText}>
            {item.is_admin ? 'Unset admin' : 'Set admin'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEdit(item)}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleResetPassword(item)}
        >
          <Text style={styles.actionText}>Reset password</Text>
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

  if (isLoading && users.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && users.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  const visibleUsers = filterUsersByStatus(users, statusFilter);

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerSubtitle}>{users.length} accounts</Text>
      </View>

      <View style={styles.filterRow}>
        {USER_STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, statusFilter === f && styles.chipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === f && styles.chipTextActive,
              ]}
            >
              {filterLabel(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
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
            icon="👥"
            title="No users"
            message="No accounts match this filter."
          />
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={openCreate}>
        <Text style={styles.addButtonText}>+ Add User</Text>
      </TouchableOpacity>

      {/* Create / edit user modal */}
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
              {editingUser ? 'Edit User' : 'New User'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={draftUsername}
              onChangeText={setDraftUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
              value={draftEmail}
              onChangeText={setDraftEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder={
                editingUser ? 'New password (leave blank to keep)' : 'Password'
              }
              placeholderTextColor="#666"
              value={draftPassword}
              onChangeText={setDraftPassword}
              secureTextEntry
            />

            {editingUser ? null : (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Administrator</Text>
                <Switch
                  value={draftIsAdmin}
                  onValueChange={setDraftIsAdmin}
                  trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
                />
              </View>
            )}

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
    </SafeContainer>
  );
};

const statusBadgeStyle = (status: AdminUser['status']) => {
  switch (status) {
    case 'active':
      return styles.badgeActive;
    case 'pending':
      return styles.badgePending;
    case 'disabled':
      return styles.badgeDisabled;
    default:
      return styles.badgeDisabled;
  }
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    color: '#888',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  userCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  userIdentity: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  badges: {
    alignItems: 'flex-end',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  badgeAdmin: {
    color: '#fff',
    backgroundColor: '#0066cc',
  },
  badgeActive: {
    color: '#0f0f1a',
    backgroundColor: '#22c55e',
  },
  badgePending: {
    color: '#0f0f1a',
    backgroundColor: '#eab308',
  },
  badgeDisabled: {
    color: '#fff',
    backgroundColor: '#6b7280',
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
});

export default AdminUsersScreen;
