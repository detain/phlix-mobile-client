/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

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
  findNodeHandle,
  Modal,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { playbackManager } from '../api/PlaybackManager';
import { transcodeManager } from '../api/TranscodeManager';
import { markerManager } from '../api/MarkerManager';
import type { PrepareHandle } from '../api/TranscodeManager';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { StreamInfo, SubtitleTrack, Marker } from '../types/playback';
import type { QualitySelection, Rendition } from '@phlix/contracts';
import { AUTO_QUALITY } from '@phlix/contracts';
import { SeekBar } from '../components/player/SeekBar';
import { SkipButton } from '../components/player/SkipButton';
import { QualityMenu } from '../components/player/QualityMenu';
import { AudioTrackList } from '../components/player/AudioTrackList';
import { SubtitleTrackList } from '../components/player/SubtitleTrackList';
import type { StreamAudioTrack, StreamSubtitleTrack } from '@phlix/contracts';
import {
  buildQualityOptions,
  resolveQualityUrl,
  seedQualitySelection,
  activeQualityLabel,
} from '../components/player/quality';
import { ErrorView } from '../components/ui/ErrorView';
import { downloadService } from '../services/DownloadService';
import type { PlaybackEvent } from '../native/types';
import { syncPlayService } from '../syncplay/SyncPlayService';
import { useSyncplayStore } from '../store/syncplayStore';

// Define the native player props interface
interface NativePhlixPlayerProps {
  src?: string;
  autoPlay?: boolean;
  startPosition?: number;
  volume?: number;
  muted?: boolean;
  // E3: selected subtitle VTT URL ('' = off). Native rendering UNTESTED in CI.
  subtitleUrl?: string;
  style?: any;
  ref?: React.RefObject<any>;
  onPlaybackEvent?: (event: any) => void;
  onProgress?: (event: any) => void;
  onError?: (event: any) => void;
}

// Native player component - only works when native module is properly linked
let PhlixPlayerView: React.ComponentType<NativePhlixPlayerProps> | null = null;
try {
  PhlixPlayerView = requireNativeComponent('PhlixPlayerView');
} catch {
  console.warn('PhlixPlayerView native module not available, using placeholder');
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
    // E8 (additive): direct live-stream URL. When set, the player plays it
    // verbatim and SKIPS the itemId detail/transcode lifecycle.
    streamUrl?: string;
    liveTitle?: string;
  };
};

