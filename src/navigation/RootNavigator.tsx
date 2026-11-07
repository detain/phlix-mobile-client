/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/navigation/RootNavigator.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Alert, BackHandler, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../stores/useAuthStore';
import {
  HomeScreen,
  LibraryScreen,
  MediaDetailScreen,
  PlayerScreen,
  SearchScreen,
  SettingsScreen,
  DownloadsScreen,
  LoginScreen,
  ProfileSelectScreen,
  AdminDashboardScreen,
  AdminUsersScreen,
  AdminLibrariesScreen,
  AdminPluginsScreen,
  AdminAuthProvidersScreen,
  AdminServerSettingsScreen,
  AdminBackupScreen,
  AdminLogsScreen,
  AdminFsBrowseScreen,
  CastScreen,
  LiveTvScreen,
  LiveTvRecordingsScreen,
  MusicScreen,
  MusicAlbumScreen,
  PhotosScreen,
  PhotoAlbumScreen,
  PhotoViewerScreen,
  CollectionsScreen,
  CollectionDetailScreen,
  FavoritesScreen,
  PasskeysScreen,
  RecommendationsScreen,
  WatchHistoryScreen,
} from '../screens';
import { LoadingSpinner } from '../components/ui';
import { RootStackParamList, TabParamList, HomeStackParamList, LibraryStackParamList } from '../types/navigation';
// M-MOBILE-67 (review mobile__gameux Major 9): the container no longer takes
// the bare PHLIX_LINKING — deepLinkGate wraps the SAME prefixes/config with a
// park-and-replay gate so a link that arrives signed-out survives sign-in.
import {
  createGatedLinking,
  RN_DEEP_LINK_SOURCE,
  replayDeepLinkUrl,
  takePendingDeepLink,
} from './deepLinkGate';

/** Drain the park slot against this module's container. False = nothing was
 *  replayed (empty slot, or ref not ready — an honest drop, never a hang). */
function replayPendingDeepLink(): boolean {
  const url = takePendingDeepLink();
  if (url === null || !navigationRef.isReady()) {
    return false;
  }
  return replayDeepLinkUrl(url, (action) => navigationRef.dispatch(action));
}
import { CastSessionPill } from '../components/cast';
import { InsecureConnectionBanner } from '../components/ui/InsecureConnectionBanner';
import { createExitGuardHandler, EXIT_CONFIRM } from '../utils/exitGuard';
import { fireHaptic } from '../utils/haptics';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../utils/textScalePolicy';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();

// S298 — navigation ref for the hub-relay pending-command router. The consumer
// (src/syncplay/HubRelayConsumer.ts) runs OUTSIDE the navigator tree (booted
// from App.tsx), so it cannot use `useNavigation`; this ref is the seam that
// lets a delivered `pending_command` navigate the player to the media id.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Tab Bar Icon Component
//
// M29 (deferred lane): the tab icons were raw EMOJI rendered as Text —
// OS-dependent glyphs that cannot be tinted by focus state and break down
// where color fonts are disabled. @react-native-vector-icons/material-icons
// (the maintained successor of the deprecated react-native-vector-icons)
// ships real vector glyphs; the family gradle plugin copies the TTF into
// Android assets automatically, iOS delivers it via the pod's font resource
// plus the Info.plist UIAppFonts entry. The '/static' subpath is deliberate:
// the package default export's dynamic variant picker reaches for
// expo-modules-core, which this bare-RN app does not have.
import MaterialIcons from '@react-native-vector-icons/material-icons/static';

const TAB_ICONS = {
  Home: 'home',
  Library: 'library-books',
  Search: 'search',
  Downloads: 'file-download',
  Settings: 'settings',
} as const;

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const glyph = TAB_ICONS[name as keyof typeof TAB_ICONS] ?? 'help-outline';
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <MaterialIcons
        name={glyph}
        size={20}
        color={focused ? '#0066cc' : '#888'}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}
      />
    </View>
  );
};

