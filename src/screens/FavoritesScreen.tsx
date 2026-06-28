// src/screens/FavoritesScreen.tsx
//
// Favorites list (slice E10 favorites). A 2-col MediaCard grid of the user's
// favorited items (store-backed, useFavoritesStore) with pull-to-refresh +
// load-more + an EmptyState. Tap → MediaDetail. Reached via Settings → Library
// → Favorites.

import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFavoritesStore } from '../stores/useFavoritesStore';
import type { MediaItem } from '../types/media';
import { SafeContainer } from '../components/layout';
import { MediaCard } from '../components/media/MediaCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';

const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const items = useFavoritesStore((s) => s.items);
  const loading = useFavoritesStore((s) => s.loading);
  const error = useFavoritesStore((s) => s.error);
  const hasMore = useFavoritesStore((s) => s.hasMore);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadFavorites(true);
  }, [loadFavorites]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadFavorites(true);
    setIsRefreshing(false);
  };

  const handleEndReached = () => {
    if (!loading && hasMore && items.length > 0) {
      loadFavorites(false);
    }
  };

  const handleItemPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  const renderItem = ({ item }: { item: MediaItem }) => (
    <MediaCard item={item} onPress={() => handleItemPress(item)} />
  );

  if (loading && items.length === 0 && !isRefreshing) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && items.length === 0) {
    return <ErrorView message={error} onRetry={() => loadFavorites(true)} />;
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <View style={styles.footer}>
              <LoadingSpinner />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="♥"
              title="No favorites yet"
              message="Mark movies and shows as favorites to find them here."
            />
          ) : null
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    padding: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  footer: {
    paddingVertical: 16,
  },
});

export default FavoritesScreen;