const PlayerScreen: React.FC = () => {
  const route = useRoute<RouteProp<PlayerRouteParams, 'Player'>>();
  const navigation = useNavigation();
  const { itemId, startPosition = 0, streamUrl: directStreamUrl } = route.params;
  // E8: live-stream mode is driven SOLELY by a present `streamUrl` param — the
  // existing itemId playback path is untouched when this is absent.
  const isLiveStream = typeof directStreamUrl === 'string' && directStreamUrl !== '';

  // Player state
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(startPosition);
  // G3 finding 1: the position the native player (re)starts from. Seeded from the
  // route param on mount, then re-pointed at the LIVE playback position on every
  // quality swap so swapping `src` resumes near the current spot instead of
  // restarting from 0 / the mount-time position.
  const [playerStartPosition, setPlayerStartPosition] = useState(startPosition);
  // Mirror of the live playback clock. `handleQualitySelect` reads THIS (not the
  // `currentTime` state) at swap time so it never captures a stale closure and
  // the swap callback needn't re-create on every progress tick.
  const currentPositionRef = useRef(startPosition);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // E4: offline-mode flag — true when playing a local downloaded file. Surfaces
  // a small "Offline" badge in the top bar.
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // ── E3: transcode lifecycle ──────────────────────────────────────────────
  const [preparingTranscode, setPreparingTranscode] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  // Guards against falling back to transcode more than once per load.
  const transcodeAttempted = useRef(false);
  // Active prepare handle so we can cancel polling on unmount / re-load.
  const prepareHandleRef = useRef<PrepareHandle | null>(null);

  // ── E3: markers (SECONDS) ────────────────────────────────────────────────
  const [introMarker, setIntroMarker] = useState<Marker | null>(null);
  const [outroMarker, setOutroMarker] = useState<Marker | null>(null);

  // ── G3: quality selection (ABR ladder) ───────────────────────────────────
  // Variants become available once a transcode job resolves (server A7). Auto =
  // native ABR on the multi-variant master; a pinned rung plays that rung's own
  // media playlist. `defaultQuality` (persisted setting) seeds the pick.
  const defaultQuality = useSettingsStore((state) => state.defaultQuality);
  const setDefaultQuality = useSettingsStore((state) => state.setDefaultQuality);
  const [qualityVariants, setQualityVariants] = useState<Rendition[]>([]);
  const [qualityMasterUrl, setQualityMasterUrl] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<QualitySelection>(AUTO_QUALITY);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityOptions = buildQualityOptions(qualityVariants, qualityMasterUrl);

  // ── E3: subtitles ────────────────────────────────────────────────────────
  const subtitleTracksState = usePlayerStore((state) => state.subtitleTracks);
  const selectedSubtitleId = usePlayerStore((state) => state.currentSubtitleTrackId);
  const setSelectedSubtitleId = usePlayerStore((state) => state.setCurrentSubtitleTrackId);
  const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);

  // ── P3B-S7: audio tracks (StreamAudioTrack from contracts v0.3.2) ────────
  // Will be populated from media item streams API when available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [audioTrackList, setAudioTrackList] = useState<StreamAudioTrack[]>([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);

  // ── P3B-S7: subtitle tracks (StreamSubtitleTrack from contracts v0.3.2) ─
  // Will be populated from media item streams API when available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [subtitleTrackList, setSubtitleTrackList] = useState<StreamSubtitleTrack[]>([]);

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
    // Markers are an item concept; a live stream has none.
    if (!isLiveStream) {
      loadMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Stop transcode polling when the screen unmounts or the item changes.
  useEffect(() => {
    return () => {
      prepareHandleRef.current?.cancel();
      prepareHandleRef.current = null;
    };
  }, [itemId]);

  // G3 finding 1: keep the position ref in lockstep with the live playback clock
  // (fed by every `setCurrentTime` source — progress, ready, seek, syncplay) so a
  // quality swap can seed the new `src`'s start position from where the viewer
  // actually is.
  useEffect(() => {
    currentPositionRef.current = currentTime;
  }, [currentTime]);

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
      // Cancel any in-flight transcode prepare from a prior load.
      prepareHandleRef.current?.cancel();
      prepareHandleRef.current = null;
      transcodeAttempted.current = false;
      setPreparingTranscode(false);
      setTranscodeProgress(0);
      // G3: a fresh load has no ladder yet (only a transcode job produces one).
      setQualityVariants([]);
      setQualityMasterUrl('');
      setSelectedQuality(AUTO_QUALITY);
      setShowQualityMenu(false);

      // ── E8 Live TV: a direct stream URL was passed — play it verbatim and
      // SKIP the itemId detail-fetch / transcode lifecycle entirely. This branch
      // is reached ONLY when `streamUrl` is present, so the itemId path below is
      // unaffected for normal/Cast playback. ──────────────────────────────────
      if (isLiveStream && directStreamUrl) {
        const liveStreamInfo: StreamInfo = {
          url: directStreamUrl,
          stream_url: directStreamUrl,
          protocol: 'hls',
          container: 'hls',
          size: 0,
          bitrate: 0,
          duration_seconds: 0,
        };
        setStreamInfo(liveStreamInfo);
        setSubtitleTracks([]);
        setAudioTracks([]);
        setSelectedSubtitleId(null);
        setIsOfflineMode(false);
        setIsLoading(false);
        setPlayerStreamInfo(liveStreamInfo);
        return;
      }

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

      // ── Online: resolve the signed direct-play URL from media detail ───────
      // (`stream_url` on GET /api/v1/media/{id}). The native player consumes it
      // directly. The server selects the transcode profile from the
      // X-Phlix-Device-Type header (sent on every request by the API client).
      // If direct play fails to load (onError → handlePlayerError), we fall back
      // to the transcode lifecycle (POST /media/{id}/transcode → poll status).
      const streamUrl = await playbackManager.getStreamUrl(itemId);
      if (!streamUrl) {
        throw new Error('No playable stream available for this item');
      }

      const onlineStreamInfo: StreamInfo = {
        url: streamUrl,
        stream_url: streamUrl,
        protocol: 'http',
        container: '',
        size: 0,
        bitrate: 0,
        duration_seconds: 0,
      };

      setStreamInfo(onlineStreamInfo);
      // Direct-play subtitle/audio track lists are not exposed by the stream_url
      // path; subtitles come from the transcode response when transcoding.
      setSubtitleTracks([]);
      setAudioTracks([]);
      setSelectedSubtitleId(null);
      setPlayerStreamInfo(onlineStreamInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch intro/outro markers (SECONDS) for the SkipButton overlay via the
   * one-call playback-info route. Non-fatal: a failure just means no skip UI.
   */
  const loadMarkers = async () => {
    try {
      const info = await markerManager.getPlaybackInfo(itemId);
      setIntroMarker(info.intro_marker);
      setOutroMarker(info.outro_marker);
    } catch {
      setIntroMarker(null);
      setOutroMarker(null);
    }
  };

  /**
   * Transcode fallback: start the HLS transcode and poll until the playlist is
   * ready, then swap the player `src` to the signed master URL. Triggered when
   * direct play errors out (once per load). Polling is cancelled on unmount.
   */
  const startTranscodeFallback = useCallback(async () => {
    if (transcodeAttempted.current) {
      return;
    }
    transcodeAttempted.current = true;
    setError(null);
    setPreparingTranscode(true);
    setTranscodeProgress(0);

    const handle = transcodeManager.prepare(itemId, {
      onProgress: (p) => setTranscodeProgress(p),
    });
    prepareHandleRef.current = handle;

    try {
      const { masterUrl, subtitles, variants } = await handle.promise;

      // G3: seed the quality pick from the persisted default, then pick the URL
      // to play — the master for Auto (native ABR), or a pinned rung's own
      // media playlist. `defaultQuality` is thereby actually READ + APPLIED.
      const seeded = seedQualitySelection(defaultQuality, variants);
      const playUrl = resolveQualityUrl(variants, seeded, masterUrl);
      setQualityVariants(variants);
      setQualityMasterUrl(masterUrl);
      setSelectedQuality(seeded);

      const hlsStreamInfo: StreamInfo = {
        url: playUrl,
        stream_url: playUrl,
        protocol: 'hls',
        container: 'hls',
        size: 0,
        bitrate: 0,
        duration_seconds: 0,
      };
      setStreamInfo(hlsStreamInfo);
      setPlayerStreamInfo(hlsStreamInfo);

      // Expose the signed VTT tracks from the transcode response as a picker.
      const tracks: SubtitleTrack[] = subtitles.map((s, i) => ({
        id: `tx-${i}`,
        codec: 'vtt',
        language: s.language,
        display_title: s.language,
        url: s.url,
      }));
      setSubtitleTracks(tracks);
      setSelectedSubtitleId(null);
    } catch (err) {
      // A cancel (unmount) should not surface an error to the user.
      const message = err instanceof Error ? err.message : 'Transcode failed';
      if (message !== 'Transcode preparation cancelled') {
        setError(message);
      }
    } finally {
      prepareHandleRef.current = null;
      setPreparingTranscode(false);
    }
  }, [itemId, defaultQuality, setSubtitleTracks, setSelectedSubtitleId, setPlayerStreamInfo]);

  /**
   * G3: apply a quality pick. Persists the choice to `defaultQuality` and swaps
   * the player `src` — the master playlist for `Auto` (native ABR) or the
   * chosen rung's own media playlist (a hard pin). Native players restart the
   * item from `startPosition` on a `src` change (an AVPlayer/ExoPlayer detail),
   * so we re-point `playerStartPosition` at the LIVE playback position captured
   * from `currentPositionRef` at the moment of the switch — otherwise every
   * Auto↔pin / rung↔rung switch would restart the video from the mount-time
   * position (0 for a fresh play), a device-independent UX regression (finding 1).
   */
  const handleQualitySelect = useCallback(
    (value: QualitySelection) => {
      // Snapshot where the viewer actually is BEFORE the src swap so the reload
      // resumes there. Read the ref (live source of truth), never the possibly
      // stale mount-time `startPosition`.
      const resumeAt = Math.max(0, currentPositionRef.current || 0);
      setSelectedQuality(value);
      setDefaultQuality(value);
      const playUrl = resolveQualityUrl(qualityVariants, value, qualityMasterUrl);
      const swapped: StreamInfo = {
        url: playUrl,
        stream_url: playUrl,
        protocol: 'hls',
        container: 'hls',
        size: 0,
        bitrate: 0,
        duration_seconds: 0,
      };
      setPlayerStartPosition(resumeAt);
      setStreamInfo(swapped);
      setPlayerStreamInfo(swapped);
    },
    [qualityVariants, qualityMasterUrl, setDefaultQuality, setPlayerStreamInfo],
  );

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
    // First direct-play failure → fall back to a server-side transcode rather
    // than surfacing the error. Subsequent failures (or transcode failures)
    // bubble up via startTranscodeFallback's own error handling. Live streams
    // (E8) have no itemId transcode path, so errors surface directly.
    if (!isLiveStream && !transcodeAttempted.current && streamInfo?.protocol === 'http') {
      // eslint-disable-next-line no-void -- intentional fire-and-forget; the fn owns its errors
      void startTranscodeFallback();
      return;
    }
    setError(errorMessage || 'Playback error');
  }, [isLiveStream, startTranscodeFallback, streamInfo?.protocol]);

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

  // TODO(E3): wire these discrete play/pause handlers + SkipButton overlay.
  // Retained as the player-completion entry points; not referenced yet.
  const _handlePlay = () => {
    dispatchPlayerCommand(playerRef, 'play');
    setIsPlaying(true);
    playerSetIsPlaying(true);
    if (isHost) {
      syncPlayService.sendPlay(currentTime);
    }
  };

  const _handlePause = () => {
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

  // Resolve the absolute signed VTT URL for the selected subtitle track ('' = off).
  const selectedSubtitleUrl =
    subtitleTracksState.find((t) => t.id === selectedSubtitleId)?.url ?? '';

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
        {PhlixPlayerView && streamInfo?.url ? (
          <PhlixPlayerView
            ref={playerRef}
            style={styles.player}
            // Prefer the server's signed stream URL: the stream route is gated and
            // the native player gets a bare URI (no Authorization header). Falls
            // back to the unsigned url for older servers.
            src={streamInfo.stream_url || streamInfo.url}
            autoPlay={true}
            startPosition={playerStartPosition}
            volume={1.0}
            muted={false}
            // E3: selected subtitle VTT URL ('' = off). Native rendering is
            // UNTESTED in CI (no device/sim build) — see src/native/types.ts.
            subtitleUrl={selectedSubtitleUrl}
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

      {/* Transcode "Preparing…" overlay */}
      {preparingTranscode && (
        <View style={styles.preparingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.preparingText}>Preparing…</Text>
          {transcodeProgress > 0 && (
            <Text style={styles.preparingProgressText}>
              {Math.round(transcodeProgress)}%
            </Text>
          )}
        </View>
      )}

      {/* Skip Intro / Skip Outro overlay (positions in SECONDS) */}
      <SafeAreaView style={styles.skipButtonsContainer} pointerEvents="box-none">
        <SkipButton
          type="intro"
          marker={
            introMarker
              ? { start: introMarker.start_seconds, end: introMarker.end_seconds }
              : null
          }
          currentTime={currentTime}
          onSkip={handleSeek}
        />
        <SkipButton
          type="outro"
          marker={
            outroMarker
              ? { start: outroMarker.start_seconds, end: outroMarker.end_seconds }
              : null
          }
          currentTime={currentTime}
          onSkip={handleSeek}
        />
      </SafeAreaView>

      {/* Overlay Controls */}
      {showControls && (
        <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.topBarRight}>
              {/* E4: offline badge — shown when playing a local downloaded file */}
              {isOfflineMode && (
                <View style={styles.offlineBadge} accessibilityLabel="Playing offline">
                  <Text style={styles.offlineBadgeText}>⤓ Offline</Text>
                </View>
              )}

              {/* G3: Quality picker — only when a real ladder (>1 choice) exists */}
              {qualityOptions.length > 1 && (
                <TouchableOpacity
                  style={[
                    styles.qualityButton,
                    selectedQuality !== AUTO_QUALITY && styles.qualityButtonActive,
                  ]}
                  onPress={() => setShowQualityMenu(true)}
                  accessibilityLabel="Video quality"
                >
                  <Text style={styles.qualityButtonText}>
                    {activeQualityLabel(qualityOptions, selectedQuality)}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Subtitle (CC) picker — only when tracks are available */}
              {subtitleTracksState.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.syncPlayButton,
                    selectedSubtitleId && styles.syncPlayButtonActive,
                  ]}
                  onPress={() => setShowSubtitlePicker(true)}
                  accessibilityLabel="Subtitles"
                >
                  <Text style={styles.syncPlayButtonText}>CC</Text>
                </TouchableOpacity>
              )}

              {/* P3B-S7: Audio track picker — shown when audio tracks are available */}
              {audioTrackList.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.syncPlayButton,
                    selectedAudioTrackId && styles.syncPlayButtonActive,
                  ]}
                  onPress={() => setShowAudioPicker(true)}
                  accessibilityLabel="Audio tracks"
                >
                  <Text style={styles.syncPlayButtonText}>🎧</Text>
                </TouchableOpacity>
              )}

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

      {/* P3B-S7: Subtitle track picker using contracts v0.3.2 types */}
      <SubtitleTrackList
        visible={showSubtitlePicker}
        tracks={subtitleTrackList}
        selected={selectedSubtitleId}
        onSelect={(trackId) => {
          setSelectedSubtitleId(trackId);
        }}
        onClose={() => setShowSubtitlePicker(false)}
      />

      {/* P3B-S7: Audio track picker using contracts v0.3.2 types */}
      <AudioTrackList
        visible={showAudioPicker}
        tracks={audioTrackList}
        selected={selectedAudioTrackId}
        onSelect={(trackId) => {
          setSelectedAudioTrackId(trackId);
        }}
        onClose={() => setShowAudioPicker(false)}
      />

      {/* G3: Quality picker */}
      <QualityMenu
        visible={showQualityMenu}
        options={qualityOptions}
        selected={selectedQuality}
        onSelect={handleQualitySelect}
        onClose={() => setShowQualityMenu(false)}
      />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  qualityButton: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qualityButtonActive: {
    backgroundColor: 'rgba(0,102,204,0.8)',
  },
  qualityButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  offlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,102,204,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  preparingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  preparingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  preparingProgressText: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
});

export default PlayerScreen;
