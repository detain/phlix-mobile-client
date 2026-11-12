/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/LibraryScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { apiErrorMessage } from '../api/client';
import { MediaItem, Library } from '../types/media';
import { SafeContainer } from '../components/layout';
import { useFocusRefetch } from '../utils/useFocusRefetch';
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // A failed items page: its copy plus WHICH load failed (page 1 / refresh
  // vs a later page), so Retry re-runs exactly the request that failed.
  const [pageError, setPageError] = useState<{
    message: string;
    reset: boolean;
  } | null>(null);

  // MOB-7: FlatList fires onEndReached more than once per scroll gesture, and
  // React state (isLoadingItems) only flips on the NEXT render — so two
  // events in the same tick both passed the old state-based guard and fetched
  // the SAME offset twice (duplicate cards, then a skipped page). This ref is
  // the synchronous in-flight latch: set BEFORE the await, cleared in finally.
  const loadMoreInFlightRef = useRef(false);
  // Every reset (library switch, pull-to-refresh, focus refetch) opens a new
  // generation; a page that resolves under an older generation is dropped so
  // library A's page can never be appended to library B's grid.
  const itemsGenerationRef = useRef(0);

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
    if (!reset) {
      if (loadMoreInFlightRef.current) {
        return;
      }
      loadMoreInFlightRef.current = true; // latch BEFORE the await
    }
    const generation = reset
      ? ++itemsGenerationRef.current
      : itemsGenerationRef.current;

    try {
      if (reset) {
        setIsLoadingItems(true);
        setOffset(0);
      } else {
        setIsLoadingMore(true);
      }
      setPageError(null);

      const newOffset = reset ? 0 : offset;
      const response = await libraryManager.getLibraryItems(selectedLibrary.id, {
        limit: LIMIT,
        offset: newOffset,
      });

      if (generation !== itemsGenerationRef.current) {
        return; // superseded by a newer reset — never append a stale page
      }

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
      if (generation === itemsGenerationRef.current) {
        // MOB-7: a failed page used to vanish into console.error — the grid
        // just stopped growing. Surface it with an inline retry instead.
        setPageError({
          message: apiErrorMessage(
            err,
            reset ? 'Could not load this library' : 'Could not load more items'
          ),
          reset,
        });
      }
    } finally {
      if (reset) {
        if (generation === itemsGenerationRef.current) {
          setIsLoadingItems(false);
        }
      } else {
        loadMoreInFlightRef.current = false; // finally-clear, success or not
        setIsLoadingMore(false);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLibraryItems(true);
    setIsRefreshing(false);
  };

  // M-MOBILE-17: library membership (server-side adds) and new episodes both
  // land here on re-focus; items page-1 reset mirrors pull-to-refresh, and
  // neither loader re-shows the cold-start full-screen spinner.
  useFocusRefetch(() => {
    loadLibraries();
    return loadLibraryItems(true);
  });

  // onEndReached auto-pager. After a page failure it stays quiet (no retry
  // storm on every scroll nudge) — the footer's Retry is the explicit door.
  const handleLoadMore = () => {
    if (
      !isLoadingItems &&
      hasMore &&
      !pageError &&
      !loadMoreInFlightRef.current
    ) {
      loadLibraryItems(false);
    }
  };

  // Inline retry for a failed page: page-1/refresh failures re-run the reset
  // load, later pages re-request the page that failed (offset never advanced).
  const handleRetryItems = () => {
    loadLibraryItems(pageError?.reset ?? items.length === 0);
  };

  // M-MOBILE-69: stable handler so the memoized MediaCard can bail out.
  const handleMediaPress = useCallback(
    (item: MediaItem) => {
      navigation.navigate('MediaDetail', { itemId: item.id });
    },
    [navigation]
  );

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
      // M-MOBILE-68 (review mobile__crossfe Major 16): the name was speakable
      // but the ACTIVE state was color-only — tab semantics + selection state
      // so the screen reader can tell which library is on.
      accessibilityRole="tab"
      accessibilityState={{ selected: selectedLibrary?.id === item.id }}
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

  // M-MOBILE-69 (review mobile__crossfe Major 15): hoisted + unbound seam —
  // the 2-up grid rebuilds cells only when their own item/dimensions change.
  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <MediaCard item={item} onPressItem={handleMediaPress} />
    ),
    [handleMediaPress]
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
        // M-MOBILE-69 note: the review also asked for getItemType on this
        // 2-up grid; RN 0.85's Lists layer (FlatList.d.ts/VirtualizedList)
        // has no such prop any more (grep across Libraries/Lists: zero
        // hits) — passing it would be theater, so the memoized stable-prop
        // cards carry the re-render defense here instead.
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
          isLoadingItems || isLoadingMore ? (
            <LoadingSpinner size="small" />
          ) : pageError && items.length > 0 ? (
            <View style={styles.pageError}>
              <Text style={styles.pageErrorText}>{pageError.message}</Text>
              <TouchableOpacity
                style={styles.pageRetryButton}
                onPress={handleRetryItems}
                accessibilityRole="button"
                accessibilityLabel="Retry loading library items"
              >
                <Text style={styles.pageRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoadingItems ? null : pageError ? (
            <ErrorView message={pageError.message} onRetry={handleRetryItems} />
          ) : (
            <EmptyState
              icon="🎬"
              title="No Items"
              message="This library is empty."
            />
          )
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
  pageError: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  pageErrorText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  pageRetryButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0066cc',
    borderRadius: 8,
  },
  pageRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LibraryScreen;
