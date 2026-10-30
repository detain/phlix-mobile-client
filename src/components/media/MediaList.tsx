/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/media/MediaList.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { MediaItem } from '../../types/media';
import PosterCard from './PosterCard';

interface MediaListProps {
  title: string;
  items: MediaItem[];
  onItemPress: (item: MediaItem) => void;
  cardWidth?: number;
  cardHeight?: number;
  showViewAll?: boolean;
  onViewAllPress?: () => void;
}

export const MediaList: React.FC<MediaListProps> = ({
  title,
  items,
  onItemPress,
  cardWidth: cardWidthProp,
  cardHeight: cardHeightProp,
  showViewAll = false,
  onViewAllPress,
}) => {
  // M-MOBILE-39 (review mobile__gameux m5): the (SCREEN_WIDTH - 60) / 3
  // default is now derived from the LIVE window width (useWindowDimensions)
  // instead of a module-scope `Dimensions.get('window')` frozen at import.
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = cardWidthProp ?? (screenWidth - 60) / 3;
  const cardHeight = cardHeightProp ?? cardWidth * 1.5;
  const renderItem = ({ item }: { item: MediaItem }) => (
    <PosterCard
      item={item}
      width={cardWidth}
      height={cardHeight}
      onPress={() => onItemPress(item)}
      showTitle={true}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {showViewAll && (
          <TouchableOpacity onPress={onViewAllPress}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  viewAllText: {
    color: '#0066cc',
    fontSize: 14,
  },
  listContent: {
    paddingLeft: 20,
    paddingRight: 8,
  },
});

export default MediaList;
