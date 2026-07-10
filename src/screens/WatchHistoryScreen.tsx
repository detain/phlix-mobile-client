/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/WatchHistoryScreen.tsx
//
// Watch history screen (P4-S6). A 2-col MediaCard grid of the user's recently
// watched items with pull-to-refresh and swipe-to-delete. Tap → MediaDetail.

import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Text,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWatchHistoryStore } from '../stores/useWatchHistoryStore';
import type { MediaItem } from '../types/media';
import { SafeContainer } from '../components/layout';
import { MediaCard } from '../components/media/MediaCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';

const WatchHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const items = useWatchHistoryStore((s) => s.items);
  const loading = useWatchHistoryStore((s) => s.loading);
  const error = useWatchHistoryStore((s) => s.error);
  const loadHistory = useWatchHistoryStore((s) => s.loadHistory);
  const deleteItem = useWatchHistoryStore((s) => s.deleteItem);
  const clearHistory = useWatchHistoryStore((s) => s.clearHistory);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  const handleItemPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  const handleDeleteItem = (item: MediaItem) => {
    Alert.alert(
      'Remove from History',
      `Remove "${item.name}" from your watch history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
            } catch {
              // Error is handled in store
            }
          },
        },
      ],
    );
  };

  const handleClearAll = () => {
    if (items.length === 0) {
      return;
    }
    Alert.alert(
      'Clear Watch History',
      'Remove all items from your watch history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistory();
            } catch {
              // Error is handled in store
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: MediaItem }) => (
    <Pressable
      onLongPress={() => handleDeleteItem(item)}
      delayLongPress={500}
    >
      <MediaCard
        item={item}
        onPress={() => handleItemPress(item)}
      />
    </Pressable>
  );

  if (loading && items.length === 0 && !isRefreshing) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && items.length === 0) {
    return <ErrorView message={error} onRetry={loadHistory} />;
  }

  return (
    <SafeContainer edges={['top']}>
      {items.length > 0 && (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
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
              icon="📺"
              title="No watch history"
              message="Your recently watched shows and movies will appear here."
            />
          ) : null
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
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

export default WatchHistoryScreen;