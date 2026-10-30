/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/media/PosterCard.tsx
import React from 'react';
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
  onPress: () => void;
  showTitle?: boolean;
}

export const PosterCard: React.FC<PosterCardProps> = ({
  item,
  width,
  height,
  onPress,
  showTitle = true,
}) => {
  // M-MOBILE-42: missing art is a LOCAL tile now — no third-party uri.
  const posterUri = firstUsableUri(item.poster_url);

  return (
    <TouchableOpacity
      style={[styles.container, { width, height: showTitle ? height + 30 : height }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {posterUri !== undefined ? (
        <Image
          source={{ uri: posterUri }}
          style={[styles.poster, { width, height }]}
          resizeMode="cover"
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

export default PosterCard;
