// src/screens/PhotoViewerScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoManager } from '../api/PhotoManager';
import type { RootStackParamList } from '../types/navigation';
import type { Photo, PhotoExif } from '../types/photo';
import { formatExifSummary } from '../types/photo';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
import { clampIndex, nextSlideIndex } from './photos/photoScreenHelpers';

type PhotoViewerRouteProp = RouteProp<RootStackParamList, 'PhotoViewer'>;

const SLIDESHOW_DEFAULT_INTERVAL = 5;

const PhotoViewerScreen: React.FC = () => {
  const route = useRoute<PhotoViewerRouteProp>();
  const { albumId, libraryId, startIndex } = route.params;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [exif, setExif] = useState<Partial<PhotoExif> | null>(null);
  const [slideshowOn, setSlideshowOn] = useState(false);

  const listRef = useRef<FlatList<Photo>>(null);
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep refs of mutable values the interval reads, so the interval callback
  // never goes stale and we don't churn the timer.
  const indexRef = useRef(0);
  const lenRef = useRef(0);

  const stopSlideshow = useCallback(() => {
    if (slideTimer.current) {
      clearInterval(slideTimer.current);
      slideTimer.current = null;
    }
    setSlideshowOn(false);
  }, []);

  const loadAlbum = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const album = await photoManager.getAlbum(albumId, libraryId);
      const list = album.photos ?? [];
      setPhotos(list);
      lenRef.current = list.length;
      const start = clampIndex(startIndex ?? 0, list.length);
      setCurrentIndex(start);
      indexRef.current = start;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  }, [albumId, libraryId, startIndex]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  // Tear down the slideshow timer on unmount.
  useEffect(
    () => () => {
      if (slideTimer.current) {
        clearInterval(slideTimer.current);
        slideTimer.current = null;
      }
    },
    []
  );

  // Lazily fetch full EXIF for the focused photo whenever the info overlay is
  // open and the current photo changes.
  useEffect(() => {
    let cancelled = false;
    if (!showInfo) {
      return;
    }
    const photo = photos[currentIndex];
    if (!photo) {
      return;
    }
    // Reset to this photo's list metadata immediately (null if it has none) so
    // we never flash the PREVIOUS photo's EXIF while getPhoto is in flight,
    // then refine with the full detail.
    setExif(photo.metadata ?? null);
    photoManager
      .getPhoto(photo.id)
      .then((detail) => {
        if (!cancelled) {
          setExif(detail.exif ?? detail.metadata);
        }
      })
      .catch(() => {
        // Keep whatever list metadata we already have; EXIF is best-effort.
      });
    return () => {
      cancelled = true;
    };
  }, [showInfo, currentIndex, photos]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const safe = clampIndex(index, lenRef.current);
      listRef.current?.scrollToIndex({ index: safe, animated: true });
      setCurrentIndex(safe);
      indexRef.current = safe;
    },
    []
  );

  const handleToggleSlideshow = useCallback(async () => {
    if (slideshowOn) {
      stopSlideshow();
      return;
    }
    let interval = SLIDESHOW_DEFAULT_INTERVAL;
    try {
      const res = await photoManager.getSlideshow(libraryId, {
        albumId,
        interval: SLIDESHOW_DEFAULT_INTERVAL,
      });
      if (typeof res.interval === 'number' && res.interval > 0) {
        interval = res.interval;
      }
    } catch {
      // Fall back to the default interval; the album photos already loaded.
    }
    if (lenRef.current <= 1) {
      return;
    }
    setSlideshowOn(true);
    slideTimer.current = setInterval(() => {
      const next = nextSlideIndex(indexRef.current, lenRef.current);
      scrollToIndex(next);
    }, interval * 1000);
  }, [slideshowOn, stopSlideshow, libraryId, albumId, scrollToIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setCurrentIndex(first.index);
        indexRef.current = first.index;
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  const renderItem = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      activeOpacity={1}
      style={[styles.page, { width, height }]}
      onPress={() => setShowInfo((v) => !v)}
    >
      <Image
        source={{ uri: item.full_url }}
        style={[styles.image, { width, height }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );

  if (isLoading && photos.length === 0) {
    return (
      <View style={styles.black}>
        <LoadingSpinner fullScreen />
      </View>
    );
  }
  if (error && photos.length === 0) {
    return (
      <View style={styles.black}>
        <ErrorView message={error} onRetry={loadAlbum} />
      </View>
    );
  }
  if (photos.length === 0) {
    return (
      <View style={styles.black}>
        <EmptyState
          icon="🖼️"
          title="No Photos"
          message="This album has no photos."
        />
      </View>
    );
  }

  const exifLines = exif ? formatExifSummary(exif) : [];

  return (
    <View style={styles.black}>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={clampIndex(startIndex ?? 0, photos.length)}
        onScrollToIndexFailed={() => {
          // Retry on the next frame if layout wasn't ready.
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: clampIndex(startIndex ?? 0, photos.length),
              animated: false,
            });
          }, 50);
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Top bar: counter + slideshow toggle */}
      <View
        style={[styles.topBar, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <View style={styles.topBarRow} pointerEvents="box-none">
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          <TouchableOpacity
            style={styles.slideshowBtn}
            onPress={handleToggleSlideshow}
          >
            <Text style={styles.slideshowBtnText}>
              {slideshowOn ? '⏸ Stop' : '▶ Slideshow'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info overlay (toggled by tapping the image) */}
      {showInfo && (
        <View style={styles.infoOverlay} pointerEvents="none">
          <Text style={styles.infoTitle} numberOfLines={1}>
            {photos[currentIndex]?.name ?? ''}
          </Text>
          {exifLines.length > 0 ? (
            exifLines.map((line, i) => (
              <Text key={`${line}-${i}`} style={styles.infoLine}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.infoLine}>No EXIF metadata</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: {
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  counter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  slideshowBtn: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  slideshowBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 16,
    paddingBottom: 28,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoLine: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 2,
  },
});

export default PhotoViewerScreen;
