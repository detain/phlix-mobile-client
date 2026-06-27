// src/screens/MusicScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMusicStore } from '../stores/useMusicStore';
import { musicManager } from '../api/MusicManager';
import type { Artist, Album, Track } from '../types/music';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import {
  MUSIC_SEGMENTS,
  type MusicSegment,
  albumsForArtist,
  artistSubtitle,
  albumSubtitle,
  trackSubtitle,
} from './music/musicScreenHelpers';

type MusicNavigationProp = NativeStackNavigationProp<any>;

const TRACK_PAGE = 50;

const MusicScreen: React.FC = () => {
  const navigation = useNavigation<MusicNavigationProp>();

  const [segment, setSegment] = useState<MusicSegment>('artists');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);

  // Tracks paging (load-more) is screen-local; lists for artists/albums come
  // from the store.
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksTotal, setTracksTotal] = useState(0);
  const [tracksOffset, setTracksOffset] = useState(0);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);

  const artists = useMusicStore((s) => s.artists);
  const artistsLoading = useMusicStore((s) => s.artistsLoading);
  const artistsError = useMusicStore((s) => s.artistsError);
  const loadArtists = useMusicStore((s) => s.loadArtists);

  const albums = useMusicStore((s) => s.albums);
  const albumsLoading = useMusicStore((s) => s.albumsLoading);
  const albumsError = useMusicStore((s) => s.albumsError);
  const loadAlbums = useMusicStore((s) => s.loadAlbums);

  useEffect(() => {
    loadArtists();
    loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTracks = async (reset: boolean) => {
    if (tracksLoading) {
      return;
    }
    setTracksLoading(true);
    setTracksError(null);
    try {
      const offset = reset ? 0 : tracksOffset;
      const res = await musicManager.getTracks({ limit: TRACK_PAGE, offset });
      setTracks((prev) => (reset ? res.tracks : [...prev, ...res.tracks]));
      setTracksTotal(res.total);
      setTracksOffset(offset + res.tracks.length);
    } catch (err) {
      setTracksError(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      setTracksLoading(false);
    }
  };

  // Lazily load the first page of tracks the first time the tab opens.
  useEffect(() => {
    if (segment === 'tracks' && tracks.length === 0 && !tracksLoading) {
      loadTracks(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  const handleArtistPress = (artist: Artist) => setSelectedArtist(artist);

  const handleAlbumPress = (album: Album) =>
    navigation.navigate('MusicAlbum', { albumName: album.name });

  const handleTrackPress = (track: Track) =>
    navigation.navigate('Player', { itemId: track.id });

  const handleLoadMoreTracks = () => {
    if (!tracksLoading && tracks.length < tracksTotal) {
      loadTracks(false);
    }
  };

  const renderSegments = () => (
    <View style={styles.segmentRow}>
      {MUSIC_SEGMENTS.map((seg) => {
        const active = segment === seg.key;
        return (
          <TouchableOpacity
            key={seg.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              setSegment(seg.key);
              setSelectedArtist(null);
            }}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderRow = (
    title: string,
    subtitle: string,
    onPress: () => void,
    leading?: string,
    key?: string
  ) => (
    <TouchableOpacity key={key} style={styles.row} onPress={onPress}>
      {leading !== undefined && <Text style={styles.rowLeading}>{leading}</Text>}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== '' && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderArtistsTab = () => {
    if (selectedArtist) {
      const artistAlbums = albumsForArtist(albums, selectedArtist.name);
      return (
        <View style={styles.flex}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => setSelectedArtist(null)}
          >
            <Text style={styles.backText}>‹ All artists</Text>
          </TouchableOpacity>
          <Text style={styles.sectionHeader}>{selectedArtist.name}</Text>
          <FlatList
            data={artistAlbums}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) =>
              renderRow(item.name, albumSubtitle(item), () =>
                handleAlbumPress(item)
              )
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="💿"
                title="No Albums"
                message="No albums found for this artist."
              />
            }
          />
        </View>
      );
    }

    if (artistsLoading && artists.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (artistsError && artists.length === 0) {
      return <ErrorView message={artistsError} onRetry={loadArtists} />;
    }
    return (
      <FlatList
        data={artists}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) =>
          renderRow(item.name, artistSubtitle(item), () =>
            handleArtistPress(item)
          )
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !artistsLoading ? (
            <EmptyState
              icon="🎤"
              title="No Artists"
              message="No music artists found."
            />
          ) : null
        }
      />
    );
  };

  const renderAlbumsTab = () => {
    if (albumsLoading && albums.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (albumsError && albums.length === 0) {
      return <ErrorView message={albumsError} onRetry={loadAlbums} />;
    }
    return (
      <FlatList
        data={albums}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) =>
          renderRow(item.name, albumSubtitle(item), () =>
            handleAlbumPress(item)
          )
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !albumsLoading ? (
            <EmptyState
              icon="💿"
              title="No Albums"
              message="No albums found."
            />
          ) : null
        }
      />
    );
  };

  const renderTracksTab = () => {
    if (tracksLoading && tracks.length === 0) {
      return <LoadingSpinner fullScreen />;
    }
    if (tracksError && tracks.length === 0) {
      return <ErrorView message={tracksError} onRetry={() => loadTracks(true)} />;
    }
    return (
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          renderRow(item.name, trackSubtitle(item), () =>
            handleTrackPress(item)
          )
        }
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMoreTracks}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          tracksLoading && tracks.length > 0 ? (
            <LoadingSpinner size="small" />
          ) : null
        }
        ListEmptyComponent={
          !tracksLoading ? (
            <EmptyState
              icon="🎵"
              title="No Tracks"
              message="No tracks found."
            />
          ) : null
        }
      />
    );
  };

  return (
    <SafeContainer edges={['top']}>
      {renderSegments()}
      {segment === 'artists' && renderArtistsTab()}
      {segment === 'albums' && renderAlbumsTab()}
      {segment === 'tracks' && renderTracksTab()}
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066cc',
  },
  segmentText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
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
  backRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backText: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
});

export default MusicScreen;
