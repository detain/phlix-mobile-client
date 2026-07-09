/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/MediaDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import type { MediaRatings } from '@phlix/contracts';
import { libraryManager } from '../api/LibraryManager';
import { favoritesManager } from '../api/FavoritesManager';
import { markerManager } from '../api/MarkerManager';
import { MediaItem, Season, Episode } from '../types/media';
import type { Chapter } from '../types/playback';
import {
  starsFromRating,
  ratingForStar,
  isClearTap,
  nextFavoriteState,
  STAR_COUNT,
} from './favorites/favoritesHelpers';
import { PosterCard } from '../components/media/PosterCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { CastButton } from '../components/cast';
import { RatingBadgeFromMediaRatings } from '../components/RatingBadge';
import { UserRatingPicker } from '../components/UserRatingPicker';
import { downloadService } from '../services/DownloadService';
import type { DownloadTask } from '../store/downloadStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DetailRouteParams = {
  MediaDetail: { itemId: string };
};

type DetailNavigationProp = NativeStackNavigationProp<any>;

const MediaDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<DetailRouteParams, 'MediaDetail'>>();
  const navigation = useNavigation<DetailNavigationProp>();
  const { itemId } = route.params;

  const [item, setItem] = useState<MediaItem | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // E4: live download state for this item (undefined = not downloading/downloaded).
  const [downloadTask, setDownloadTask] = useState<DownloadTask | undefined>(undefined);
  // E10 favorites: optimistic local state for THIS item's favorite/rating,
  // seeded from `item.user_data` once loaded. `userDataPresent` gates the whole
  // control — `user_data` is null when unauthenticated (no favorites for guests).
  const [userDataPresent, setUserDataPresent] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  // Guards against firing a second mutation while one is in flight.
  const [favBusy, setFavBusy] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  // P1-S8: aggregate ratings from GET /api/v1/media/{id}/ratings
  const [mediaRatings, setMediaRatings] = useState<MediaRatings | null>(null);
  // P2-S5: chapter markers from getPlaybackInfo()
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    loadMediaDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // E4: subscribe to download-service updates and reflect this item's task
  // (any non-cancelled state — queued/downloading/paused/failed/completed).
  useEffect(() => {
    const sync = () => {
      const task = downloadService
        .getAllDownloads()
        .filter((t) => t.itemId === itemId && t.status !== 'cancelled')
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      setDownloadTask(task);
    };
    sync();
    const unsubscribe = downloadService.subscribe(() => sync());
    return unsubscribe;
  }, [itemId]);

  useEffect(() => {
    if (selectedSeason) {
      loadEpisodes(selectedSeason.id);
    }
  }, [selectedSeason]);

  // P2-S5: load chapter markers for playable items (movies/episodes).
  useEffect(() => {
    const loadChapters = async () => {
      try {
        const info = await markerManager.getPlaybackInfo(itemId);
        setChapters(info.chapters ?? []);
      } catch {
        // Chapters are non-critical — silently ignore fetch failures.
        setChapters([]);
      }
    };
    loadChapters();
  }, [itemId]);

  const loadMediaDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const mediaItem = await libraryManager.getMediaItem(itemId);
      setItem(mediaItem);

      // E10 favorites: seed optimistic local state from the server's user_data
      // (null when unauthenticated → controls hidden).
      const ud = mediaItem.user_data;
      setUserDataPresent(Boolean(ud));
      setIsFavorite(Boolean(ud?.favorite));
      setRating(ud?.rating ?? null);

      // P1-S8: fetch aggregate ratings (non-critical, silently fail)
      try {
        const ratings = await favoritesManager.getMediaRatings(itemId);
        setMediaRatings(ratings);
      } catch {
        // Ratings unavailable
      }

      if (mediaItem.type === 'series') {
        try {
          const seasonList = await libraryManager.getSeasons(itemId);
          setSeasons(seasonList);
          if (seasonList.length > 0) {
            setSelectedSeason(seasonList[0]);
          }
        } catch {
          // Seasons not available
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEpisodes = async (seasonId: string) => {
    try {
      const episodeList = await libraryManager.getEpisodes(seasonId);
      setEpisodes(episodeList);
    } catch {
      setEpisodes([]);
    }
  };

  const handlePlay = () => {
    navigation.navigate('Player', { itemId, startPosition: 0 });
  };

  const handleResume = () => {
    const resumePosition = item?.user_data?.resume_position_ticks
      ? item.user_data.resume_position_ticks / 10000000
      : 0;
    navigation.navigate('Player', { itemId, startPosition: resumePosition });
  };

  const handleEpisodePress = (episode: Episode) => {
    navigation.navigate('Player', {
      itemId: episode.id,
      startPosition: episode.user_data?.resume_position_ticks
        ? episode.user_data.resume_position_ticks / 10000000
        : 0,
    });
  };

  // P2-S5: tap a chapter to seek to that position in the player.
  const handleChapterPress = (chapter: Chapter) => {
    navigation.navigate('Player', {
      itemId,
      startPosition: chapter.start_seconds,
    });
  };

  // E4: start a download for this item (movies/episodes — playable leaf types).
  const handleDownload = () => {
    if (!item) {
      return;
    }
    // eslint-disable-next-line no-void -- intentional fire-and-forget
    void downloadService.startDownload(item);
  };

  // E4: delete a completed download (frees local storage).
  const handleDeleteDownload = () => {
    if (downloadTask) {
      // eslint-disable-next-line no-void -- intentional fire-and-forget
      void downloadService.deleteDownload(downloadTask.id);
    }
  };

  // E4: retry a failed download.
  const handleRetryDownload = () => {
    if (downloadTask) {
      downloadService.retryDownload(downloadTask.id);
    }
  };

  const handleDownloadPress = () => {
    if (!downloadTask) {
      handleDownload();
      return;
    }
    switch (downloadTask.status) {
      case 'completed':
        handleDeleteDownload();
        break;
      case 'failed':
        handleRetryDownload();
        break;
      default:
        // queued / downloading / paused — no-op tap (managed from Downloads tab).
        break;
    }
  };

  // E10 favorites: optimistic toggle with revert-on-error.
  const handleToggleFavorite = async () => {
    if (favBusy) {
      return;
    }
    const previous = isFavorite;
    const next = nextFavoriteState(previous);
    setIsFavorite(next);
    setFavBusy(true);
    try {
      if (next) {
        await favoritesManager.setFavorite(itemId);
      } else {
        await favoritesManager.removeFavorite(itemId);
      }
    } catch (err) {
      setIsFavorite(previous); // revert
      Alert.alert(
        'Favorite Failed',
        err instanceof Error ? err.message : 'Could not update favorite'
      );
    } finally {
      setFavBusy(false);
    }
  };

  // E10 favorites: tapping star N sets rating to N×2 (1–10); re-tapping the
  // current rating clears it. Optimistic with revert-on-error.
  const handleStarPress = async (starIndex: number) => {
    if (rateBusy) {
      return;
    }
    const value = ratingForStar(starIndex);
    const clearing = isClearTap(value, rating);
    const previous = rating;
    setRating(clearing ? null : value);
    setRateBusy(true);
    try {
      if (clearing) {
        await favoritesManager.clearRating(itemId);
      } else {
        await favoritesManager.setRating(itemId, value);
      }
    } catch (err) {
      setRating(previous); // revert
      Alert.alert(
        'Rating Failed',
        err instanceof Error ? err.message : 'Could not update rating'
      );
    } finally {
      setRateBusy(false);
    }
  };

  const downloadButtonLabel = (): string => {
    if (!downloadTask) {
      return 'Download';
    }
    switch (downloadTask.status) {
      case 'completed':
        return 'Downloaded ✓';
      case 'downloading':
        return `Downloading ${Math.round(downloadTask.progress * 100)}%`;
      case 'queued':
        return 'Queued…';
      case 'paused':
        return 'Paused';
      case 'failed':
        return 'Retry download';
      default:
        return 'Download';
    }
  };

  // Server `runtime` is in MINUTES (TMDB metadata). The precise media length in
  // seconds is the separate `duration` field (used by the player scrubber).
  const formatRuntime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error || !item) {
    return <ErrorView message={error || 'Media not found'} onRetry={loadMediaDetails} />;
  }

  const isSeries = item.type === 'series';
  const hasResumePosition = Boolean(item.user_data?.resume_position_ticks && item.user_data.resume_position_ticks > 0);
  const stars = starsFromRating(rating);
  const backdropUri = item.backdrop_url || item.poster_url || 'https://via.placeholder.com/640x360';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} bounces={false}>
        {/* Backdrop with Gradient */}
        <View style={styles.backdropContainer}>
          <Image
            source={{ uri: backdropUri }}
            style={styles.backdrop}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', '#0f0f1a']}
            style={styles.backdropGradient}
          />
        </View>

        {/* Poster and Info */}
        <View style={styles.infoContainer}>
          <PosterCard
            item={item}
            width={SCREEN_WIDTH * 0.35}
            height={SCREEN_WIDTH * 0.35 * 1.5}
            onPress={() => {}}
          />

          <View style={styles.infoContent}>
            <Text style={styles.title}>{item.name}</Text>

            <View style={styles.metaRow}>
              {item.year && <Text style={styles.year}>{item.year}</Text>}
              {item.rating && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.rating}>{item.rating}</Text>
                </>
              )}
              {/* P1-S8: aggregate rating badge (e.g., TMDB/IMDb average) */}
              {mediaRatings?.aggregateScore != null && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <RatingBadgeFromMediaRatings ratings={mediaRatings} size="small" />
                </>
              )}
              {item.runtime && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.runtime}>{formatRuntime(item.runtime)}</Text>
                </>
              )}
            </View>

            {/* E10 favorites: favorite toggle + 1–10 star rating. Shown only
                when authenticated (server sends user_data; null for guests). */}
            {userDataPresent && (
              <View style={styles.favoriteRow}>
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={handleToggleFavorite}
                  disabled={favBusy}
                  accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
                  accessibilityState={{ selected: isFavorite }}
                >
                  <Text
                    style={[
                      styles.favoriteIcon,
                      isFavorite && styles.favoriteIconActive,
                    ]}
                  >
                    {isFavorite ? '♥' : '♡'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.starsRow}>
                  {stars.map((fill, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.starButton}
                      onPress={() => handleStarPress(idx + 1)}
                      disabled={rateBusy}
                      accessibilityLabel={`Rate ${ratingForStar(idx + 1)} out of ${STAR_COUNT * 2}`}
                    >
                      <Text
                        style={[
                          styles.star,
                          fill !== 'empty' && styles.starActive,
                        ]}
                      >
                        {fill === 'full' ? '★' : fill === 'half' ? '⯨' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {rating != null && (
                    <Text style={styles.ratingValue}>{rating}/10</Text>
                  )}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.playButton, styles.playButtonPrimary]}
              onPress={hasResumePosition ? handleResume : handlePlay}
            >
              <Text style={styles.playButtonIcon}>▶</Text>
              <Text style={styles.playButtonText}>
                {hasResumePosition ? 'Resume' : 'Play'}
              </Text>
            </TouchableOpacity>

            {/* E7: Cast — server-mediated; needs the signed stream URL + id. */}
            {!isSeries && item.stream_url ? (
              <CastButton
                mediaItemId={item.id}
                streamUrl={item.stream_url}
                title={item.name}
                thumbnail={item.poster_url}
                durationSecs={item.duration}
              />
            ) : null}

            {/* E4: Download action — playable leaf types only (not series containers) */}
            {!isSeries && (
              <TouchableOpacity
                style={[
                  styles.playButton,
                  downloadTask?.status === 'completed' && styles.downloadButtonDone,
                  downloadTask?.status === 'failed' && styles.downloadButtonFailed,
                ]}
                onPress={handleDownloadPress}
                accessibilityLabel="Download"
              >
                <Text style={styles.playButtonIcon}>
                  {downloadTask?.status === 'completed' ? '🗑' : '↓'}
                </Text>
                <Text style={styles.playButtonText}>{downloadButtonLabel()}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Overview */}
        {item.overview && (
          <View style={styles.section}>
            <Text style={styles.overview}>{item.overview}</Text>
          </View>
        )}

        {/* P1-S8: User rating picker - interactive rating below description.
            Shown only when authenticated (user_data present). */}
        {userDataPresent && (
          <View style={styles.ratingPickerSection}>
            <Text style={styles.sectionLabel}>Your Rating</Text>
            <UserRatingPicker
              itemId={itemId}
              initialRating={rating}
              onRatingChange={setRating}
            />
          </View>
        )}

        {/* Genres */}
        {item.genres && item.genres.length > 0 && (
          <View style={styles.genres}>
            {item.genres.map((genre) => (
              <View key={genre} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {/* P2-S5: Chapter markers - shown for playable items with chapters. */}
        {chapters.length > 0 && !isSeries && (
          <View style={styles.chaptersSection}>
            <Text style={styles.sectionLabel}>Chapters</Text>
            {chapters.map((chapter, index) => {
              const totalSeconds = Math.floor(chapter.start_seconds);
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              const timeStr = h > 0
                ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                : `${m}:${s.toString().padStart(2, '0')}`;
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.chapterItem}
                  onPress={() => handleChapterPress(chapter)}
                  accessibilityLabel={`Chapter ${index + 1}: ${chapter.title || 'Untitled'} at ${timeStr}`}
                >
                  <Text style={styles.chapterTime}>{timeStr}</Text>
                  <Text style={styles.chapterTitle} numberOfLines={1}>
                    {chapter.title || `Chapter ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Series Sections */}
        {isSeries && seasons.length > 0 && (
          <>
            <View style={styles.seasonSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {seasons.map((season) => (
                  <TouchableOpacity
                    key={season.id}
                    style={[
                      styles.seasonTab,
                      selectedSeason?.id === season.id && styles.seasonTabActive,
                    ]}
                    onPress={() => setSelectedSeason(season)}
                  >
                    <Text
                      style={[
                        styles.seasonTabText,
                        selectedSeason?.id === season.id && styles.seasonTabTextActive,
                      ]}
                    >
                      {season.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.episodesList}>
              {episodes.map((episode) => (
                <TouchableOpacity
                  key={episode.id}
                  style={styles.episodeCard}
                  onPress={() => handleEpisodePress(episode)}
                >
                  <View style={styles.episodeNumber}>
                    <Text style={styles.episodeNumberText}>{episode.episode_number}</Text>
                  </View>
                  <View style={styles.episodeInfo}>
                    <Text style={styles.episodeName} numberOfLines={1}>
                      {episode.name}
                    </Text>
                    {episode.runtime && (
                      <Text style={styles.episodeRuntime}>
                        {formatRuntime(episode.runtime)}
                      </Text>
                    )}
                    {episode.overview && (
                      <Text style={styles.episodeOverview} numberOfLines={2}>
                        {episode.overview}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollView: {
    flex: 1,
  },
  backdropContainer: {
    height: 300,
    position: 'relative',
  },
  backdrop: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  backdropGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  infoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -100,
    position: 'relative',
    zIndex: 1,
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
    paddingTop: 80,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  year: {
    color: '#aaa',
    fontSize: 14,
  },
  dot: {
    color: '#aaa',
    marginHorizontal: 6,
  },
  rating: {
    color: '#aaa',
    fontSize: 14,
  },
  runtime: {
    color: '#aaa',
    fontSize: 14,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  favoriteButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  favoriteIcon: {
    fontSize: 26,
    color: '#888',
  },
  favoriteIconActive: {
    color: '#e0245e',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  star: {
    fontSize: 22,
    color: '#555',
  },
  starActive: {
    color: '#ffc107',
  },
  ratingValue: {
    color: '#ffc107',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#2d2d44',
  },
  playButtonPrimary: {
    backgroundColor: '#0066cc',
  },
  downloadButtonDone: {
    backgroundColor: '#1a3d1a',
  },
  downloadButtonFailed: {
    backgroundColor: '#5a1a1a',
  },
  playButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  overview: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  // P1-S8: user rating picker section
  ratingPickerSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 15,
    gap: 8,
  },
  genreTag: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    color: '#aaa',
    fontSize: 12,
  },
  seasonSelector: {
    marginTop: 30,
    paddingLeft: 20,
  },
  seasonTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
  },
  seasonTabActive: {
    backgroundColor: '#0066cc',
  },
  seasonTabText: {
    color: '#888',
    fontSize: 14,
  },
  seasonTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  episodesList: {
    paddingHorizontal: 20,
    marginTop: 15,
  },
  episodeCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  episodeNumber: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  episodeRuntime: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  episodeOverview: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  // P2-S5: chapter list styles
  chaptersSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  chapterTime: {
    color: '#888',
    fontSize: 13,
    width: 60,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chapterTitle: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  bottomPadding: {
    height: 100,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
});

export default MediaDetailScreen;
