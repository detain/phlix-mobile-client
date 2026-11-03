/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/media/PosterCard.tsx
import React, { useState } from 'react';
import {
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MediaItem } from '../../types/media';
import { firstUsableUri } from '../../utils/mediaFallback';
import { LocalPlaceholder } from '../ui/LocalPlaceholder';

interface PosterCardProps {
  item: MediaItem;
  width: number;
  height: number;
  /** Bound per-cell (legacy call sites). */
  onPress?: () => void;
  /**
   * M-MOBILE-69 (review mobile__crossfe Major 15): the UNBOUND item handler.
   * Passing `onPressItem={onItemPress}` keeps the prop identity stable across
   * parent re-renders, which is what makes the React.memo below actually bite;
   * per-cell `() => onItemPress(item)` arrows silently defeat memoization.
   */
  onPressItem?: (item: MediaItem) => void;
  showTitle?: boolean;
}

const PosterCardInner: React.FC<PosterCardProps> = ({
  item,
  width,
  height,
  onPress,
  onPressItem,
  showTitle = true,
}) => {
  // M-MOBILE-42: missing art is a LOCAL tile now — no third-party uri.
  const posterUri = firstUsableUri(item.poster_url);
  const handlePress = () => (onPress ? onPress() : onPressItem?.(item));
  // M-MOBILE-74 (review mobile__casualgamer Minor 3): a DEAD url used to
  // render a silent grey void — the onError arm swaps to the same local
  // placeholder that covers absent art. Tracking the failed URI (not a
  // boolean) resets the fallback when the item's art moves.
  const [failedUri, setFailedUri] = useState<string | null>(null);

  return (
    <TouchableOpacity
      style={[styles.container, { width, height: showTitle ? height + 30 : height }]}
      onPress={handlePress}
      activeOpacity={0.8}
      // M-MOBILE-68 (review mobile__crossfe Major 16): with the caption off
      // there was nothing to hear; the poster art is decorative once the card
      // itself is labeled.
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      {posterUri !== undefined && failedUri !== posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={[styles.poster, { width, height }]}
          resizeMode="cover"
          // M-MOBILE-75 (review mobile__crossfe Minor 15): Android used to
          // fully decode server art and downscale in JS-side memory — resize
          // decodes at target size.
          resizeMethod="resize"
          onError={() => setFailedUri(posterUri ?? null)}
          accessible={false}
        />
      ) : (
        <LocalPlaceholder style={[styles.poster, { width, height }]} />
      )}
      {showTitle && (
        <Text style={styles.title} numberOfLines={2}>
          {item.name}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
  },
  poster: {
    borderRadius: 8,
    backgroundColor: '#2d2d44',
  },
  title: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});

// M-MOBILE-69: memo on the NAMED export too — rails that import
// { PosterCard } get the bail-out without changing their import.
export const PosterCard = React.memo(PosterCardInner);
export default PosterCard;
