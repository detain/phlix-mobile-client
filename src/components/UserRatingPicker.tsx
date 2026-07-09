/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/UserRatingPicker.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { favoritesManager } from '../api/FavoritesManager';
import {
  starsFromRating,
  ratingForStar,
  isClearTap,
  STAR_COUNT,
  type StarFill,
} from '../screens/favorites/favoritesHelpers';

export interface UserRatingPickerProps {
  /** The media item ID to rate */
  itemId: string;
  /** Initial user rating (1-10), if already known */
  initialRating?: number | null;
  /** Optional callback when rating changes (success) */
  onRatingChange?: (rating: number | null) => void;
  /** Optional test ID for testing */
  testID?: string;
}

/**
 * UserRatingPicker allows the user to set their personal star rating (1-10)
 * for a media item, displayed as 5 tappable stars.
 *
 * On mount, it fetches the existing user rating from the ratings endpoint.
 * Tapping a star sets the rating (star N = N*2 points, e.g., tap 4th star = 8).
 * Re-tapping the current rating clears it.
 */
export const UserRatingPicker: React.FC<UserRatingPickerProps> = ({
  itemId,
  initialRating,
  onRatingChange,
  testID,
}) => {
  // User rating: 1-10 integer or null if not rated
  const [userRating, setUserRating] = useState<number | null>(
    initialRating ?? null
  );
  // Loading state when fetching existing rating
  const [isLoading, setIsLoading] = useState(initialRating === undefined);
  // Busy guard to prevent double-fire while API call is in flight
  const [isBusy, setIsBusy] = useState(false);

  // Fetch existing user rating on mount (if not provided via props)
  useEffect(() => {
    if (initialRating !== undefined) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    favoritesManager
      .getMediaRatings(itemId)
      .then((ratings) => {
        if (cancelled) return;
        // Find the user's own rating in the ratings array
        const userRatingEntry = ratings.ratings.find(
          (r) => r.source === 'user' && r.type === 'user'
        );
        setUserRating(userRatingEntry?.score ?? null);
      })
      .catch(() => {
        // Silently fail - rating fetch is non-critical
        if (!cancelled) {
          setUserRating(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, initialRating]);

  // Convert rating to star display array
  const stars: StarFill[] = starsFromRating(userRating);

  // Handle star tap - set or clear rating
  const handleStarPress = useCallback(
    async (starIndex: number) => {
      if (isBusy || isLoading) return;

      const value = ratingForStar(starIndex);
      const clearing = isClearTap(value, userRating);
      const previous = userRating;

      // Optimistic update
      setUserRating(clearing ? null : value);
      setIsBusy(true);

      try {
        if (clearing) {
          await favoritesManager.clearRating(itemId);
          onRatingChange?.(null);
        } else {
          await favoritesManager.setRating(itemId, value);
          onRatingChange?.(value);
        }
      } catch (err) {
        // Revert on error
        setUserRating(previous);
        Alert.alert(
          'Rating Failed',
          err instanceof Error ? err.message : 'Could not update rating'
        );
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, isLoading, userRating, itemId, onRatingChange]
  );

  // Star characters matching existing UI
  const starChars: Record<StarFill, string> = {
    full: '★',
    half: '⯨',
    empty: '☆',
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.starsRow}>
        {stars.map((fill, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.starButton}
            onPress={() => handleStarPress(idx + 1)}
            disabled={isBusy || isLoading}
            accessibilityLabel={`Rate ${ratingForStar(idx + 1)} out of ${STAR_COUNT * 2}`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.star,
                fill !== 'empty' && styles.starActive,
              ]}
            >
              {starChars[fill]}
            </Text>
          </TouchableOpacity>
        ))}
        {userRating != null && (
          <Text style={styles.ratingValue}>{userRating}/10</Text>
        )}
      </View>
      {isLoading && (
        <Text style={styles.loadingText}>Loading...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
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
  loadingText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default UserRatingPicker;