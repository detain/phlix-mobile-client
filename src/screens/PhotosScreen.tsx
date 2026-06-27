// src/screens/PhotosScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePhotoStore } from '../stores/usePhotoStore';
import type { RootStackParamList } from '../types/navigation';
import type { Library } from '../types/media';
import type { PhotoAlbum } from '../types/photo';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import {
  albumGridTitle,
  photoCountLabel,
} from './photos/photoScreenHelpers';

type PhotosNavigationProp = NativeStackNavigationProp<any>;
type PhotosRouteProp = RouteProp<RootStackParamList, 'Photos'>;

const PLACEHOLDER = 'https://via.placeholder.com/300x300?text=Photo';
const GRID_COLUMNS = 2;
const GRID_GAP = 12;

const PhotosScreen: React.FC = () => {
  const navigation = useNavigation<PhotosNavigationProp>();
  const route = useRoute<PhotosRouteProp>();
  const paramLibraryId = route.params?.libraryId;
  const { width } = useWindowDimensions();

  const photoLibraries = usePhotoStore((s) => s.photoLibraries);
  const librariesLoading = usePhotoStore((s) => s.librariesLoading);
  const librariesError = usePhotoStore((s) => s.librariesError);
  const selectedLibraryId = usePhotoStore((s) => s.selectedLibraryId);
  const setSelectedLibraryId = usePhotoStore((s) => s.setSelectedLibraryId);
  const loadPhotoLibraries = usePhotoStore((s) => s.loadPhotoLibraries);

  const albums = usePhotoStore((s) => s.albums);
  const albumsLoading = usePhotoStore((s) => s.albumsLoading);
  const albumsError = usePhotoStore((s) => s.albumsError);
  const loadAlbums = usePhotoStore((s) => s.loadAlbums);

  // The library actually in use: route param wins, else the store selection.
  const [chosenId, setChosenId] = useState<string | null>(
    paramLibraryId ?? null
  );

  // If a libraryId arrived via params, use it; otherwise discover libraries.
  useEffect(() => {
    if (paramLibraryId) {
      setChosenId(paramLibraryId);
      return;
    }
    loadPhotoLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramLibraryId]);

  // When no param and the store auto-selected (single library), adopt it.
  useEffect(() => {
    if (!paramLibraryId && selectedLibraryId) {
      setChosenId(selectedLibraryId);
    }
  }, [paramLibraryId, selectedLibraryId]);

  // Load albums whenever the chosen library changes.
  useEffect(() => {
    if (chosenId) {
      loadAlbums(chosenId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenId]);

  const handlePickLibrary = (lib: Library) => {
    setSelectedLibraryId(lib.id);
    setChosenId(lib.id);
  };

  const handleAlbumPress = (album: PhotoAlbum) => {
    if (!chosenId) {
      return;
    }
    navigation.navigate('PhotoAlbum', {
      albumId: album.id,
      libraryId: chosenId,
      title: albumGridTitle(album),
    });
  };

  // ── No library chosen yet → library discovery UI ────────────────────────
  if (!chosenId) {
    if (librariesLoading && photoLibraries.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (librariesError && photoLibraries.length === 0) {
      return (
        <ErrorView message={librariesError} onRetry={loadPhotoLibraries} />
      );
    }
    if (photoLibraries.length === 0) {
      return (
        <SafeContainer edges={['top']}>
          <EmptyState
            icon="🖼️"
            title="No Photo Libraries"
            message="Your server doesn't have any photo libraries yet."
          />
        </SafeContainer>
      );
    }
    // Multiple libraries → picker.
    return (
      <SafeContainer edges={['top']}>
        <Text style={styles.pickerHeader}>Choose a photo library</Text>
        <FlatList
          data={photoLibraries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.pickerContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pickerRow}
              onPress={() => handlePickLibrary(item)}
            >
              <Text style={styles.pickerRowText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeContainer>
    );
  }

  // ── Album grid ──────────────────────────────────────────────────────────
  const cellWidth =
    (width - GRID_GAP * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

  const renderAlbum = ({ item }: { item: PhotoAlbum }) => {
    const cover = item.cover_photo?.thumbnail_url ?? PLACEHOLDER;
    return (
      <TouchableOpacity
        style={[styles.albumCell, { width: cellWidth }]}
        onPress={() => handleAlbumPress(item)}
      >
        <Image
          source={{ uri: cover }}
          style={[styles.albumCover, { width: cellWidth, height: cellWidth }]}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{photoCountLabel(item)}</Text>
        </View>
        <Text style={styles.albumTitle} numberOfLines={1}>
          {albumGridTitle(item)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (albumsLoading && albums.length === 0) {
    return <LoadingSpinner fullScreen />;
  }
  if (albumsError && albums.length === 0) {
    return (
      <ErrorView
        message={albumsError}
        onRetry={() => chosenId && loadAlbums(chosenId)}
      />
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        renderItem={renderAlbum}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          !albumsLoading ? (
            <EmptyState
              icon="🖼️"
              title="No Albums"
              message="No photos found in this library."
            />
          ) : null
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  pickerHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerContent: {
    padding: 16,
    flexGrow: 1,
  },
  pickerRow: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  pickerRowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  gridContent: {
    padding: GRID_GAP,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  albumCell: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  albumCover: {
    borderRadius: 8,
    backgroundColor: '#2d2d44',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  albumTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});

export default PhotosScreen;
