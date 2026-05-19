// src/screens/PlayerScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Text,
  ActivityIndicator,
  requireNativeComponent,
  NativeSyntheticEvent,
  Platform,
  findNodeHandle,
  Modal,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playbackManager } from '../api/PlaybackManager';
import { usePlayerStore } from '../stores/usePlayerStore';
import { StreamInfo, DeviceProfile, SkipMarkers } from '../types/playback';
import { SeekBar } from '../components/player/SeekBar';
import { ErrorView } from '../components/ui/ErrorView';
import { downloadService } from '../services/DownloadService';
import type { PlaybackEvent } from '../native/types';
import { syncPlayService } from '../syncplay/SyncPlayService';
import { useSyncplayStore } from '../store/syncplayStore';

// Define the native player props interface
interface NativePhlexPlayerProps {
  src?: string;
  autoPlay?: boolean;
  startPosition?: number;
  volume?: number;
  muted?: boolean;
  style?: any;
  ref?: React.RefObject<any>;
  onPlaybackEvent?: (event: any) => void;
  onProgress?: (event: any) => void;
  onError?: (event: any) => void;
}

// Native player component - only works when native module is properly linked
let PhlexPlayerView: React.ComponentType<NativePhlexPlayerProps> | null = null;
try {
  PhlexPlayerView = requireNativeComponent('PhlexPlayerView');
} catch (e) {
  console.warn('PhlexPlayerView native module not available, using placeholder');
}

// Helper to dispatch commands to native player
const dispatchPlayerCommand = (ref: React.RefObject<any>, command: string, args?: any[]) => {
  if (ref.current) {
    const nodeHandle = findNodeHandle(ref.current);
    if (nodeHandle) {
      const { UIManager } = require('react-native');
      UIManager.dispatchViewManagerCommand(nodeHandle, command, args);
    }
  }
};

type PlayerRouteParams = {
  Player: {
    itemId: string;
    startPosition?: number;
  };
};

