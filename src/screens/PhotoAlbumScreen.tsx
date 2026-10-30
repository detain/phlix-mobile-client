/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/PhotoAlbumScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { photoManager } from '../api/PhotoManager';
import type { RootStackParamList } from '../types/navigation';
import type { Photo } from '../types/photo';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import { LocalPlaceholder } from '../components/ui/LocalPlaceholder';
import { firstUsableUri } from '../utils/mediaFallback';
import { useFocusRefetch } from '../utils/useFocusRefetch';

type PhotoAlbumNavigationProp = NativeStackNavigationProp<any>;
type PhotoAlbumRouteProp = RouteProp<RootStackParamList, 'PhotoAlbum'>;

// M-MOBILE-42: the remote placeholder uri is gone — missing thumbs render
// the local tile (see utils/mediaFallback + components/ui/LocalPlaceholder).
const GRID_COLUMNS = 3;
const GRID_GAP = 2;

const PhotoAlbumScreen: React.FC = () => {
  const navigation = useNavigation<PhotoAlbumNavigationProp>();
  const route = useRoute<PhotoAlbumRouteProp>();
  const { albumId, libraryId } = route.params;
  const { width } = useWindowDimensions();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlbum = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const album = await photoManager.getAlbum(albumId, libraryId);
      setPhotos(album.photos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load album');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlbum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, libraryId]);

  // M-MOBILE-17: album photo sets change server-side (library rescans);
  // re-focus re-pulls — the full-screen guard is length-keyed, so the grid
  // never blanks during the background refresh.
  useFocusRefetch(loadAlbum);

  const handlePhotoPress = (index: number) => {
    // PhotoViewer re-fetches the album itself (by albumId+libraryId) — we only
    // pass the serializable start index, never the photo array.
    navigation.navigate('PhotoViewer', {
      libraryId,
      albumId,
      startIndex: index,
    });
  };

  const cellSize = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => {
    // M-MOBILE-42: missing thumb is a LOCAL tile now — no third-party uri.
    const thumbUri = firstUsableUri(item.thumbnail_url);
    return (
      <TouchableOpacity
        style={[styles.cell, { width: cellSize, height: cellSize }]}
        onPress={() => handlePhotoPress(index)}
      >
        {thumbUri !== undefined ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} />
        ) : (
          <LocalPlaceholder kind="photo" style={styles.thumb} />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading && photos.length === 0) {
    return <LoadingSpinner fullScreen />;
  }
  if (error && photos.length === 0) {
    return <ErrorView message={error} onRetry={loadAlbum} />;
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        renderItem={renderPhoto}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="🖼️"
              title="No Photos"
              message="This album has no photos."
            />
          ) : null
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  gridContent: {
    flexGrow: 1,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  cell: {
    backgroundColor: '#2d2d44',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoAlbumScreen;
