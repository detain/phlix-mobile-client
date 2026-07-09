/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';

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
} from '../screens';
import { RootStackParamList, TabParamList, HomeStackParamList, LibraryStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();

// Tab Bar Icon Component
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Home: '🏠',
    Library: '📚',
    Search: '🔍',
    Downloads: '⬇️',
    Settings: '⚙️',
  };

  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={styles.tabIconText}>{icons[name]}</Text>
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
const TabNavigator = () => (
  <Tab.Navigator
    id={undefined}
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#1a1a2e',
        borderTopColor: '#2d2d44',
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarActiveTintColor: '#0066cc',
      tabBarInactiveTintColor: '#888',
      // eslint-disable-next-line react/no-unstable-nested-components
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
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

// Root Navigator
const RootNavigator = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
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
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
  },
  tabIconText: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default RootNavigator;
