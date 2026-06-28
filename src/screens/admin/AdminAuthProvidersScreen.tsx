// src/screens/admin/AdminAuthProvidersScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import type { AuthProvider, AuthProviderConfigSchema } from '../../types/admin';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

/**
 * Admin auth-providers manager (E10c). Lists providers with an enable/disable
 * toggle; tap a provider to view its config-schema (READ-ONLY — there is no
 * config WRITE route, only schema GET + enable/disable). Non-admins see an
 * informational state. Mirrors AdminUsersScreen gating/list conventions.
 */
const AdminAuthProvidersScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const providers = useAdminStore((state) => state.authProviders);
  const isLoading = useAdminStore((state) => state.authProvidersLoading);
  const error = useAdminStore((state) => state.authProvidersError);
  const loadAuthProviders = useAdminStore((state) => state.loadAuthProviders);
  const enableAuthProvider = useAdminStore((state) => state.enableAuthProvider);
  const disableAuthProvider = useAdminStore(
    (state) => state.disableAuthProvider
  );
  const getConfigSchema = useAdminStore(
    (state) => state.getAuthProviderConfigSchema
  );

  // Config-schema viewer modal
  const [schemaVisible, setSchemaVisible] = useState(false);
  const [schemaName, setSchemaName] = useState('');
  const [schema, setSchema] = useState<AuthProviderConfigSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  // Track in-flight toggles so a provider row's Switch is disabled mid-flight.
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadAuthProviders();
    }
  }, [isAdmin, loadAuthProviders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (provider: AuthProvider, next: boolean) => {
    setBusy(provider.name);
    try {
      if (next) {
        await enableAuthProvider(provider.name);
      } else {
        await disableAuthProvider(provider.name);
      }
    } catch (err) {
      Alert.alert(
        'Update failed',
        errText(err, 'Could not change the provider.')
      );
    } finally {
      setBusy(null);
    }
  };

  const openSchema = async (provider: AuthProvider) => {
    setSchemaName(provider.name);
    setSchema(null);
    setSchemaError(null);
    setSchemaVisible(true);
    setSchemaLoading(true);
    try {
      const result = await getConfigSchema(provider.name);
      setSchema(result);
    } catch (err) {
      setSchemaError(errText(err, 'Could not load the config schema.'));
    } finally {
      setSchemaLoading(false);
    }
  };

  const providerEnabled = (provider: AuthProvider): boolean => {
    // The list payload reports support, not the live enabled flag in older
    // servers; treat an explicit `enabled` if present, else fall back to
    // supports_authentication for the toggle's initial position.
    if (typeof provider.enabled === 'boolean') {
      return provider.enabled;
    }
    return !!provider.supports_authentication;
  };

  const renderProvider = ({ item }: { item: AuthProvider }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.sub}>
            {item.supports_authentication
              ? 'Supports authentication'
              : 'Metadata / non-auth provider'}
          </Text>
        </View>
        <Switch
          value={providerEnabled(item)}
          onValueChange={(next) => handleToggle(item, next)}
          disabled={busy === item.name}
          trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
        />
      </View>
      <TouchableOpacity
        style={styles.schemaButton}
        onPress={() => openSchema(item)}
      >
        <Text style={styles.schemaButtonText}>View config schema</Text>
      </TouchableOpacity>
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

  if (isLoading && providers.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && providers.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Auth Providers</Text>
        <Text style={styles.headerSubtitle}>
          {providers.length} provider{providers.length === 1 ? '' : 's'}
        </Text>
      </View>

      <FlatList
        data={providers}
        keyExtractor={(item) => item.name}
        renderItem={renderProvider}
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
            icon="🔑"
            title="No auth providers"
            message="This server exposes no authentication providers."
          />
        }
      />

      {/* Config-schema viewer (read-only) */}
      <Modal
        visible={schemaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSchemaVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSchemaVisible(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{schemaName} — Config schema</Text>
            <Text style={styles.modalNote}>
              Read-only. Configure this provider on the server (no mobile write
              route).
            </Text>
            {schemaLoading ? (
              <LoadingSpinner />
            ) : schemaError ? (
              <Text style={styles.schemaError}>{schemaError}</Text>
            ) : (
              <ScrollView style={styles.schemaScroll}>
                <Text style={styles.schemaJson}>
                  {schema
                    ? JSON.stringify(schema, null, 2)
                    : 'No schema provided.'}
                </Text>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSchemaVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
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
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  identity: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sub: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  schemaButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  schemaButtonText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
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
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalNote: {
    color: '#888',
    fontSize: 13,
    marginBottom: 16,
  },
  schemaScroll: {
    maxHeight: 360,
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 12,
  },
  schemaJson: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  schemaError: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
  },
  closeButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  closeButtonText: {
    color: '#888',
    fontSize: 16,
  },
});

export default AdminAuthProvidersScreen;
