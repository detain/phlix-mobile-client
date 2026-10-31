/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { libraryManager } from '../api/LibraryManager';
import { userManager } from '../api/UserManager';
import { MediaItem } from '../types/media';
import { ticksToSeconds } from '../utils/resumePositions';
import { useFocusRefetch } from '../utils/useFocusRefetch';
import { useAuthStore } from '../stores/useAuthStore';
import { SafeContainer } from '../components/layout';
import { MediaList } from '../components/media/MediaList';
import { ContinueWatching } from '../components/media/ContinueWatching';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import { homeShowsEmptyState } from './homeEmptyState';
import {
  homeServerBlackout,
  HOME_SERVER_BLACKOUT_MESSAGE,
} from './homeFailurePolicy';
import { GridSkeleton } from '../components/ui/ContentSkeleton';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../utils/textScalePolicy';

// M-MOBILE-39 (review mobile__gameux m5): poster geometry used to be frozen
// at module scope from `Dimensions.get('window')` — foldables/tablets/
// landscape never re-laid out. It now follows `useWindowDimensions()` per
// render, the pattern the Photos screens already demonstrate.

type HomeNavigationProp = NativeStackNavigationProp<any>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  const posterWidth = (screenWidth - 60) / 3;
  const posterHeight = posterWidth * 1.5;
  const user = useAuthStore((state) => state.user);

  const [recentlyAdded, setRecentlyAdded] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<MediaItem[]>([]);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [libraryItems, setLibraryItems] = useState<Record<string, MediaItem[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHomeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHomeData = async () => {
    try {
      setError(null);
      // M-MOBILE-02 (review mobile__casualgamer #2): each rail's catch no
      // longer silently swallows — it RECORDS the failure so the blackout
      // law can fire. A fully unreachable server must surface the
      // connection-error view (with retry), not a cheerful empty
      // shelf-world; partial failure stays graceful by design.
      let recentFailed = false;
      let continueFailed = false;
      let librariesFailed = false;
      const [recent, continueList, libs] = await Promise.all([
        libraryManager.getRecentlyAdded(20).catch(() => {
          recentFailed = true;
          return [];
        }),
        user
          ? userManager.getContinueWatching().catch(() => {
              continueFailed = true;
              return [];
            })
          : Promise.resolve([]),
        libraryManager.getLibraries().catch(() => {
          librariesFailed = true;
          return [];
        }),
      ]);

      if (
        homeServerBlackout(
          {
            recentlyAdded: recentFailed,
            continueWatching: continueFailed,
            libraries: librariesFailed,
          },
          Boolean(user)
        )
      ) {
        setError(HOME_SERVER_BLACKOUT_MESSAGE);
        return; // `finally` still clears the spinner; ErrorView carries retry.
      }

      setRecentlyAdded(recent);
      setContinueWatching(continueList);
      setLibraries(libs);

      // Load items for each library (first page)
      const itemsPromises = libs.slice(0, 3).map(async (lib) => {
        try {
          const items = await libraryManager.getLibraryItems(lib.id, { limit: 10 });
          return { [lib.id]: items.items };
        } catch {
          return { [lib.id]: [] };
        }
      });

      const itemsResults = await Promise.all(itemsPromises);
      const itemsMap = itemsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setLibraryItems(itemsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load home data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHomeData();
    setIsRefreshing(false);
  };

  // M-MOBILE-17 (gameux M-F): a show started on the TV changes this screen's
  // rails; refetch on re-focus (gate skips mount-focus and fresh data, so
  // tab-hopping cannot stampede the server). Pull-to-refresh stays manual.
  useFocusRefetch(loadHomeData);

  const handleMediaPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  const handlePlayPress = (item: MediaItem) => {
    navigation.navigate('Player', { itemId: item.id });
  };

  const handleContinueWatchingPress = (item: MediaItem) => {
    // C17: `position_ticks` (100ns) is the ONLY resume field the server's
    // continue-watching rail emits — the `user_data.resume_position_ticks`
    // fallback this used to carry is a phantom the wire never sends.
    navigation.navigate('Player', {
      itemId: item.id,
      startPosition: ticksToSeconds(item.position_ticks ?? 0),
    });
  };

  if (isLoading) {
    // M-MOBILE-43 (review mobile__gameux m9): layout-shaped skeleton on the
    // cold load instead of a lone spinner in the void.
    return <GridSkeleton rows={3} />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={loadHomeData} />;
  }

  return (
    <SafeContainer>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.display_name || 'User'}</Text>
          <Text style={styles.subtitle}>What would you like to watch?</Text>
        </View>
        <TouchableOpacity
          style={styles.profilesButton}
          onPress={() => navigation.navigate('Profiles')}
          accessibilityLabel="Switch profile"
          accessibilityRole="button"
        >
          <Text style={styles.profilesButtonText} maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <ContinueWatching
            items={continueWatching}
            onItemPress={handleContinueWatchingPress}
            onItemPlay={handlePlayPress}
          />
        )}

        {/* Recently Added */}
        {recentlyAdded.length > 0 && (
          <MediaList
            title="Recently Added"
            items={recentlyAdded}
            onItemPress={handleMediaPress}
            cardWidth={posterWidth}
            cardHeight={posterHeight}
          />
        )}

        {/* Library Rows */}
        {libraries.slice(0, 3).map((library) => (
          <MediaList
            key={library.id}
            title={library.name}
            items={libraryItems[library.id] || []}
            onItemPress={handleMediaPress}
            cardWidth={posterWidth}
            cardHeight={posterHeight}
          />
        ))}

        {/* M-MOBILE-37 (review mobile__gameux): the day-one void gets
            guidance. The rails above render nothing when empty (that is the
            law of each section), so a fresh profile used to see ONLY the
            greeting. The predicate mirrors this render window (slice(0, 3))
            — pair law, see src/screens/homeEmptyState.ts. */}
        {homeShowsEmptyState(continueWatching, recentlyAdded, libraries, libraryItems) && (
          <EmptyState
            icon="🎬"
            title="Nothing here yet"
            message="When your server has media, your library and continue-watching rows appear here."
            actionLabel="Browse library"
            onAction={() => navigation.navigate('Library')}
          />
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  // M-MOBILE-38 (review mobile__gameux): 40pt sat below the platform's 44pt
  // touch minimum.
  profilesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilesButtonText: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  bottomPadding: {
    height: 100,
  },
});

export default HomeScreen;
