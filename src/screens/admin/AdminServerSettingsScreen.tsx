/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/admin/AdminServerSettingsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import {
  settingFieldType,
  settingValueToInput,
  coerceSettingValue,
  isOverridden,
  type SettingFieldKind,
} from './adminScreenHelpers';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

/** A row of the editable settings form, derived from the server payload. */
interface SettingRow {
  key: string;
  kind: SettingFieldKind;
  overridden: boolean;
}

/**
 * Admin server-settings editor (E10c). Renders each setting typed by the
 * `types` map (bool → Switch, string/number → input), marks `overridden` keys,
 * and Saves the full draft via `updateServerSettings` (the `{success,data}`
 * envelope unwrap happens in the manager). Non-admins see an informational
 * state. Save only sends keys whose draft value actually differs from the
 * loaded value, so an untouched field is never re-asserted.
 */
const AdminServerSettingsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const serverSettings = useAdminStore((state) => state.serverSettings);
  const isLoading = useAdminStore((state) => state.serverSettingsLoading);
  const error = useAdminStore((state) => state.serverSettingsError);
  const loadServerSettings = useAdminStore((state) => state.loadServerSettings);
  const updateServerSettings = useAdminStore(
    (state) => state.updateServerSettings
  );

  // Draft of the form fields as STRINGS for inputs / booleans for switches.
  const [draftStrings, setDraftStrings] = useState<Record<string, string>>({});
  const [draftBools, setDraftBools] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadServerSettings();
    }
  }, [isAdmin, loadServerSettings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Seed the draft whenever the loaded settings change.
  useEffect(() => {
    if (!serverSettings) {
      return;
    }
    const strings: Record<string, string> = {};
    const bools: Record<string, boolean> = {};
    for (const key of Object.keys(serverSettings.settings)) {
      const value = serverSettings.settings[key];
      const kind = settingFieldType(serverSettings.types, key);
      if (kind === 'bool') {
        bools[key] = value === true || value === 1 || value === 'true';
      } else {
        strings[key] = settingValueToInput(value);
      }
    }
    setDraftStrings(strings);
    setDraftBools(bools);
  }, [serverSettings]);

  const rows: SettingRow[] = useMemo(() => {
    if (!serverSettings) {
      return [];
    }
    return Object.keys(serverSettings.settings).map((key) => ({
      key,
      kind: settingFieldType(serverSettings.types, key),
      overridden: isOverridden(serverSettings.overridden, key),
    }));
  }, [serverSettings]);

  const handleSave = async () => {
    if (!serverSettings) {
      return;
    }
    // Build a patch of only the changed keys (coerced to their typed value).
    const patch: Record<string, unknown> = {};
    for (const row of rows) {
      const original = serverSettings.settings[row.key];
      if (row.kind === 'bool') {
        const next = !!draftBools[row.key];
        const wasTrue =
          original === true || original === 1 || original === 'true';
        if (next !== wasTrue) {
          patch[row.key] = next;
        }
      } else {
        const raw = draftStrings[row.key] ?? '';
        if (raw !== settingValueToInput(original)) {
          patch[row.key] = coerceSettingValue(row.kind, raw);
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      Alert.alert('No changes', 'Nothing to save.');
      return;
    }

    setSaving(true);
    try {
      await updateServerSettings(patch);
      Alert.alert('Saved', 'Settings updated.');
    } catch (err) {
      Alert.alert('Save failed', errText(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
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

  if (isLoading && !serverSettings) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && !serverSettings) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  if (!serverSettings || rows.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="⚙️"
          title="No settings"
          message="The server returned no editable settings."
        />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Server Settings</Text>
          <Text style={styles.headerSubtitle}>
            {rows.length} setting{rows.length === 1 ? '' : 's'}
          </Text>
        </View>

        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.key} numberOfLines={1}>
                {row.key}
              </Text>
              {row.overridden ? (
                <Text style={styles.overrideBadge}>OVERRIDDEN</Text>
              ) : null}
            </View>
            {row.kind === 'bool' ? (
              <Switch
                value={!!draftBools[row.key]}
                onValueChange={(next) =>
                  setDraftBools((prev) => ({ ...prev, [row.key]: next }))
                }
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={draftStrings[row.key] ?? ''}
                onChangeText={(text) =>
                  setDraftStrings((prev) => ({ ...prev, [row.key]: text }))
                }
                placeholder={row.kind === 'number' ? '0' : ''}
                placeholderTextColor="#666"
                keyboardType={row.kind === 'number' ? 'numeric' : 'default'}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
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
  row: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  key: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  overrideBadge: {
    color: '#0f0f1a',
    backgroundColor: '#eab308',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminServerSettingsScreen;
