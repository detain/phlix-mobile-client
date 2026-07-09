/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/RatingBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MediaRatings } from '@phlix/contracts';

export interface RatingBadgeProps {
  /** Aggregate score from MediaRatings (0-10 scale), or null if no ratings */
  score: number | null;
  /** Optional size variant - small for inline, large for headers */
  size?: 'small' | 'large';
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * Convert a 0-10 score to an array of 5 star fill states with half-star precision.
 * e.g., 7.5 → [full, full, full, half, empty] (3.75 stars filled)
 */
const scoreToStars = (score: number): Array<'full' | 'half' | 'empty'> => {
  // Each star is worth 2 points on the 0-10 scale
  const filledStars = score / 2;
  const stars: Array<'full' | 'half' | 'empty'> = [];

  for (let i = 0; i < 5; i++) {
    const threshold = i + 1;
    if (filledStars >= threshold) {
      stars.push('full');
    } else if (filledStars >= threshold - 0.5) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }

  return stars;
};

/**
 * RatingBadge displays an aggregate rating score (0-10) as a 5-star visual
 * with half-star precision, plus the numerical score.
 *
 * Used in media cards and detail headers to show the weighted average
 * rating from external sources (TMDB, IMDb, etc.).
 */
export const RatingBadge: React.FC<RatingBadgeProps> = ({
  score,
  size = 'small',
  testID,
}) => {
  if (score == null) {
    return null;
  }

  // Clamp score to valid 0-10 range
  const clampedScore = Math.max(0, Math.min(10, score));
  const stars = scoreToStars(clampedScore);
  const isSmall = size === 'small';

  const starCharacters = {
    full: '★',
    half: '⯨',
    empty: '☆',
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text
        style={[
          styles.star,
          isSmall ? styles.starSmall : styles.starLarge,
        ]}
        accessibilityElementsHidden
      >
        {stars.map((fill, index) => (
          <Text
            key={index}
            style={[
              styles.starIcon,
              fill !== 'empty' && styles.starFilled,
              fill === 'half' && styles.starHalf,
            ]}
          >
            {starCharacters[fill]}
          </Text>
        ))}
      </Text>
      <Text
        style={[
          styles.score,
          isSmall ? styles.scoreSmall : styles.scoreLarge,
        ]}
      >
        {clampedScore.toFixed(clampedScore % 1 === 0 ? 0 : 1)}/10
      </Text>
    </View>
  );
};

/**
 * RatingBadgeFromMediaRatings is a convenience wrapper that extracts
 * the aggregate score from a MediaRatings object.
 */
export interface RatingBadgeFromMediaRatingsProps {
  ratings: MediaRatings | null;
  size?: 'small' | 'large';
  testID?: string;
}

export const RatingBadgeFromMediaRatings: React.FC<
  RatingBadgeFromMediaRatingsProps
> = ({ ratings, size, testID }) => {
  return (
    <RatingBadge
      score={ratings?.aggregateScore ?? null}
      size={size}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    letterSpacing: -2,
  },
  starSmall: {
    fontSize: 12,
  },
  starLarge: {
    fontSize: 18,
  },
  starIcon: {
    color: '#555',
  },
  starFilled: {
    color: '#ffc107',
  },
  starHalf: {
    color: '#ffc107',
  },
  score: {
    color: '#888',
    fontWeight: '500',
    marginLeft: 4,
  },
  scoreSmall: {
    fontSize: 11,
  },
  scoreLarge: {
    fontSize: 14,
  },
});

export default RatingBadge;