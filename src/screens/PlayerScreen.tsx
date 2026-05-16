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
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playbackManager } from '../api/PlaybackManager';
import { usePlayerStore } from '../stores/usePlayerStore';
import { StreamInfo, DeviceProfile } from '../types/playback';
import { PlayerControls } from '../components/player/PlayerControls';
import { SeekBar } from '../components/player/SeekBar';
import { ErrorView } from '../components/ui/ErrorView';
import type { PlaybackEvent } from '../native/types';

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

      const deviceProfile = getDeviceProfile();
      const info = await playbackManager.getPlaybackInfo(itemId, deviceProfile);

      setStreamInfo(info.stream_info);
      setSubtitleTracks(info.subtitle_tracks);
      setAudioTracks(info.audio_tracks);
      setDuration(info.stream_info.duration_seconds);

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

  const handlePlay = () => {
    dispatchPlayerCommand(playerRef, 'play');
    setIsPlaying(true);
    playerSetIsPlaying(true);
  };

  const handlePause = () => {
    dispatchPlayerCommand(playerRef, 'pause');
    setIsPlaying(false);
    playerSetIsPlaying(false);
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
          <PlayerControls
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeekBackward={handleSeekBackward}
            onSeekForward={handleSeekForward}
            onClose={() => navigation.goBack()}
          />

          <View style={styles.bottomControls}>
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
            />
          </View>
        </Animated.View>
      )}
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
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});

export default PlayerScreen;
