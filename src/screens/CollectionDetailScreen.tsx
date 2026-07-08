/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/CollectionDetailScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  useRoute,
  useNavigation,
  RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCollectionStore } from '../stores/useCollectionStore';
import type { MediaItem } from '../types/media';
import type { RootStackParamList } from '../types/navigation';
import { SafeContainer } from '../components/layout';
import { MediaCard } from '../components/media/MediaCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import {
  isSmartCollection,
  canEditItems,
  collectionSubtitle,
} from './collections/collectionScreenHelpers';

const CollectionDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'CollectionDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { collectionId } = route.params;

  const collection = useCollectionStore((s) => s.currentCollection);
  const items = useCollectionStore((s) => s.currentItems);
  const loading = useCollectionStore((s) => s.currentLoading);
  const error = useCollectionStore((s) => s.currentError);
  const loadCollection = useCollectionStore((s) => s.loadCollection);
  const removeItem = useCollectionStore((s) => s.removeItem);
  const refresh = useCollectionStore((s) => s.refresh);

  useEffect(() => {
    loadCollection(collectionId);
  }, [collectionId, loadCollection]);

  const handleItemPress = (item: MediaItem) => {
    navigation.navigate('MediaDetail', { itemId: item.id });
  };

  const handleRemove = (item: MediaItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from this collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeItem(collectionId, item.id);
            } catch (err) {
              Alert.alert(
                'Remove Failed',
                err instanceof Error ? err.message : 'Failed to remove'
              );
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (!collection) {
      return;
    }
    try {
      await refresh(collectionId);
    } catch (err) {
      Alert.alert(
        'Refresh Failed',
        err instanceof Error ? err.message : 'Failed to refresh'
      );
    }
  };

  const editable = collection ? canEditItems(collection) : false;

  const renderItem = ({ item }: { item: MediaItem }) => (
    <View style={styles.cardWrap}>
      <MediaCard item={item} onPress={() => handleItemPress(item)} />
      {editable ? (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loading && !collection) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && !collection) {
    return (
      <ErrorView
        message={error}
        onRetry={() => loadCollection(collectionId)}
      />
    );
  }

  return (
    <SafeContainer edges={['top']}>
      {collection ? (
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.title} numberOfLines={2}>
              {isSmartCollection(collection) ? '⚡ ' : ''}
              {collection.name}
            </Text>
            <Text style={styles.subtitle}>
              {collectionSubtitle(collection, items.length)}
            </Text>
          </View>
          {isSmartCollection(collection) ? (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadCollection(collectionId)}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="🗂️"
              title="No Items"
              message={
                collection && isSmartCollection(collection)
                  ? 'This smart collection has no matching items yet.'
                  : 'This collection is empty.'
              }
            />
          ) : null
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerMain: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
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
  cardWrap: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CollectionDetailScreen;
