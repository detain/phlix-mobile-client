/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/media/RecommendationCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import type { UserRecommendation } from '../../types/contracts';

interface Props {
  item: UserRecommendation;
  onPress: (id: string) => void;
}

const RecommendationCard: React.FC<Props> = ({ item, onPress }) => {
  const scorePercent = Math.round(item.score * 100);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item.id)}>
      <View style={styles.posterContainer}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.placeholder]} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.year && <Text style={styles.year}>{item.year}</Text>}
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>Because You Watched</Text>
          <Text style={styles.score}>{scorePercent}% match</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 12,
  },
  posterContainer: {
    width: 140,
    height: 210,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2d2d44',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#2d2d44',
  },
  info: {
    marginTop: 8,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  year: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#0066cc',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  score: {
    color: '#888',
    fontSize: 10,
    marginLeft: 6,
  },
});

export default RecommendationCard;
