/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/App.tsx
import React, { useEffect } from 'react';
import { AppState, StatusBar, LogBox, StyleSheet, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootNavigator, navigationRef } from './navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './stores/useAuthStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { initDeviceIdentity } from './api/deviceIdentity';
import { startHubRelayConsumer, stopHubRelayConsumer } from './syncplay/HubRelayConsumer';
import { syncPlayService } from './syncplay/SyncPlayService';

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
        //
        // Review mobile__exploiter M8 boot-race cure: `checkAuth` used to run
        // CONCURRENT with `loadSettings`, so on a cold vault it could dial
        // /auth/me against the BUILD-TIME fallback host (settings serverUrl
        // still ''). The per-origin pin then refused the token, and a 401
        // from the foreign host routed to clearTokens() — a legitimate
        // session destroyed by LOAD ORDER. Settings hydrate FIRST; the
        // device-id leg has no ordering stake and stays parallel.
        const identity = initDeviceIdentity();
        await loadSettings();
        await Promise.all([identity, checkAuth()]);
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

  // SyncPlay socket lifecycle vs the OS (review mobile__asphp M10): iOS
  // suspends/jetsus a backgrounded socket mid-stream and Android Doze can
  // strand one silently — the old code let the OS decide when the transport
  // died, so a member who backgrounded the app for a phone call could return
  // to a dead group that still rendered "connected". On background we close
  // the socket OUR terms (membership intent kept); on foreground we re-dial
  // from attempt 0 if the viewer still means to be in a group.
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      // 'inactive' is deliberately not a teardown trigger: it fires for
      // transient interruptions (notification shade, permission dialogs) and
      // dropping the group for a swipe-down would be its own bug.
      if (status === 'background') {
        syncPlayService.handleAppBackground();
      } else if (status === 'active') {
        syncPlayService.handleAppForeground();
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
        {/* M-MOBILE-71 (review mobile__devops Major 19): render-phase crashes
            report to the device log and show a recoverable card instead of
            the white screen / silent exit the release build used to have. */}
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
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
