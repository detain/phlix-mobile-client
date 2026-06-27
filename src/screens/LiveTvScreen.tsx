// src/screens/LiveTvScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useLiveTvStore } from '../stores/useLiveTvStore';
import {
  channelTypeLabel,
  currentProgram,
  formatProgramTime,
  type Channel,
  type Program,
} from '../types/livetv';
import type { RootStackParamList } from '../types/navigation';

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

type LiveTvNavProp = NativeStackNavigationProp<RootStackParamList, 'LiveTv'>;

const LiveTvScreen: React.FC = () => {
  const navigation = useNavigation<LiveTvNavProp>();
  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);

  const channels = useLiveTvStore((s) => s.channels);
  const channelsLoading = useLiveTvStore((s) => s.channelsLoading);
  const channelsError = useLiveTvStore((s) => s.channelsError);
  const notConfigured = useLiveTvStore((s) => s.notConfigured);

  const guide = useLiveTvStore((s) => s.guide);
  const guideChannelId = useLiveTvStore((s) => s.guideChannelId);
  const guideLoading = useLiveTvStore((s) => s.guideLoading);

  const loadChannels = useLiveTvStore((s) => s.loadChannels);
  const loadGuide = useLiveTvStore((s) => s.loadGuide);
  const refreshGuide = useLiveTvStore((s) => s.refreshGuide);
  const getChannelStreamUrl = useLiveTvStore((s) => s.getChannelStreamUrl);

  // Which channel's EPG is expanded (null = none).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [refreshingGuide, setRefreshingGuide] = useState(false);

  const nowSecs = Math.floor(Date.now() / 1000);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line no-void -- fire-and-forget; loader owns its errors
      void loadChannels();
      // Pull the full upcoming-week guide once so "now playing" labels populate.
      // eslint-disable-next-line no-void
      void loadGuide();
    }
  }, [isAdmin, loadChannels, loadGuide]);

  const handleRefreshChannels = useCallback(() => {
    // eslint-disable-next-line no-void -- fire-and-forget; loader owns its errors
    void loadChannels();
    // eslint-disable-next-line no-void
    void loadGuide();
  }, [loadChannels, loadGuide]);

  const handleRefreshGuide = useCallback(async () => {
    setRefreshingGuide(true);
    try {
      await refreshGuide();
    } catch (err) {
      Alert.alert('Refresh failed', errText(err, 'Could not refresh the guide.'));
    } finally {
      setRefreshingGuide(false);
    }
  }, [refreshGuide]);

  const handlePlay = useCallback(
    async (channel: Channel) => {
      setResolvingId(channel.id);
      try {
        const url = await getChannelStreamUrl(channel.id);
        navigation.navigate('Player', {
          itemId: `livetv:${channel.id}`,
          streamUrl: url,
          liveTitle: channel.name,
        });
      } catch (err) {
        Alert.alert('Playback failed', errText(err, 'Could not start this channel.'));
      } finally {
        setResolvingId(null);
      }
    },
    [getChannelStreamUrl, navigation]
  );

  const handleToggleGuide = useCallback(
    (channel: Channel) => {
      if (expandedId === channel.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(channel.id);
      // eslint-disable-next-line no-void -- loader owns its errors
      void loadGuide({ channelId: channel.id });
    },
    [expandedId, loadGuide]
  );

  // ── Gating + states ──
  if (!isAdmin) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="🔒"
          title="Admin access required"
          message="Live TV is managed by server administrators."
        />
      </SafeContainer>
    );
  }

  if (notConfigured) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="📺"
          title="Live TV is not set up"
          message="This server has no tuner or Live TV configuration. Set up a tuner and EPG source on the server to use Live TV."
        />
      </SafeContainer>
    );
  }

  if (channelsLoading && channels.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (channelsError && channels.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={channelsError} onRetry={handleRefreshChannels} />
      </SafeContainer>
    );
  }

  const renderProgram = (program: Program) => (
    <View key={program.id} style={styles.programRow}>
      <Text style={styles.programTime}>{formatProgramTime(program)}</Text>
      <View style={styles.programBody}>
        <Text style={styles.programTitle} numberOfLines={1}>
          {program.title}
        </Text>
        {program.description ? (
          <Text style={styles.programDesc} numberOfLines={2}>
            {program.description}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderChannel = ({ item }: { item: Channel }) => {
    const channelPrograms = guide.filter((p) => p.channel_id === item.id);
    const live = currentProgram(channelPrograms, nowSecs);
    const expanded = expandedId === item.id;
    const isResolving = resolvingId === item.id;
    return (
      <View style={styles.channelCard}>
        <TouchableOpacity
          style={styles.channelHeader}
          onPress={() => handlePlay(item)}
          disabled={isResolving}
        >
          <View style={styles.channelNumberBox}>
            <Text style={styles.channelNumber}>{String(item.number)}</Text>
          </View>
          <View style={styles.channelIdentity}>
            <Text style={styles.channelName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.channelNow} numberOfLines={1}>
              {isResolving
                ? 'Tuning…'
                : live
                  ? `Now: ${live.title}`
                  : channelTypeLabel(item.type)}
            </Text>
          </View>
          <Text style={styles.playGlyph}>{isResolving ? '…' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guideToggle}
          onPress={() => handleToggleGuide(item)}
        >
          <Text style={styles.guideToggleText}>
            {expanded ? 'Hide guide ▲' : 'Show guide ▼'}
          </Text>
        </TouchableOpacity>

        {expanded ? (
          <View style={styles.guideList}>
            {guideLoading && guideChannelId === item.id ? (
              <Text style={styles.guideHint}>Loading guide…</Text>
            ) : channelPrograms.length === 0 ? (
              <Text style={styles.guideHint}>No guide data for this channel.</Text>
            ) : (
              channelPrograms.map(renderProgram)
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live TV</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('LiveTvRecordings')}
          >
            <Text style={styles.headerButtonText}>Recordings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRefreshGuide}
            disabled={refreshingGuide}
          >
            <Text style={styles.headerButtonText}>
              {refreshingGuide ? 'Refreshing…' : 'Refresh guide'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={renderChannel}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={channelsLoading}
            onRefresh={handleRefreshChannels}
            tintColor="#0066cc"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📺"
            title="No channels"
            message="No Live TV channels are available. Scan for channels on the server."
          />
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  headerButton: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  channelCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  channelNumberBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelNumber: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '700',
  },
  channelIdentity: {
    flex: 1,
    marginRight: 8,
  },
  channelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  channelNow: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  playGlyph: {
    color: '#0066cc',
    fontSize: 18,
    fontWeight: '700',
  },
  guideToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  guideToggleText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  guideList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  guideHint: {
    color: '#888',
    fontSize: 13,
    paddingVertical: 8,
  },
  programRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#23233a',
  },
  programTime: {
    color: '#0066cc',
    fontSize: 13,
    width: 96,
  },
  programBody: {
    flex: 1,
  },
  programTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  programDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});

export default LiveTvScreen;