// Home Stack
const HomeStackNavigator = () => (
  <HomeStack.Navigator
    id={undefined}
    screenOptions={{
      headerStyle: { backgroundColor: '#1a1a2e' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen
      name="Recommendations"
      component={RecommendationsScreen}
      options={{ title: 'For You' }}
    />
    <HomeStack.Screen
      name="MediaDetail"
      component={MediaDetailScreen}
      options={{ headerShown: false }}
    />
  </HomeStack.Navigator>
);

// Library Stack
const LibraryStackNavigator = () => (
  <LibraryStack.Navigator
    id={undefined}
    screenOptions={{
      headerStyle: { backgroundColor: '#1a1a2e' },
      headerTintColor: '#fff',
    }}
  >
    <LibraryStack.Screen
      name="LibraryMain"
      component={LibraryScreen}
      options={{ title: 'My Library' }}
    />
    <LibraryStack.Screen
      name="MediaDetail"
      component={MediaDetailScreen}
      options={{ headerShown: false }}
    />
  </LibraryStack.Navigator>
);

// Tab Navigator
// M-MOBILE-36 (review mobile__gameux): the fixed 60/8 box ignored the device
// bottom inset, so on gesture-home phones the home indicator sat ON the tab
// labels and clipped the lowest points of the targets. The bar now GROWS by
// the inset (paddingBottom carries it; height follows) instead of fighting it.
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
  <Tab.Navigator
    id={undefined}
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#1a1a2e',
        borderTopColor: '#2d2d44',
        height: 60 + Math.max(0, insets.bottom - 8),
        paddingBottom: Math.max(8, insets.bottom),
        paddingTop: 8,
      },
      tabBarActiveTintColor: '#0066cc',
      tabBarInactiveTintColor: '#888',
      // eslint-disable-next-line react/no-unstable-nested-components
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      // M-MOBILE-40 (review mobile__gameux m6): tab switches get the light
      // impact the platform convention expects (Android; see haptics.ts for
      // the iOS venue law).
      listeners: () => ({
        tabPress: () => fireHaptic('light'),
      }),
    })}
  >
    <Tab.Screen name="Home" component={HomeStackNavigator} />
    <Tab.Screen name="Library" component={LibraryStackNavigator} />
    <Tab.Screen
      name="Search"
      component={SearchScreen}
      options={{ headerShown: false }}
    />
    <Tab.Screen
      name="Downloads"
      component={DownloadsScreen}
      options={{ headerShown: false }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
  </Tab.Navigator>
  );
};

// M-MOBILE-35 (review mobile__gameux m1): hardware back used to quit the app
// from any dead root (Login, first tab with an empty stack) with no signal.
// This guard is the LAST resort, not a hijacker: the pure handler declines
// whenever the navigator can still pop (pops keep working untouched), and
// only at a true root does it swallow the default exit and raise an explicit
// confirm. iOS registers nothing — there is no hardware back to guard.
const RootExitGuard: React.FC = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const handler = createExitGuardHandler({
      canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),
      confirmExit: (onConfirm) => {
        fireHaptic('destructive');
        Alert.alert(EXIT_CONFIRM.title, EXIT_CONFIRM.message, [
          { text: EXIT_CONFIRM.cancel, style: 'cancel' },
          { text: EXIT_CONFIRM.confirm, onPress: onConfirm },
        ]);
      },
      exitApp: () => BackHandler.exitApp(),
    });
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handler
    );
    return () => subscription.remove();
  }, []);
  return null;
};

