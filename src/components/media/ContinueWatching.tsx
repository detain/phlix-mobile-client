/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/media/ContinueWatching.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { MediaItem } from '../../types/media';
import { continueWatchingProgressPercent } from '../../utils/resumePositions';
import { firstUsableUri } from '../../utils/mediaFallback';
import { LocalPlaceholder } from '../ui/LocalPlaceholder';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../../utils/textScalePolicy';

interface ContinueWatchingProps {
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
  onItemPlay: (item: MediaItem) => void;
}

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({
  items,
  onItemPress,
  onItemPlay,
}) => {
  // M-MOBILE-39 (review mobile__gameux m5): full-bleed card geometry now
  // tracks the live window width (was a module-scope Dimensions snapshot).
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;
  const cardHeight = cardWidth * 0.56;
  const renderItem = ({ item }: { item: MediaItem }) => {
    // M-MOBILE-42: missing art is a LOCAL tile now — no third-party uri.
    const backdropUri = firstUsableUri(item.backdrop_url, item.poster_url);
    // C17 (review mobile__gameux): the rail row carries `position_ticks` /
    // `duration_ticks` (100ns ticks); there is NO server `progress_percent`
    // on the wire — the old read of that phantom pinned the bar at 0% forever.
    const progress = continueWatchingProgressPercent(item);

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        onPress={() => onItemPress(item)}
        activeOpacity={0.8}
      >
        {backdropUri !== undefined ? (
          <Image
            source={{ uri: backdropUri }}
            style={[styles.backdrop, { width: cardWidth, height: cardHeight }]}
            resizeMode="cover"
          />
        ) : (
          <LocalPlaceholder
            style={[styles.backdrop, { width: cardWidth, height: cardHeight }]}
          />
        )}
        <View style={styles.overlay}>
          <View style={styles.infoContainer}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.progressText}>
              {Math.round(progress)}% watched
            </Text>
          </View>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => onItemPlay(item)}
          >
            <Text style={styles.playButtonText} maxFontSizeMultiplier={TEXT_MAX_FONT_SIZE_MULTIPLIER}>▶</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Continue Watching</Text>
      </View>
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  card: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2d2d44',
  },
  backdrop: {
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  infoContainer: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0066cc',
  },
});

export default ContinueWatching;
