// src/components/cast/CastButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Cast entry button (slice E7). Navigates to the server-mediated Cast screen,
 * passing the current item's id + its signed stream URL (and optional
 * title/thumbnail/duration). Cast is server-mediated — see CastManager.
 */
export interface CastButtonProps {
  mediaItemId: string;
  /** Signed direct-play stream URL minted on the media detail payload. */
  streamUrl: string;
  title?: string;
  thumbnail?: string;
  durationSecs?: number;
}

type CastNavigationProp = NativeStackNavigationProp<any>;

export const CastButton: React.FC<CastButtonProps> = ({
  mediaItemId,
  streamUrl,
  title,
  thumbnail,
  durationSecs,
}) => {
  const navigation = useNavigation<CastNavigationProp>();

  const handlePress = () => {
    navigation.navigate('Cast', {
      mediaItemId,
      streamUrl,
      title,
      thumbnail,
      durationSecs,
    });
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      accessibilityLabel="Cast"
    >
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>Cast</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#2d2d44',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CastButton;
