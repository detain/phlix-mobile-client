/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/RecommendationsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';
import { UserRecommendation } from '@phlix/contracts';
import { SafeContainer } from '../components/layout';
import RecommendationCard from '../components/media/RecommendationCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';

type NavigationProp = NativeStackNavigationProp<any>;

const RecommendationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [items, setItems] = useState<UserRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setError(null);
      const data = await apiClient.get<{ recommendations: UserRecommendation[] }>(
        '/me/recommendations',
        { params: { limit: 20 } }
      );
      setItems(data.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (id: string) => {
    navigation.navigate('Player', { itemId: id });
  };

  if (loading) {
    return <SafeContainer><LoadingSpinner fullScreen /></SafeContainer>;
  }

  if (error) {
    return <SafeContainer><ErrorView message={error} onRetry={loadRecommendations} /></SafeContainer>;
  }

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>For You</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>No recommendations yet. Start watching to get personalized suggestions!</Text>
        ) : (
          <FlatList
            data={items}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <RecommendationCard item={item} onPress={handlePress} />
            )}
          />
        )}
      </View>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    paddingTop: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  empty: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    marginHorizontal: 32,
  },
});

export default RecommendationsScreen;
