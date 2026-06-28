// src/screens/PasskeysScreen.tsx
//
// Passkey management (slice E10e). Lists the current user's registered passkeys,
// adds a new one via the on-device registration ceremony, and deletes with
// confirm. Gated on platform support — shows a friendly state when passkeys are
// unavailable (Jest / older OS / no native module).
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useWebAuthnStore } from '../stores/useWebAuthnStore';
import { webAuthnService } from '../services/WebAuthnService';
import type { PasskeyCredential } from '../types/webauthn';
import {
  passkeyLabel,
  lastUsedLabel,
  webauthnErrorMessage,
} from './webauthn/webauthnHelpers';

const PasskeysScreen: React.FC = () => {
  const credentials = useWebAuthnStore((s) => s.credentials);
  const loading = useWebAuthnStore((s) => s.loading);
  const error = useWebAuthnStore((s) => s.error);
  const loadCredentials = useWebAuthnStore((s) => s.loadCredentials);
  const registerPasskey = useWebAuthnStore((s) => s.registerPasskey);
  const deletePasskey = useWebAuthnStore((s) => s.deletePasskey);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let active = true;
    webAuthnService
      .isSupported()
      .then((ok) => {
        if (!active) {
          return;
        }
        setSupported(ok);
        if (ok) {
          loadCredentials();
        }
      })
      .catch(() => {
        if (active) {
          setSupported(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loadCredentials]);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    setShowAdd(false);
    setNewName('');
    setAdding(true);
    try {
      await registerPasskey(name === '' ? undefined : name);
      Alert.alert('Passkey added', 'Your passkey is ready to use.');
    } catch (err) {
      Alert.alert('Could not add passkey', webauthnErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }, [newName, registerPasskey]);

  const handleDelete = useCallback(
    (cred: PasskeyCredential) => {
      Alert.alert(
        'Remove passkey',
        `Remove "${passkeyLabel(cred)}"? You won't be able to sign in with it anymore.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePasskey(cred.id);
              } catch (err) {
                Alert.alert('Could not remove passkey', webauthnErrorMessage(err));
              }
            },
          },
        ]
      );
    },
    [deletePasskey]
  );

  const renderItem = ({ item }: { item: PasskeyCredential }) => (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{passkeyLabel(item)}</Text>
        <Text style={styles.rowSubtitle}>Added {item.created_at}</Text>
        <Text style={styles.rowSubtitle}>{lastUsedLabel(item.last_used_at)}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleDelete(item)}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  // Support probe still running.
  if (supported === null) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  // Passkeys unavailable on this device.
  if (!supported) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="🔒"
          title="Passkeys aren't available"
          message="This device doesn't support passkeys. Use your username and password to sign in."
        />
      </SafeContainer>
    );
  }

  if (loading && credentials.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && credentials.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={loadCredentials} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={credentials}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAdd(true)}
            disabled={adding}
          >
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>+ Add a passkey</Text>
            )}
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔑"
            title="No passkeys yet"
            message="Add a passkey to sign in without a password."
          />
        }
        onRefresh={loadCredentials}
        refreshing={loading}
      />

      <Modal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdd(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAdd(false)}
        >
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Add a passkey</Text>
            <Text style={styles.modalHint}>
              Optionally name this passkey (e.g. the device it's on).
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Passkey name (optional)"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleAdd}>
              <Text style={styles.modalButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setShowAdd(false);
                setNewName('');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  addButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalHint: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancel: {
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
  },
});

export default PasskeysScreen;