const PlayerScreen: React.FC = () => {
  const route = useRoute<RouteProp<PlayerRouteParams, 'Player'>>();
  const navigation = useNavigation();
  const { itemId, startPosition = 0 } = route.params;

  // Player state
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(startPosition);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [skipMarkers, setSkipMarkers] = useState<SkipMarkers | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<any>(null);

  // Store actions
  const setPlayerStreamInfo = usePlayerStore((state) => state.setStreamInfo);
  const setSubtitleTracks = usePlayerStore((state) => state.setSubtitleTracks);
  const setAudioTracks = usePlayerStore((state) => state.setAudioTracks);
  const playerSetCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const playerSetDuration = usePlayerStore((state) => state.setDuration);
  const playerSetIsPlaying = usePlayerStore((state) => state.setIsPlaying);

  // SyncPlay state
  const [showSyncPlayOverlay, setShowSyncPlayOverlay] = useState(false);
  const currentGroup = useSyncplayStore((state) => state.currentGroup);
  const isHost = useSyncplayStore((state) => state.isHost);
  const timeSyncStable = useSyncplayStore((state) => state.timeSyncStable);
  const syncplayError = useSyncplayStore((state) => state.error);
  const updatePlaybackState = useSyncplayStore((state) => state.updatePlaybackState);

  // SyncPlay effect - connect and listen for commands
  useEffect(() => {
    // Generate a simple member ID (in real app, use user ID from auth)
    const memberId = `mobile_${itemId}`;

    // Set up SyncPlay event handlers
    syncPlayService.on('onPlaybackCommand', (cmd) => {
      if (!isHost) {
        // Non-host members follow playback commands from host
        switch (cmd.type) {
          case 'play':
            dispatchPlayerCommand(playerRef, 'play');
            setIsPlaying(true);
            playerSetIsPlaying(true);
            break;
          case 'pause':
            dispatchPlayerCommand(playerRef, 'pause');
            setIsPlaying(false);
            playerSetIsPlaying(false);
            break;
          case 'seek':
            dispatchPlayerCommand(playerRef, 'seekTo', [cmd.position]);
            setCurrentTime(cmd.position);
            playerSetCurrentTime(cmd.position);
            break;
        }
      }
    });

    syncPlayService.on('onError', (code, message) => {
      console.warn(`SyncPlay error [${code}]: ${message}`);
    });

    syncPlayService.connect(memberId);

    return () => {
      syncPlayService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Update store when syncplay state changes
  useEffect(() => {
    if (currentGroup) {
      updatePlaybackState(currentGroup.playbackState, currentGroup.playbackPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup?.playbackState, currentGroup?.playbackPosition]);

  useEffect(() => {
    loadPlaybackInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (showControls && isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls, isPlaying]);

  const loadPlaybackInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // ── Offline-first: check if item has a local download ──────────────────
      const localPath = downloadService.getItemLocalPath(itemId);
      if (localPath) {
        const offlineStreamInfo: StreamInfo = {
          url: localPath,
          protocol: 'http',
          container: 'mp4',
          size: 0,
          bitrate: 0,
          duration_seconds: 0,
        };
        setStreamInfo(offlineStreamInfo);
        setIsOfflineMode(true);
        setIsLoading(false);
        setPlayerStreamInfo(offlineStreamInfo);
        return;
      }

      setIsOfflineMode(false);

      // ── Online: fetch stream info from server ─────────────────────────────
      const deviceProfile = getDeviceProfile();
      const info = await playbackManager.getPlaybackInfo(itemId, deviceProfile);

      setStreamInfo(info.stream_info);
      setSubtitleTracks(info.subtitle_tracks);
      setAudioTracks(info.audio_tracks);
      setDuration(info.stream_info.duration_seconds);
      if (info.markers) {
        setSkipMarkers(info.markers);
      }

      setPlayerStreamInfo(info.stream_info);
      playerSetDuration(info.stream_info.duration_seconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceProfile = (): DeviceProfile => {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    return {
      name: Platform.OS === 'ios' ? 'iPhone' : 'Android',
      platform,
      version: Platform.Version.toString(),
      capabilities: {
        video_codecs: ['h264', 'h265', 'vp9'],
        audio_codecs: ['aac', 'ac3', 'eac3', 'flac', 'mp3'],
        max_resolution: 2160,
        max_bitrate: 50000000,
        supports_4k: true,
        supports_hdr: true,
        supports_dolby_vision: true,
        supports_dolby_atmos: true,
        supports_dts: true,
      },
    };
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    controlsOpacity.setValue(1);
  };

  const hideControls = () => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  };

  const toggleControls = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsTemporarily();
    }
  };

  const handlePlaybackEvent = useCallback((event: NativeSyntheticEvent<PlaybackEvent>) => {
    const { event: playbackEvent, currentTime: ct, duration: dur } = event.nativeEvent;
    switch (playbackEvent) {
      case 'ready':
        if (dur && dur > 0) {
          setDuration(dur);
          playerSetDuration(dur);
        }
        break;
      case 'play':
        setIsPlaying(true);
        playerSetIsPlaying(true);
        break;
      case 'pause':
        setIsPlaying(false);
        playerSetIsPlaying(false);
        break;
      case 'ended':
        setIsPlaying(false);
        playerSetIsPlaying(false);
        break;
      case 'buffering':
        // Could show buffering indicator
        break;
    }
    if (ct !== undefined) {
      setCurrentTime(ct);
      playerSetCurrentTime(ct);
    }
  }, [playerSetCurrentTime, playerSetDuration, playerSetIsPlaying]);

  const handleProgress = useCallback((event: NativeSyntheticEvent<{ currentTime: number; duration: number }>) => {
    const { currentTime: ct, duration: dur } = event.nativeEvent;
    setCurrentTime(ct);
    playerSetCurrentTime(ct);
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
      playerSetDuration(dur);
    }
  }, [duration, playerSetCurrentTime, playerSetDuration]);

  const handlePlayerError = useCallback((event: NativeSyntheticEvent<{ error: string }>) => {
    const { error: errorMessage } = event.nativeEvent;
    setError(errorMessage || 'Playback error');
  }, []);

  const handlePlayPause = () => {
    if (isHost) {
      // Host controls directly and broadcasts to group
      if (isPlaying) {
        dispatchPlayerCommand(playerRef, 'pause');
        setIsPlaying(false);
        playerSetIsPlaying(false);
        syncPlayService.sendPause(currentTime);
      } else {
        dispatchPlayerCommand(playerRef, 'play');
        setIsPlaying(true);
        playerSetIsPlaying(true);
        syncPlayService.sendPlay(currentTime);
      }
    } else {
      // Non-hosts just control locally (playback is controlled by host)
      if (isPlaying) {
        dispatchPlayerCommand(playerRef, 'pause');
        setIsPlaying(false);
        playerSetIsPlaying(false);
      } else {
        dispatchPlayerCommand(playerRef, 'play');
        setIsPlaying(true);
        playerSetIsPlaying(true);
      }
    }
  };

  const handlePlay = () => {
    dispatchPlayerCommand(playerRef, 'play');
    setIsPlaying(true);
    playerSetIsPlaying(true);
    if (isHost) {
      syncPlayService.sendPlay(currentTime);
    }
  };

  const handlePause = () => {
    dispatchPlayerCommand(playerRef, 'pause');
    setIsPlaying(false);
    playerSetIsPlaying(false);
    if (isHost) {
      syncPlayService.sendPause(currentTime);
    }
  };

  const handleSeek = (position: number) => {
    dispatchPlayerCommand(playerRef, 'seekTo', [position]);
    setCurrentTime(position);
    playerSetCurrentTime(position);
  };

  const handleSeekBackward = () => {
    const newPosition = Math.max(0, currentTime - 15);
    handleSeek(newPosition);
  };

  const handleSeekForward = () => {
    const newPosition = Math.min(duration, currentTime + 15);
    handleSeek(newPosition);
  };

  const handleSkip = (endPosition: number) => {
    handleSeek(endPosition);
  };

  const introMarker = skipMarkers?.skip_intro_start != null && skipMarkers?.skip_intro_end != null
    ? { start: skipMarkers.skip_intro_start, end: skipMarkers.skip_intro_end }
    : null;

  const outroMarker = skipMarkers?.skip_outro_start != null && skipMarkers?.skip_outro_end != null
    ? { start: skipMarkers.skip_outro_start, end: skipMarkers.skip_outro_end }
    : null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <ErrorView message={error} onRetry={loadPlaybackInfo} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Video Player Area */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={toggleControls}
        style={styles.playerWrapper}
      >
        {PhlexPlayerView && streamInfo?.url ? (
          <PhlexPlayerView
            ref={playerRef}
            style={styles.player}
            src={streamInfo.url}
            autoPlay={true}
            startPosition={startPosition}
            volume={1.0}
            muted={false}
            onPlaybackEvent={handlePlaybackEvent}
            onProgress={handleProgress}
            onError={handlePlayerError}
          />
        ) : (
          <View style={styles.playerPlaceholder}>
            <Text style={styles.playerPlaceholderText}>
              Video Player{'\n'}(Native module required)
            </Text>
            <Text style={styles.streamUrlText}>
              {streamInfo?.url || 'No stream URL'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Overlay Controls */}
      {showControls && (
        <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.topBarRight}>
              {/* SyncPlay indicator / button */}
              <TouchableOpacity
                style={[
                  styles.syncPlayButton,
                  currentGroup && styles.syncPlayButtonActive,
                ]}
                onPress={() => setShowSyncPlayOverlay(true)}
              >
                <Text style={styles.syncPlayButtonText}>
                  {currentGroup ? `👥 ${currentGroup.members.length}` : '👥'}
                </Text>
              </TouchableOpacity>

              {/* TimeSync indicator */}
              {currentGroup && (
                <View style={styles.syncStatusIndicator}>
                  <View
                    style={[
                      styles.syncStatusDot,
                      timeSyncStable ? styles.syncStatusStable : styles.syncStatusUnstable,
                    ]}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.centerControls}>
            <TouchableOpacity style={styles.seekButton} onPress={handleSeekBackward}>
              <Text style={styles.seekButtonText}>-15</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={handlePlayPause}
            >
              <Text style={styles.playPauseButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.seekButton} onPress={handleSeekForward}>
              <Text style={styles.seekButtonText}>+15</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomControls}>
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
            />
          </View>
        </Animated.View>
      )}

      {/* SyncPlay Member List Overlay */}
      <Modal
        visible={showSyncPlayOverlay}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSyncPlayOverlay(false)}
      >
        <View style={styles.syncPlayModalOverlay}>
          <View style={styles.syncPlayModalContent}>
            <View style={styles.syncPlayModalHeader}>
              <Text style={styles.syncPlayModalTitle}>SyncPlay</Text>
              <TouchableOpacity onPress={() => setShowSyncPlayOverlay(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {currentGroup ? (
              <>
                <Text style={styles.groupNameText}>{currentGroup.name}</Text>
                <Text style={styles.groupInfoText}>
                  {isHost ? 'You are the host' : `Host: ${currentGroup.members.find((m) => m.id === currentGroup.hostId)?.name ?? 'Unknown'}`}
                </Text>

                <ScrollView style={styles.memberList}>
                  {currentGroup.members.map((member) => (
                    <View key={member.id} style={styles.memberRow}>
                      <Text style={styles.memberName}>
                        {member.name} {member.id === currentGroup.hostId ? '👑' : ''}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.leaveGroupButton}
                  onPress={() => {
                    syncPlayService.leaveGroup();
                    setShowSyncPlayOverlay(false);
                  }}
                >
                  <Text style={styles.leaveGroupButtonText}>Leave Group</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.noGroupText}>Not in a SyncPlay group</Text>

                <TouchableOpacity
                  style={styles.createGroupButton}
                  onPress={() => {
                    syncPlayService.createGroup(`Session ${itemId.slice(0, 6)}`);
                    setShowSyncPlayOverlay(false);
                  }}
                >
                  <Text style={styles.createGroupButtonText}>Create Group</Text>
                </TouchableOpacity>
              </>
            )}

            {syncplayError && (
              <Text style={styles.syncPlayErrorText}>{syncplayError}</Text>
            )}

            {/* TimeSync status */}
            <View style={styles.timeSyncStatus}>
              <Text style={styles.timeSyncLabel}>Time Sync</Text>
              <Text style={styles.timeSyncValue}>
                {timeSyncStable ? 'Stable' : 'Syncing...'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerWrapper: {
    flex: 1,
  },
  player: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  playerPlaceholderText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  streamUrlText: {
    color: '#444',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncPlayButtonActive: {
    backgroundColor: 'rgba(0,102,204,0.8)',
  },
  syncPlayButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  syncStatusIndicator: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncStatusStable: {
    backgroundColor: '#00cc66',
  },
  syncStatusUnstable: {
    backgroundColor: '#ff9500',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  seekButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButtonText: {
    color: '#fff',
    fontSize: 32,
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // SyncPlay Modal
  syncPlayModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  syncPlayModalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  syncPlayModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  syncPlayModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  groupNameText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  groupInfoText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  memberList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
  },
  leaveGroupButton: {
    backgroundColor: '#cc3333',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noGroupText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  createGroupButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  syncPlayErrorText: {
    color: '#ff6666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  timeSyncStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  timeSyncLabel: {
    color: '#888',
    fontSize: 14,
  },
  timeSyncValue: {
    color: '#fff',
    fontSize: 14,
  },
  skipButtonsContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    gap: 10,
  },
});

export default PlayerScreen;
