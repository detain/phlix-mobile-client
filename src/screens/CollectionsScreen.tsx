// src/screens/CollectionsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCollectionStore } from '../stores/useCollectionStore';
import { libraryManager } from '../api/LibraryManager';
import type { Library } from '../types/media';
import type { Collection } from '../types/collection';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import {
  collectionSubtitle,
  validateCollectionInput,
} from './collections/collectionScreenHelpers';

const CollectionsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const collections = useCollectionStore((s) => s.collections);
  const loading = useCollectionStore((s) => s.collectionsLoading);
  const error = useCollectionStore((s) => s.collectionsError);
  const loadCollections = useCollectionStore((s) => s.loadCollections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCollections();
    setIsRefreshing(false);
  };

  const openCreate = async () => {
    setNewName('');
    setSelectedLibraryId(null);
    setShowCreate(true);
    try {
      const libs = await libraryManager.getLibraries();
      setLibraries(libs);
      if (libs.length === 1) {
        setSelectedLibraryId(libs[0].id);
      }
    } catch {
      setLibraries([]);
    }
  };

  const handleCreate = async () => {
    const validationError = validateCollectionInput(newName, selectedLibraryId);
    if (validationError) {
      Alert.alert('Error', validationError);
      return;
    }
    setCreating(true);
    try {
      await createCollection({
        name: newName.trim(),
        // selectedLibraryId is non-null here (validated above).
        library_id: selectedLibraryId as string,
      });
      setShowCreate(false);
    } catch (err) {
      Alert.alert(
        'Create Failed',
        err instanceof Error ? err.message : 'Failed to create collection'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (collection: Collection) => {
    Alert.alert(
      'Delete Collection',
      `Delete "${collection.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCollection(collection.id);
            } catch (err) {
              Alert.alert(
                'Delete Failed',
                err instanceof Error ? err.message : 'Failed to delete'
              );
            }
          },
        },
      ]
    );
  };

  const handleOpen = (collection: Collection) => {
    navigation.navigate('CollectionDetail', {
      collectionId: collection.id,
      title: collection.name,
    });
  };

  const renderItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => handleOpen(item)}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.is_smart ? '⚡ ' : ''}
          {item.name}
        </Text>
        <Text style={styles.rowSubtitle}>{collectionSubtitle(item)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (loading && collections.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && collections.length === 0) {
    return <ErrorView message={error} onRetry={loadCollections} />;
  }

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collections</Text>
        <TouchableOpacity style={styles.newButton} onPress={openCreate}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={collections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="🗂️"
              title="No Collections"
              message="Create a collection to group media items."
              actionLabel="New Collection"
              onAction={openCreate}
            />
          ) : null
        }
      />

      {/* Create Collection Modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>New Collection</Text>

            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.pickerLabel}>Library</Text>
            {libraries.length === 0 ? (
              <Text style={styles.pickerEmpty}>No libraries available</Text>
            ) : (
              <View style={styles.pickerList}>
                {libraries.map((lib) => (
                  <TouchableOpacity
                    key={lib.id}
                    style={[
                      styles.pickerOption,
                      selectedLibraryId === lib.id &&
                        styles.pickerOptionActive,
                    ]}
                    onPress={() => setSelectedLibraryId(lib.id)}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedLibraryId === lib.id &&
                          styles.pickerOptionTextActive,
                      ]}
                    >
                      {lib.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreate}
              disabled={creating}
            >
              <Text style={styles.submitButtonText}>
                {creating ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCreate(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  newButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  chevron: {
    color: '#888',
    fontSize: 22,
    marginLeft: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    color: '#fff',
    fontSize: 16,
  },
  pickerLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pickerEmpty: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  pickerList: {
    marginBottom: 16,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    marginBottom: 8,
  },
  pickerOptionActive: {
    backgroundColor: '#0066cc',
  },
  pickerOptionText: {
    color: '#ccc',
    fontSize: 15,
  },
  pickerOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
});

export default CollectionsScreen;
