/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/App.tsx
import React, { useEffect } from 'react';
import { StatusBar, LogBox, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootNavigator, navigationRef } from './navigation';
import { useAuthStore } from './stores/useAuthStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { initDeviceIdentity } from './api/deviceIdentity';
import { startHubRelayConsumer, stopHubRelayConsumer } from './syncplay/HubRelayConsumer';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const App: React.FC = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    // Initialize app
    const initialize = async () => {
      try {
        // Resolve the stable device id early so the per-request header builder
        // (sync) reads the real persisted value.
        await Promise.all([initDeviceIdentity(), checkAuth(), loadSettings()]);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }

      // S298 — boot the hub-relay pending-command consumer ("open-whenever").
      // The socket opens itself once hub auth exists (the hub store restores a
      // persisted session) and stays open with a capped reconnect ladder until
      // stopHubRelayConsumer. A delivered "Alexa, play X" frame routes into the
      // Player route with the media id — the load-a-new-title path.
      startHubRelayConsumer({
        navigateToPlayer: (itemId) => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('Player', { itemId });
          }
        },
      });
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopHubRelayConsumer();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
