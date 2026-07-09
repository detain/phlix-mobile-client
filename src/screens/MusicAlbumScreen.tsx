/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/MusicAlbumScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import {
  useRoute,
  useNavigation,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { musicManager } from '../api/MusicManager';
import {
  normalizeAlbumTrack,
  sortTracks,
  type Album,
  type Track,
} from '../types/music';
import type { RootStackParamList } from '../types/navigation';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import {
  albumSubtitle,
  trackSubtitle,
  trackPositionLabel,
} from './music/musicScreenHelpers';

type AlbumNavigationProp = NativeStackNavigationProp<any>;

const MusicAlbumScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'MusicAlbum'>>();
  const navigation = useNavigation<AlbumNavigationProp>();
  const { albumName } = route.params;

  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await musicManager.getAlbum(albumName);
      setAlbum(fetched);
      // LANDMINE: album.tracks are RAW rows → normalize then order.
      setTracks(sortTracks(fetched.tracks.map(normalizeAlbumTrack)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load album');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumName]);

  const handleTrackPress = (track: Track) =>
    navigation.navigate('Player', { itemId: track.id });

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }
  if (error) {
    return <ErrorView message={error} onRetry={load} />;
  }
  if (!album) {
    return (
      <SafeContainer>
        <EmptyState icon="💿" title="Album Not Found" />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.albumName}>{album.name}</Text>
            <Text style={styles.albumMeta}>{albumSubtitle(album)}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => handleTrackPress(item)}
          >
            <Text style={styles.rowLeading}>{trackPositionLabel(item)}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              {trackSubtitle(item) !== '' && (
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {trackSubtitle(item)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="🎵"
            title="No Tracks"
            message="This album has no tracks."
          />
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  header: {
    marginBottom: 12,
  },
  albumName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  albumMeta: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rowLeading: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    width: 28,
    textAlign: 'center',
  },
  rowBody: {
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
    marginTop: 2,
  },
});

export default MusicAlbumScreen;
