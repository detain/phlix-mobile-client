// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useHubStore } from '../store/hubStore';
import ServerSwitcher from '../components/ServerSwitcher';

const SettingsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const server = useAuthStore((state) => state.server);
  const logout = useAuthStore((state) => state.logout);

  const {
    autoplay,
    setAutoplay,
    autoPlayNextEpisode,
    setAutoPlayNextEpisode,
    downloadOverWifiOnly,
    setDownloadOverWifiOnly,
    enableNotifications,
    setEnableNotifications,
    enableBiometricAuth,
    setEnableBiometricAuth,
  } = useSettingsStore();

  // Hub state
  const {
    hubUrl,
    session,
    servers,
    activeServerId,
    connectionMode,
    isLoading: hubLoading,
    error: hubError,
    signInToHub,
    signOutOfHub,
    setConnectionMode,
    fetchServers,
    clearError,
  } = useHubStore();

  const [showHubSignIn, setShowHubSignIn] = useState(false);
  const [hubSignInUrl, setHubSignInUrl] = useState('');
  const [hubUsername, setHubUsername] = useState('');
  const [hubPassword, setHubPassword] = useState('');
  const [showServerSwitcher, setShowServerSwitcher] = useState(false);

  // Load persisted hub state on mount
  useEffect(() => {
    useHubStore.getState().loadPersistedState();
  }, []);

  const activeServer = servers.find((s) => s.serverId === activeServerId);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleHubSignIn = async () => {
    if (!hubSignInUrl || !hubUsername || !hubPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await signInToHub(hubSignInUrl, hubUsername, hubPassword);
      setShowHubSignIn(false);
      setHubPassword('');
      Alert.alert('Success', 'Signed in to hub');
    } catch (err) {
      Alert.alert(
        'Sign In Failed',
        err instanceof Error ? err.message : 'Failed to sign in'
      );
    }
  };

  const handleHubSignOut = () => {
    Alert.alert(
      'Sign Out of Hub',
      'Are you sure you want to sign out of the hub?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            signOutOfHub();
          },
        },
      ]
    );
  };

  const renderSettingRow = (
    label: string,
    value: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      {value}
    </TouchableOpacity>
  );

  return (
    <SafeContainer>
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.accountInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.display_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.accountDetails}>
                <Text style={styles.displayName}>{user?.display_name || 'User'}</Text>
                <Text style={styles.username}>@{user?.username || 'unknown'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Hub Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hub</Text>
          <View style={styles.card}>
            {session && hubUrl ? (
              <>
                {/* Signed in to Hub */}
                <View style={styles.hubSignedIn}>
                  <View style={styles.hubInfo}>
                    <Text style={styles.hubSignedInText}>
                      Signed in as {session.userId}
                    </Text>
                    <Text style={styles.hubUrlText}>{hubUrl}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.hubSignOutButton}
                    onPress={handleHubSignOut}
                  >
                    <Text style={styles.hubSignOutText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>

                {/* Active Server */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => setShowServerSwitcher(true)}
                >
                  <Text style={styles.settingLabel}>Active Server</Text>
                  <View style={styles.activeServerInfo}>
                    <Text style={styles.activeServerName}>
                      {activeServer?.serverName || 'None'}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>

                {/* Connection Mode */}
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Connection Mode</Text>
                  <View style={styles.connectionModeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.modeOption,
                        connectionMode === 'direct' && styles.modeOptionActive,
                      ]}
                      onPress={() => setConnectionMode('direct')}
                    >
                      <Text
                        style={[
                          styles.modeOptionText,
                          connectionMode === 'direct' && styles.modeOptionTextActive,
                        ]}
                      >
                        Direct
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modeOption,
                        connectionMode === 'relay' && styles.modeOptionActive,
                      ]}
                      onPress={() => setConnectionMode('relay')}
                    >
                      <Text
                        style={[
                          styles.modeOptionText,
                          connectionMode === 'relay' && styles.modeOptionTextActive,
                        ]}
                      >
                        Via Hub
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Server List Preview */}
                <View style={styles.serverListPreview}>
                  <Text style={styles.serverListTitle}>
                    Claimed Servers ({servers.length})
                  </Text>
                  {servers.slice(0, 3).map((srv) => (
                    <View key={srv.serverId} style={styles.serverListItem}>
                      <View
                        style={[
                          styles.serverStatusDot,
                          srv.status === 'online'
                            ? styles.serverStatusOnline
                            : styles.serverStatusOffline,
                        ]}
                      />
                      <Text style={styles.serverListItemName}>
                        {srv.serverName}
                      </Text>
                      {srv.serverId === activeServerId && (
                        <Text style={styles.serverListItemActive}>Active</Text>
                      )}
                    </View>
                  ))}
                  {servers.length > 3 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setShowServerSwitcher(true)}
                    >
                      <Text style={styles.viewAllButtonText}>
                        View all {servers.length} servers
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              /* Not signed in to Hub */
              <TouchableOpacity
                style={styles.hubSignInButton}
                onPress={() => setShowHubSignIn(true)}
              >
                <Text style={styles.hubSignInButtonText}>Sign in to Hub</Text>
                <Text style={styles.hubSignInHint}>
                  Access your claimed servers remotely
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Playback Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playback</Text>
          <View style={styles.card}>
            {renderSettingRow(
              'Autoplay',
              <Switch
                value={autoplay}
                onValueChange={setAutoplay}
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            )}
            {renderSettingRow(
              'Auto-play next episode',
              <Switch
                value={autoPlayNextEpisode}
                onValueChange={setAutoPlayNextEpisode}
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            )}
          </View>
        </View>

        {/* Download Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downloads</Text>
          <View style={styles.card}>
            {renderSettingRow(
              'Download over Wi-Fi only',
              <Switch
                value={downloadOverWifiOnly}
                onValueChange={setDownloadOverWifiOnly}
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            )}
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            {renderSettingRow(
              'Push notifications',
              <Switch
                value={enableNotifications}
                onValueChange={setEnableNotifications}
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            )}
            {renderSettingRow(
              'Biometric authentication',
              <Switch
                value={enableBiometricAuth}
                onValueChange={setEnableBiometricAuth}
                trackColor={{ false: '#3d3d3d', true: '#0066cc' }}
              />
            )}
          </View>
        </View>

        {/* Server Section */}
        {server && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Server</Text>
            <View style={styles.card}>
              <View style={styles.serverInfo}>
                <Text style={styles.serverName}>{server.name}</Text>
                <Text style={styles.serverUrl}>{server.url}</Text>
                <Text style={styles.serverVersion}>Version {server.version}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Phlix Mobile</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Hub Sign In Modal */}
      <Modal
        visible={showHubSignIn}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHubSignIn(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHubSignIn(false)}
        >
          <View
            style={styles.hubSignInModal}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.hubSignInTitle}>Sign in to Hub</Text>

            <TextInput
              style={styles.hubInput}
              placeholder="Hub URL (e.g., https://hub.example.com)"
              placeholderTextColor="#666"
              value={hubSignInUrl}
              onChangeText={setHubSignInUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <TextInput
              style={styles.hubInput}
              placeholder="Username"
              placeholderTextColor="#666"
              value={hubUsername}
              onChangeText={setHubUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.hubInput}
              placeholder="Password"
              placeholderTextColor="#666"
              value={hubPassword}
              onChangeText={setHubPassword}
              secureTextEntry
            />

            {hubError && (
              <Text style={styles.hubErrorText}>{hubError}</Text>
            )}

            <TouchableOpacity
              style={styles.hubSubmitButton}
              onPress={handleHubSignIn}
              disabled={hubLoading}
            >
              <Text style={styles.hubSubmitButtonText}>
                {hubLoading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hubCancelButton}
              onPress={() => {
                setShowHubSignIn(false);
                clearError();
              }}
            >
              <Text style={styles.hubCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Server Switcher Modal */}
      <ServerSwitcher
        visible={showServerSwitcher}
        onClose={() => setShowServerSwitcher(false)}
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  settingLabel: {
    color: '#fff',
    fontSize: 16,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  accountDetails: {
    flex: 1,
  },
  displayName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  username: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  serverInfo: {
    padding: 16,
  },
  serverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  serverUrl: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  serverVersion: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  appName: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  appVersion: {
    color: '#444',
    fontSize: 12,
    marginTop: 4,
  },
  // Hub section styles
  hubSignInButton: {
    padding: 20,
    alignItems: 'center',
  },
  hubSignInButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
  },
  hubSignInHint: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  hubSignedIn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  hubInfo: {
    flex: 1,
  },
  hubSignedInText: {
    color: '#fff',
    fontSize: 14,
  },
  hubUrlText: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  hubSignOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hubSignOutText: {
    color: '#dc3545',
    fontSize: 14,
  },
  activeServerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeServerName: {
    color: '#888',
    fontSize: 16,
  },
  chevron: {
    color: '#888',
    fontSize: 20,
    marginLeft: 4,
  },
  connectionModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 2,
  },
  modeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeOptionActive: {
    backgroundColor: '#0066cc',
  },
  modeOptionText: {
    color: '#888',
    fontSize: 13,
  },
  modeOptionTextActive: {
    color: '#fff',
  },
  serverListPreview: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  serverListTitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  serverListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  serverStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  serverStatusOnline: {
    backgroundColor: '#22c55e',
  },
  serverStatusOffline: {
    backgroundColor: '#ef4444',
  },
  serverListItemName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  serverListItemActive: {
    color: '#0066cc',
    fontSize: 12,
    fontWeight: '500',
  },
  viewAllButton: {
    marginTop: 8,
  },
  viewAllButtonText: {
    color: '#0066cc',
    fontSize: 14,
  },
  // Hub sign in modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubSignInModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
  },
  hubSignInTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  hubInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    color: '#fff',
    fontSize: 16,
  },
  hubErrorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  hubSubmitButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  hubSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hubCancelButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  hubCancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
});

export default SettingsScreen;
