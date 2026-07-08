/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/CastScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useCastStore } from '../stores/useCastStore';
import {
  CAST_BACKENDS,
  backendLabel,
  canResume,
  canSeek,
  canStop,
  type CastBackend,
  type CastDevice,
} from '../types/cast';
import type { RootStackParamList } from '../types/navigation';

const POLL_INTERVAL_MS = 2500;
const SEEK_STEP_MS = 15000;

const errText = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

type CastNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Cast'>;

const CastScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Cast'>>();
  const navigation = useNavigation<CastNavigationProp>();
  const { mediaItemId, streamUrl, title, thumbnail, durationSecs } = route.params;

  const devices = useCastStore((s) => s.devices);
  const isDiscovering = useCastStore((s) => s.isDiscovering);
  const discoverError = useCastStore((s) => s.discoverError);
  const activeDevice = useCastStore((s) => s.activeDevice);
  const transport = useCastStore((s) => s.transport);

  const discover = useCastStore((s) => s.discover);
  const castTo = useCastStore((s) => s.castTo);
  const pause = useCastStore((s) => s.pause);
  const resume = useCastStore((s) => s.resume);
  const seek = useCastStore((s) => s.seek);
  const refreshStatus = useCastStore((s) => s.refreshStatus);
  const disconnect = useCastStore((s) => s.disconnect);
  const stopAndDisconnect = useCastStore((s) => s.stopAndDisconnect);

  const [connecting, setConnecting] = useState(false);
  // Local scrub position (ms) for the seek controls (server gives no live ms).
  const [positionMs, setPositionMs] = useState(0);

  // Single status-poll interval, started when a device is active and torn down
  // on unmount OR when the active device clears (no leaked timers — mirrors the
  // AdminLibrariesScreen poll pattern, keyed off refs).
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Discover on mount.
  useEffect(() => {
    // eslint-disable-next-line no-void -- fire-and-forget; discover owns its errors
    void discover();
  }, [discover]);

  // Void-returning wrapper so RefreshControl/ErrorView callbacks don't surface
  // a dangling promise (discover owns its own errors).
  const handleDiscover = useCallback(() => {
    // eslint-disable-next-line no-void -- fire-and-forget; discover owns its errors
    void discover();
  }, [discover]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Drive the status poll off `activeDevice`: start when a device is active,
  // stop when it clears. Full teardown on unmount.
  useEffect(() => {
    mountedRef.current = true;
    const timer = timerRef;
    if (activeDevice) {
      // Kick an immediate status read so the badge appears without a full tick.
      // eslint-disable-next-line no-void -- fire-and-forget; refreshStatus owns its errors
      void refreshStatus();
      if (timer.current === null) {
        timer.current = setInterval(() => {
          // eslint-disable-next-line no-void -- fire-and-forget; refreshStatus owns its errors
          void refreshStatus();
        }, POLL_INTERVAL_MS);
      }
    } else if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [activeDevice, refreshStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSelect = async (device: CastDevice) => {
    setConnecting(true);
    try {
      await castTo(device, {
        mediaItemId,
        mediaUrl: streamUrl,
        title,
        thumbnail,
        durationSecs,
      });
      setPositionMs(0);
    } catch (err) {
      Alert.alert('Cast failed', errText(err, 'Could not cast to this device.'));
    } finally {
      if (mountedRef.current) {
        setConnecting(false);
      }
    }
  };

  const handlePauseResume = async () => {
    const playing = transport?.state !== 'paused';
    try {
      if (playing) {
        await pause();
      } else {
        await resume();
      }
    } catch (err) {
      Alert.alert('Transport failed', errText(err, 'Could not change playback.'));
    }
  };

  const handleSeek = async (deltaMs: number) => {
    const next = Math.max(0, positionMs + deltaMs);
    setPositionMs(next);
    try {
      await seek(next);
    } catch (err) {
      Alert.alert('Seek failed', errText(err, 'Could not seek.'));
    }
  };

  const handleStop = async () => {
    try {
      await stopAndDisconnect();
      clearTimer();
    } catch (err) {
      Alert.alert('Stop failed', errText(err, 'Could not stop playback.'));
    }
  };

  // Back leaves the device PLAYING — disconnect clears the session only.
  const handleBack = () => {
    disconnect();
    clearTimer();
    navigation.goBack();
  };

  const renderDevice = ({ item }: { item: CastDevice }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => handleSelect(item)}
      disabled={connecting}
    >
      <View style={styles.deviceIdentity}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.detail ? (
          <Text style={styles.deviceMeta} numberOfLines={1}>
            {item.detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.deviceBackend}>{backendLabel(item.backend)}</Text>
    </TouchableOpacity>
  );

  // ── Transport view (a device is active) ──
  if (activeDevice) {
    const backend: CastBackend = activeDevice.backend;
    const playing = transport?.state !== 'paused';
    return (
      <SafeContainer edges={['top']}>
        <View style={styles.transportContainer}>
          <Text style={styles.transportTitle} numberOfLines={2}>
            {title ?? 'Now Casting'}
          </Text>
          <Text style={styles.transportDevice}>
            {activeDevice.name} · {backendLabel(backend)}
          </Text>

          <View style={styles.statusBadgeRow}>
            <Text style={styles.statusBadge}>
              {transport?.active === false
                ? 'Idle'
                : transport?.state ?? 'Connecting…'}
            </Text>
          </View>

          {canSeek(backend) ? (
            <View style={styles.seekRow}>
              <TouchableOpacity
                style={styles.seekButton}
                onPress={() => handleSeek(-SEEK_STEP_MS)}
              >
                <Text style={styles.seekText}>⏪ 15s</Text>
              </TouchableOpacity>
              <Text style={styles.seekPosition}>
                {Math.floor(positionMs / 1000)}s
              </Text>
              <TouchableOpacity
                style={styles.seekButton}
                onPress={() => handleSeek(SEEK_STEP_MS)}
              >
                <Text style={styles.seekText}>15s ⏩</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.controlsRow}>
            {/* Pause always supported; resume gated (DLNA can't resume). */}
            <TouchableOpacity
              style={[styles.controlButton, styles.controlPrimary]}
              onPress={handlePauseResume}
              disabled={!playing && !canResume(backend)}
            >
              <Text style={styles.controlText}>
                {playing ? '⏸ Pause' : '▶ Resume'}
              </Text>
            </TouchableOpacity>

            {canStop(backend) ? (
              <TouchableOpacity
                style={[styles.controlButton, styles.controlDanger]}
                onPress={handleStop}
              >
                <Text style={styles.controlText}>⏹ Stop</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.backLink} onPress={handleBack}>
            <Text style={styles.backLinkText}>
              Done (leaves {activeDevice.name} playing)
            </Text>
          </TouchableOpacity>
        </View>
      </SafeContainer>
    );
  }

  // ── Discovery picker (no active device) ──
  if (isDiscovering && devices.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (discoverError && devices.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={discoverError} onRetry={handleDiscover} />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cast to a device</Text>
        <Text style={styles.headerSubtitle}>
          {devices.length} device{devices.length === 1 ? '' : 's'} found
        </Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => `${item.backend}:${item.id}`}
        renderItem={renderDevice}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isDiscovering}
            onRefresh={handleDiscover}
            tintColor="#0066cc"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📡"
            title="No cast devices found"
            message={`Searched ${CAST_BACKENDS.map(backendLabel).join(
              ', '
            )} on your network. Pull to refresh.`}
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
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  deviceCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIdentity: {
    flex: 1,
    marginRight: 8,
  },
  deviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  deviceBackend: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '600',
  },
  // Transport view
  transportContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  transportTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  transportDevice: {
    color: '#888',
    fontSize: 15,
    marginTop: 6,
  },
  statusBadgeRow: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
  statusBadge: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    textTransform: 'capitalize',
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  seekButton: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  seekText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  seekPosition: {
    color: '#888',
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlPrimary: {
    backgroundColor: '#0066cc',
  },
  controlDanger: {
    backgroundColor: '#5a1a1a',
  },
  controlText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 'auto',
    paddingVertical: 18,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#888',
    fontSize: 15,
  },
});

export default CastScreen;
