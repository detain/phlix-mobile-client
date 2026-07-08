/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/LibraryScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { libraryManager } from '../api/LibraryManager';
import { MediaItem, Library } from '../types/media';
import { SafeContainer } from '../components/layout';
import { MediaCard } from '../components/media/MediaCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';

type LibraryNavigationProp = NativeStackNavigationProp<any>;

const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<LibraryNavigationProp>();

  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const LIMIT = 20;

  useEffect(() => {
    loadLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLibrary) {
      loadLibraryItems(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLibrary]);

  const loadLibraries = async () => {
    try {
      setError(null);
      const libs = await libraryManager.getLibraries().catch(() => []);
      setLibraries(libs);
      // Auto-select the first BROWSABLE library — music + photo libs route to
      // their dedicated screens on tap and have no items grid (E9a/E9b).
      if (libs.length > 0 && !selectedLibrary) {
        const firstBrowsable = libs.find(
          (lib) => lib.type !== 'music' && lib.type !== 'photo'
        );
        if (firstBrowsable) {
          setSelectedLibrary(firstBrowsable);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load libraries');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLibraryItems = async (reset = false) => {
    if (!selectedLibrary) {
      return;
    }

    try {
      if (reset) {
        setIsLoadingItems(true);
        setOffset(0);
      } else {
        // continue with current offset
      }

      const newOffset = reset ? 0 : offset;
      const response = await libraryManager.getLibraryItems(selectedLibrary.id, {
        limit: LIMIT,
        offset: newOffset,
      });

      if (reset) {
        setItems(response.items);
      } else {
        setItems((prev) => [...prev, ...response.items]);
      }

      // The items endpoint returns no has_more/total; infer from page fullness.
      setHasMore(response.items.length === LIMIT);
      setOffset(newOffset + response.items.length);
    } catch (err) {
      console.error('Failed to load library items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLibraryItems(true);
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoadingItems && hasMore) {
      loadLibraryItems(false);
    }
  };

  const handleMediaPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  /**
   * Library tab tap. Music and photo libraries are NOT browsed as the items
   * grid — they have dedicated experiences (artists/albums/tracks for music
   * [E9a]; date albums → viewer for photos [E9b]), so route to those screens
   * instead of selecting the library. All other library kinds keep the existing
   * grid behavior unchanged.
   */
  const handleLibraryTabPress = (item: Library) => {
    if (item.type === 'music') {
      navigation.navigate('Music', { libraryId: item.id });
      return;
    }
    if (item.type === 'photo') {
      navigation.navigate('Photos', { libraryId: item.id });
      return;
    }
    setSelectedLibrary(item);
  };

  const renderLibraryTab = ({ item }: { item: Library }) => (
    <TouchableOpacity
      style={[
        styles.libraryTab,
        selectedLibrary?.id === item.id && styles.libraryTabActive,
      ]}
      onPress={() => handleLibraryTabPress(item)}
    >
      <Text
        style={[
          styles.libraryTabText,
          selectedLibrary?.id === item.id && styles.libraryTabTextActive,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: MediaItem }) => (
    <MediaCard item={item} onPress={() => handleMediaPress(item)} />
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && libraries.length === 0) {
    return <ErrorView message={error} onRetry={loadLibraries} />;
  }

  if (libraries.length === 0) {
    return (
      <SafeContainer>
        <EmptyState
          icon="📚"
          title="No Libraries"
          message="Your server doesn't have any libraries yet."
        />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      {/* Library Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          data={libraries}
          renderItem={renderLibraryTab}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {/* No browsable (non-music, non-photo) library is selected — e.g. a
          server whose only libraries are music/photos. The grid would
          misleadingly read "No Items", so point the user at the tabs instead. */}
      {!selectedLibrary ? (
        <EmptyState
          icon="🗂️"
          title="Select a Library"
          message="Tap a library above to browse its contents."
        />
      ) : (
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingItems ? <LoadingSpinner size="small" /> : null
        }
        ListEmptyComponent={
          !isLoadingItems ? (
            <EmptyState
              icon="🎬"
              title="No Items"
              message="This library is empty."
            />
          ) : null
        }
      />
      )}
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  tabsContent: {
    paddingHorizontal: 12,
  },
  libraryTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  libraryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066cc',
  },
  libraryTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  libraryTabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
});

export default LibraryScreen;
