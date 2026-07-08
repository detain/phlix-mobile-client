/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/admin/AdminPluginsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import type { Plugin, PluginDetail, CatalogPlugin } from '../../types/admin';
import {
  pluginSettingFields,
  validatePluginUrl,
  settingValueToInput,
  coerceSettingValue,
  type PluginSettingField,
} from './adminScreenHelpers';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

type Tab = 'installed' | 'catalog';

/**
 * Admin plugins manager (E10c) — the biggest E10c surface. A segmented control
 * switches between INSTALLED plugins (enable/disable, uninstall, tap → settings
 * editor built from `settings_schema`) and the CATALOG (browse sources, install
 * a catalog plugin, add/remove a source). An "Install from URL" input validates
 * the https://|file:// scheme before POSTing. Non-admins see an informational
 * state. Mirrors AdminUsersScreen gating + modal conventions.
 */
const AdminPluginsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const plugins = useAdminStore((state) => state.plugins);
  const pluginsLoading = useAdminStore((state) => state.pluginsLoading);
  const pluginsError = useAdminStore((state) => state.pluginsError);
  const loadPlugins = useAdminStore((state) => state.loadPlugins);
  const getPlugin = useAdminStore((state) => state.getPlugin);
  const installPlugin = useAdminStore((state) => state.installPlugin);
  const updatePluginSettings = useAdminStore(
    (state) => state.updatePluginSettings
  );
  const enablePlugin = useAdminStore((state) => state.enablePlugin);
  const disablePlugin = useAdminStore((state) => state.disablePlugin);
  const uninstallPlugin = useAdminStore((state) => state.uninstallPlugin);

  const catalog = useAdminStore((state) => state.catalog);
  const catalogLoading = useAdminStore((state) => state.catalogLoading);
  const catalogError = useAdminStore((state) => state.catalogError);
  const loadCatalog = useAdminStore((state) => state.loadCatalog);
  const addCatalogSource = useAdminStore((state) => state.addCatalogSource);
  const removeCatalogSource = useAdminStore(
    (state) => state.removeCatalogSource
  );

  const [tab, setTab] = useState<Tab>('installed');
  const [busy, setBusy] = useState<string | null>(null);

  // Install-from-URL
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  // Add catalog source
  const [sourceUrl, setSourceUrl] = useState('');

  // Plugin settings editor modal
  const [editorVisible, setEditorVisible] = useState(false);
  const [detail, setDetail] = useState<PluginDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [fields, setFields] = useState<PluginSettingField[]>([]);
  const [fieldStrings, setFieldStrings] = useState<Record<string, string>>({});
  const [fieldBools, setFieldBools] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const refresh = useCallback(() => {
    if (!isAdmin) {
      return;
    }
    if (tab === 'installed') {
      loadPlugins();
    } else {
      loadCatalog();
    }
  }, [isAdmin, tab, loadPlugins, loadCatalog]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Install from URL ──
  const handleInstall = async () => {
    const validationError = validatePluginUrl(installUrl);
    if (validationError) {
      Alert.alert('Invalid URL', validationError);
      return;
    }
    setInstalling(true);
    try {
      await installPlugin(installUrl.trim());
      setInstallUrl('');
      Alert.alert('Installed', 'Plugin installed.');
    } catch (err) {
      Alert.alert('Install failed', errText(err, 'Could not install plugin.'));
    } finally {
      setInstalling(false);
    }
  };

  // ── Enable / disable / uninstall ──
  const handleToggle = async (plugin: Plugin, next: boolean) => {
    setBusy(plugin.name);
    try {
      if (next) {
        await enablePlugin(plugin.name);
      } else {
        await disablePlugin(plugin.name);
      }
    } catch (err) {
      Alert.alert('Update failed', errText(err, 'Could not update plugin.'));
    } finally {
      setBusy(null);
    }
  };

  const handleUninstall = (plugin: Plugin) => {
    Alert.alert(
      'Uninstall plugin',
      `Remove "${plugin.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            try {
              await uninstallPlugin(plugin.name);
            } catch (err) {
              Alert.alert(
                'Uninstall failed',
                errText(err, 'Could not uninstall plugin.')
              );
            }
          },
        },
      ]
    );
  };

  // ── Settings editor ──
  const openSettings = async (name: string) => {
    setDetail(null);
    setDetailError(null);
    setFields([]);
    setFieldStrings({});
    setFieldBools({});
    setEditorVisible(true);
    setDetailLoading(true);
    try {
      const result = await getPlugin(name);
      setDetail(result);
      const derivedFields = pluginSettingFields(result.settings_schema);
      setFields(derivedFields);
      const strings: Record<string, string> = {};
      const bools: Record<string, boolean> = {};
      for (const field of derivedFields) {
        const value = result.settings?.[field.key];
        if (field.kind === 'bool') {
          bools[field.key] = value === true || value === 1 || value === 'true';
        } else {
          strings[field.key] = settingValueToInput(value);
        }
      }
      setFieldStrings(strings);
      setFieldBools(bools);
    } catch (err) {
      setDetailError(errText(err, 'Could not load plugin detail.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!detail) {
      return;
    }
    const settings: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.kind === 'bool') {
        settings[field.key] = !!fieldBools[field.key];
      } else {
        settings[field.key] = coerceSettingValue(
          field.kind,
          fieldStrings[field.key] ?? ''
        );
      }
    }
    setSavingSettings(true);
    try {
      await updatePluginSettings(detail.name, settings);
      setEditorVisible(false);
      Alert.alert('Saved', 'Plugin settings updated.');
    } catch (err) {
      Alert.alert('Save failed', errText(err, 'Could not save settings.'));
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Catalog ──
  const handleAddSource = async () => {
    const validationError = validatePluginUrl(sourceUrl);
    if (validationError) {
      Alert.alert('Invalid URL', validationError);
      return;
    }
    try {
      await addCatalogSource(sourceUrl.trim());
      setSourceUrl('');
    } catch (err) {
      Alert.alert('Add failed', errText(err, 'Could not add source.'));
    }
  };

  const handleRemoveSource = (url: string) => {
    Alert.alert('Remove source', `Remove catalog source "${url}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCatalogSource(url);
          } catch (err) {
            Alert.alert(
              'Remove failed',
              errText(err, 'Could not remove source.')
            );
          }
        },
      },
    ]);
  };

  const handleInstallCatalogPlugin = async (cp: CatalogPlugin) => {
    Alert.alert('Install plugin', `Install "${cp.name}" v${cp.version}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Install',
        onPress: async () => {
          // The catalog entry has no install URL on the client; install by name
          // is server-driven. We surface a friendly note when the contract only
          // supports URL installs — the install route takes a URL, so prefer the
          // "Install from URL" field for arbitrary plugins.
          Alert.alert(
            'Install from URL',
            'Catalog plugins are installed via their source URL. Copy the plugin URL into the "Install from URL" field on the Installed tab.'
          );
        },
      },
    ]);
  };

  // ── Renderers ──
  const renderPlugin = ({ item }: { item: Plugin }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
            {item.signed ? ' ✓' : ''}
          </Text>
          <Text style={styles.sub}>
            v{item.version} · {item.type}
          </Text>
        </View>
        <Switch
          value={!!item.enabled}
          onValueChange={(next) => handleToggle(item, next)}
          disabled={busy === item.name}
          trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
        />
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openSettings(item.name)}
        >
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUninstall(item)}
        >
          <Text style={styles.actionTextDanger}>Uninstall</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInstalledTab = () => {
    if (pluginsLoading && plugins.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (pluginsError && plugins.length === 0) {
      return <ErrorView message={pluginsError} onRetry={refresh} />;
    }
    return (
      <FlatList
        data={plugins}
        keyExtractor={(item) => item.name}
        renderItem={renderPlugin}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.installBox}>
            <Text style={styles.installLabel}>Install from URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://… or file://…"
              placeholderTextColor="#666"
              value={installUrl}
              onChangeText={setInstallUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleInstall}
              disabled={installing}
            >
              <Text style={styles.primaryButtonText}>
                {installing ? 'Installing…' : 'Install'}
              </Text>
            </TouchableOpacity>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={pluginsLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🧩"
            title="No plugins"
            message="No plugins are installed yet."
          />
        }
      />
    );
  };

  const renderCatalogTab = () => {
    if (catalogLoading && !catalog) {
      return <LoadingSpinner fullScreen />;
    }
    if (catalogError && !catalog) {
      return <ErrorView message={catalogError} onRetry={refresh} />;
    }
    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={catalogLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
      >
        <View style={styles.installBox}>
          <Text style={styles.installLabel}>Add catalog source</Text>
          <TextInput
            style={styles.input}
            placeholder="https://… catalog URL"
            placeholderTextColor="#666"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAddSource}
          >
            <Text style={styles.primaryButtonText}>Add source</Text>
          </TouchableOpacity>
        </View>

        {catalog?.sources?.length ? (
          <View style={styles.sourcesBox}>
            <Text style={styles.sectionTitle}>Sources</Text>
            {catalog.sources.map((src) => (
              <View key={src} style={styles.sourceRow}>
                <Text style={styles.sourceUrl} numberOfLines={1}>
                  {src}
                  {src === catalog.default_source ? '  (default)' : ''}
                </Text>
                {src === catalog.default_source ? null : (
                  <TouchableOpacity onPress={() => handleRemoveSource(src)}>
                    <Text style={styles.actionTextDanger}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {catalog?.errors?.length
          ? catalog.errors.map((e) => (
              <View key={e.source} style={styles.errorRow}>
                <Text style={styles.errorRowText}>
                  {e.source}: {e.error}
                </Text>
              </View>
            ))
          : null}

        {catalog?.catalogs?.map((cat) => (
          <View key={cat.source} style={styles.catalogBox}>
            <Text style={styles.sectionTitle}>
              {cat.name || cat.source}
            </Text>
            {cat.plugins.length === 0 ? (
              <Text style={styles.emptyCatalog}>No plugins</Text>
            ) : (
              cat.plugins.map((cp) => (
                <View key={cp.name} style={styles.catalogPluginRow}>
                  <View style={styles.identity}>
                    <Text style={styles.name} numberOfLines={1}>
                      {cp.name}
                    </Text>
                    <Text style={styles.sub}>
                      v{cp.version}
                      {cp.installed
                        ? cp.enabled
                          ? ' · installed, enabled'
                          : ' · installed'
                        : ''}
                    </Text>
                  </View>
                  {cp.installed ? (
                    <Text style={styles.installedTag}>Installed</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleInstallCatalogPlugin(cp)}
                    >
                      <Text style={styles.actionText}>Install</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        ))}

        {catalog && catalog.catalogs.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No catalogs"
            message="No catalog sources returned any plugins."
          />
        ) : null}
      </ScrollView>
    );
  };

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

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, tab === 'installed' && styles.segmentActive]}
          onPress={() => setTab('installed')}
        >
          <Text
            style={[
              styles.segmentText,
              tab === 'installed' && styles.segmentTextActive,
            ]}
          >
            Installed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === 'catalog' && styles.segmentActive]}
          onPress={() => setTab('catalog')}
        >
          <Text
            style={[
              styles.segmentText,
              tab === 'catalog' && styles.segmentTextActive,
            ]}
          >
            Catalog
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'installed' ? renderInstalledTab() : renderCatalogTab()}

      {/* Plugin settings editor modal */}
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
              {detail?.name ?? 'Plugin'} settings
            </Text>
            {detailLoading ? (
              <LoadingSpinner />
            ) : detailError ? (
              <Text style={styles.schemaError}>{detailError}</Text>
            ) : fields.length === 0 ? (
              <Text style={styles.noFields}>
                This plugin has no configurable settings.
              </Text>
            ) : (
              <ScrollView style={styles.fieldScroll}>
                {fields.map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.fieldLabel}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Text>
                    {field.description ? (
                      <Text style={styles.fieldDesc}>{field.description}</Text>
                    ) : null}
                    {field.kind === 'bool' ? (
                      <Switch
                        value={!!fieldBools[field.key]}
                        onValueChange={(next) =>
                          setFieldBools((prev) => ({
                            ...prev,
                            [field.key]: next,
                          }))
                        }
                        trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
                      />
                    ) : (
                      <TextInput
                        style={styles.input}
                        value={fieldStrings[field.key] ?? ''}
                        onChangeText={(text) =>
                          setFieldStrings((prev) => ({
                            ...prev,
                            [field.key]: text,
                          }))
                        }
                        secureTextEntry={field.secret}
                        keyboardType={
                          field.kind === 'number' ? 'numeric' : 'default'
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={field.secret ? '••••••' : ''}
                        placeholderTextColor="#666"
                      />
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {fields.length > 0 && !detailLoading && !detailError ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveSettings}
                disabled={savingSettings}
              >
                <Text style={styles.primaryButtonText}>
                  {savingSettings ? 'Saving…' : 'Save settings'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setEditorVisible(false)}
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    margin: 16,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#0066cc',
  },
  segmentText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  installBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  installLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    color: '#fff',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  sourcesBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sourceUrl: {
    color: '#cbd5e1',
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  catalogBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  catalogPluginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  installedTag: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCatalog: {
    color: '#666',
    fontSize: 13,
  },
  errorRow: {
    backgroundColor: '#2a1620',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorRowText: {
    color: '#f87171',
    fontSize: 13,
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
    maxHeight: '85%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  fieldScroll: {
    maxHeight: 420,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldDesc: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  noFields: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  schemaError: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
  },
  closeButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#888',
    fontSize: 16,
  },
});

export default AdminPluginsScreen;