// Root Navigator
const RootNavigator = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // M-MOBILE-67: the gate reads auth state through a ref so the one built
  // `gatedLinking` object never needs rebuilding across login/logout — the
  // react-navigation subscribe callback consults it at event time.
  const authedRef = useRef(false);
  authedRef.current = isAuthenticated;
  const gatedLinking = useMemo(
    () => createGatedLinking(RN_DEEP_LINK_SOURCE, () => authedRef.current),
    []
  );

  // Drain the park slot the moment the tree can host routes. Deferred one tick
  // so the authenticated screens are committed before the reset lands.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const timer = setTimeout(() => {
      replayPendingDeepLink();
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // MW-033 (review mobile__gameux #9): the boot gate used to speak its own
  // hand-rolled Text copy while every other loading surface in the app goes
  // through the shared spinner/skeleton language. fullScreen already means
  // "centered ActivityIndicator on #0f0f1a" — the gate's exact prior visual
  // vocabulary, now from the one component that owns it.
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={gatedLinking}>
      <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
              name="Profiles"
              component={ProfileSelectScreen}
              options={{
                headerShown: true,
                title: 'Profiles',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
              options={{
                headerShown: true,
                title: 'Dashboard',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminUsers"
              component={AdminUsersScreen}
              options={{
                headerShown: true,
                title: 'Users',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminLibraries"
              component={AdminLibrariesScreen}
              options={{
                headerShown: true,
                title: 'Libraries',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminPlugins"
              component={AdminPluginsScreen}
              options={{
                headerShown: true,
                title: 'Plugins',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminAuthProviders"
              component={AdminAuthProvidersScreen}
              options={{
                headerShown: true,
                title: 'Auth Providers',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminServerSettings"
              component={AdminServerSettingsScreen}
              options={{
                headerShown: true,
                title: 'Server Settings',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminBackup"
              component={AdminBackupScreen}
              options={{
                headerShown: true,
                title: 'Backup',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminLogs"
              component={AdminLogsScreen}
              options={{
                headerShown: true,
                title: 'Logs',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="AdminFsBrowse"
              component={AdminFsBrowseScreen}
              options={{
                headerShown: true,
                title: 'File Browser',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="LiveTv"
              component={LiveTvScreen}
              options={{
                headerShown: true,
                title: 'Live TV',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="LiveTvRecordings"
              component={LiveTvRecordingsScreen}
              options={{
                headerShown: true,
                title: 'Recordings',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Music"
              component={MusicScreen}
              options={{
                headerShown: true,
                title: 'Music',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="MusicAlbum"
              component={MusicAlbumScreen}
              options={{
                headerShown: true,
                title: 'Album',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Photos"
              component={PhotosScreen}
              options={{
                headerShown: true,
                title: 'Photos',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="PhotoAlbum"
              component={PhotoAlbumScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.title ?? 'Album',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              })}
            />
            <Stack.Screen
              name="PhotoViewer"
              component={PhotoViewerScreen}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
                animation: 'fade',
                contentStyle: { backgroundColor: '#000' },
              }}
            />
            <Stack.Screen
              name="Collections"
              component={CollectionsScreen}
              options={{
                headerShown: true,
                title: 'Collections',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="CollectionDetail"
              component={CollectionDetailScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.title ?? 'Collection',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              })}
            />
            <Stack.Screen
              name="Favorites"
              component={FavoritesScreen}
              options={{
                headerShown: true,
                title: 'Favorites',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="WatchHistory"
              component={WatchHistoryScreen}
              options={{
                headerShown: true,
                title: 'Watch History',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Passkeys"
              component={PasskeysScreen}
              options={{
                headerShown: true,
                title: 'Passkeys',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Cast"
              component={CastScreen}
              options={{
                headerShown: true,
                title: 'Cast',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen
              name="Player"
              component={PlayerScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
              }}
            />
          </>
        )}
      </Stack.Navigator>
      {/* M-MOBILE-16: root-level reachability surface for a live cast —
          renders null unless the store holds an undismissed session. */}
      <CastSessionPill />
      {/* M-MOBILE-51 (review mobile__secnet m3): persistent cleartext-lane
          indicator; null while every resolved lane is encrypted. */}
      <InsecureConnectionBanner />
      {/* M-MOBILE-35: hardware-back exit confirm at dead roots. */}
      <RootExitGuard />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabIcon: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // M-MOBILE-36: scale 1.1 on an emoji was nearly invisible as a "selected"
  // signal; the active tab now also sits in a tinted pill (same 0066cc family
  // as the active tint).
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
    backgroundColor: 'rgba(0,102,204,0.22)',
    borderRadius: 15,
  },
});

export default RootNavigator;
