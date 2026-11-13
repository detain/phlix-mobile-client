/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
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
  Alert,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { playbackManager } from '../api/PlaybackManager';
import { transcodeManager } from '../api/TranscodeManager';
import { markerManager } from '../api/MarkerManager';
import { libraryManager } from '../api/LibraryManager';
import type { PrepareHandle } from '../api/TranscodeManager';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { StreamInfo, SubtitleTrack, Marker } from '../types/playback';
import type { RootStackParamList } from '../types/navigation';
import type { QualitySelection, Rendition } from '@phlix/contracts';
import { AUTO_QUALITY } from '@phlix/contracts';
import { SeekBar } from '../components/player/SeekBar';
import { SkipButton } from '../components/player/SkipButton';
import { QualityMenu } from '../components/player/QualityMenu';
import { AudioTrackList } from '../components/player/AudioTrackList';
import { SubtitleTrackList } from '../components/player/SubtitleTrackList';
import { SleepTimerMenu, SleepTimerDisplay, useSleepTimer } from '../components/player/SleepTimer';
import { notificationService } from '../services/NotificationService';
import { fireHaptic } from '../utils/haptics';
import { useCellularConnection } from '../utils/useCellularConnection';
import { absolutizeApiPath } from '../api/client';
import {
  buildQualityOptions,
  resolveQualityUrl,
  seedQualitySelection,
  activeQualityLabel,
} from '../components/player/quality';
import { ErrorView } from '../components/ui/ErrorView';
import { downloadService } from '../services/DownloadService';
import { playbackProgressReporter } from '../services/PlaybackProgressReporter';
import type { PlaybackEvent, PhlixPlayerViewProps } from '../native/types';
import {
  syncPlayService,
  type PlaybackCommand,
  type SyncPlayGroup,
  type SyncPlayMember,
  type SyncPlayQueueEntry,
  type SyncPlayChatMessage,
} from '../syncplay/SyncPlayService';
// MW-123: the StyleSheet in this file reads the token family (see
// src/theme/tokens.ts for the law; ESLint pins it).
import { colors } from '../theme/tokens';
import {
  clampSeekSeconds,
  stepSeekSeconds,
  syncReanchorTargetSeconds,
} from '../syncplay/wireUnits';
import { describeSyncPlayError } from '../syncplay/syncplayErrors';
import { useSyncplayStore } from '../store/syncplayStore';
import { resolveNextEpisodeId } from '../utils/autoplayNextEpisode';
import { SyncPlayModal, SyncPlayOverlay } from '../components/syncplay';

/** Window in which an identical SyncPlay failure is Alerted once, not per
 * frame (review mobile__casualgamer m12). Distinct failures are unaffected. */
const ERROR_ALERT_COALESCE_MS = 5000;

/** How long a membership announcement (joined/left/host) rides the SyncPlay
 * overlay before the line falls back to the connection rail / member
 * count (MW-101 — the rails were write-only: no viewer ever saw a
 * departure, a arrival, or the fact that the party socket had dropped). */
const MEMBERSHIP_NOTICE_MS = 4000;

// M-MOBILE-90 (review mobile__crossfe Minor 17): the local
// `NativePhlixPlayerProps` shadow — every event typed `any`, duplicating what
// src/native/types.ts already ships — is deleted; the screen now consumes the
// canonical PhlixPlayerViewProps (NativeSyntheticEvent-typed handlers, style).
// The ref seam is the requireNativeComponent typing gap (v0.85 has no ref in
// the generated component type), kept as an explicit local intersection.
type PhlixPlayerComponentProps = PhlixPlayerViewProps & {
  ref?: React.RefObject<any>;
};

// Native player component - only works when native module is properly linked
let PhlixPlayerView: React.ComponentType<PhlixPlayerComponentProps> | null = null;
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

// S293: SyncPlay wire positions are MILLISECONDS (phlix-syncplay SPEC.md:91).
// `currentTime` is SECONDS — convert at the SEND boundary only; the internal
// seconds state and the native player keep seconds.
const toSyncPlayPositionMs = (seconds: number): number => seconds * 1000;

/**
 * S407 NAMED REFUSAL (audio tracks): the picker persists the viewer's choice
 * to the store, but APPLYING it to the native player is unsupported — the JS
 * bridge exposes no audio-selection surface at all:
 *  - iOS exports exactly 9 props (src/autoPlay/startPosition/volume/muted/
 *    subtitleUrl/onPlaybackEvent/onProgress/onError) and 7 commands
 *    (play/pause/seekTo/updateVolume/updateMuted/startPiP/stopPiP) —
 *    `ios/LocalPods/PhlixPlayer/PhlixPlayerViewManager.m`, no
 *    `selectMediaOption`/`AVAudioMediaSelectionOption` anywhere in the pod.
 *  - Android `receiveCommand` handles ONLY play|pause|seekTo|setVolume|setMuted
 *    — `android/app/src/main/java/com/phlixmobile/player/PhlixPlayerViewManager.kt`.
 * Inventing a native method is out of bounds; the refusal is stated visibly at
 * the picker instead. `src/screens/__tests__/NativeAudioSelectionBoundary.test.ts`
 * pins the real bridge surface — if a native audio API ever lands, that test
 * goes RED and this constant must be retired with it.
 *
 * ROADMAP (MOB-40): a real fix needs a native track-switch command on both
 * platforms (iOS AVMediaSelectionGroup, Android ExoPlayer track selection) plus
 * a JS bridge method; until then this honest copy stays. Not built here.
 */
export const AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE =
  'Choosing a track here remembers it as your preference — it does NOT change the audio you are hearing. The native player exposes no track-switching command yet, so the choice cannot reach the live stream; it will apply once the player supports switching.';

/**
 * P5-S5 (w36L4-MAJOR-1 cure): detect the server's playback-lane access denials —
 * 403 `access.scheduled` and 429 `stream.limit_exceeded` — and map them to a
 * friendly Alert sentence. Returns { isAccessError, message } when detected,
 * otherwise null.
 *
 * Wire-contract law: the STABLE registered error CODE (phlix-contracts
 * dist/error-codes.json) is the primary key; the server's English `error`
 * text is a legacy fallback for pre-code servers only. Same code-primary /
 * text-fallback shape as @phlix/ui's src/pages/playerErrors.ts.
 *
 * Provenance of the frozen bytes (server, at this wave's tips):
 *  - 403: src/Server/Http/Middleware/AccessScheduleMiddleware.php :112/:122/:130
 *    ->error(403, 'access.scheduled', 'AccessScheduled', ['message' => …])
 *    (Response::error renders {error: <message>, code: <code>, …extra}).
 *  - 429: src/Server/Http/Middleware/StreamLimitMiddleware.php :139 and
 *    src/Server/Http/FastPath/PreRouterFastPaths.php :599-606 both emit
 *    {error:'StreamLimitExceeded', code:'stream.limit_exceeded', …}.
 *
 * History: the original arm strict-matched `error === 'AccessSchedule'` — a
 * byte string NO server ever emitted (the middleware ships 'AccessScheduled'),
 * so the friendly access-denied Alert was a born-broken dead branch. The cure
 * keys on the code and keeps the EXACT server text as the only legacy match.
 */
function detectAccessStreamError(error: unknown): { isAccessError: boolean; message: string } | null {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: { status?: number; data?: { error?: string; code?: string } };
    };
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    // 403 access schedule — code is the contract; 'AccessScheduled' is the
    // server's exact legacy message text (fallback for payloads without code).
    if (status === 403 && (data?.code === 'access.scheduled' || data?.error === 'AccessScheduled')) {
      return { isAccessError: true, message: 'Playback blocked by access schedule. Try again during allowed hours.' };
    }
    // 429 stream limit — same code-primary / legacy-text-fallback law.
    if (status === 429 && (data?.code === 'stream.limit_exceeded' || data?.error === 'StreamLimitExceeded')) {
      return { isAccessError: true, message: 'Stream limit reached. Stop another stream to continue watching.' };
    }
  }
  return null;
}

const PlayerScreen: React.FC = () => {
  // MW-014 (review mobile__crossfe): typed by the GLOBAL RootStackParamList
  // — 'Player' is registered on the root stack (RootNavigator.tsx:530). The
  // deleted local twin duplicated the identical shape and could drift from
  // the navigator without any compiler noticing; the E8 additive live
  // fields (streamUrl/liveTitle) now ride the single declaration in
  // src/types/navigation.ts:20-25.
  const route = useRoute<RouteProp<RootStackParamList, 'Player'>>();
  const navigation = useNavigation();
  const { itemId, startPosition = 0, streamUrl: directStreamUrl, liveTitle } =
    route.params;
  // E8: live-stream mode is driven SOLELY by a present `streamUrl` param — the
  // existing itemId playback path is untouched when this is absent.
  const isLiveStream = typeof directStreamUrl === 'string' && directStreamUrl !== '';

  // M-MOBILE-44: the chrome never said WHAT is playing. Live streams carry
  // their display title as a route param (liveTitle — previously dead copy);
  // on-demand titles are resolved in-player from itemId so no caller has to
  // thread the string through every navigate() site. Fail-soft: an offline
  // download or a failed lookup simply renders no title, never an error.
  const [mediaTitle, setMediaTitle] = useState<string | null>(liveTitle ?? null);
  useEffect(() => {
    if (liveTitle || isLiveStream || !itemId) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => libraryManager.getMediaItem(itemId))
      .then((item) => {
        if (!cancelled && item && typeof item.name === 'string' && item.name) {
          setMediaTitle(item.name);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [itemId, liveTitle, isLiveStream]);

  // MW-107 (review mobile__gameux #7): the chrome's geometry must come from
  // the LIVE safe-area insets, not hardcoded edges. The status bar is hidden
  // in this fullScreenModal, so the insets are all the chrome has to stand
  // on — and they rotate: in landscape the cutout lands on the leading/
  // trailing edge (M-MOBILE-39 lesson: never assume the notch sits at the
  // top), which the old fixed 20pt paddings ignored entirely.
  const insets = useSafeAreaInsets();

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
  // C17 (review mobile__gameux): live mirrors of duration/isPlaying so the
  // resume reporter can read truth at event boundaries (forced pause report,
  // unmount flush) without stale closures — same pattern as currentPositionRef.
  const durationRef = useRef(0);
  /** m12 — per-failure Alert timestamps (identical code+sentence inside the
   * coalescing window are logged, not stacked). */
  const errorAlertTimesRef = useRef<Map<string, number>>(new Map());
  // MW-101: the transient membership sentence shown on the overlay pill.
  const [membershipNotice, setMembershipNotice] = useState<string | null>(null);
  const membershipNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  // E4: offline-mode flag — true when playing a local downloaded file. Surfaces
  // a small "Offline" badge in the top bar.
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  // M3 (deferred lane): live cellular verdict for the data-plan banner — the
  // viewer can now SEE that playback is spending mobile data (the old app
  // had no network-type API at all, which is why the Wi-Fi-only setting was
  // removed as theater in M-MOBILE-01). Downloads have the hard gate; a video
  // in progress must never be killed mid-watch, so the player guards with a
  // NOTICE, not a block.
  const onCellular = useCellularConnection();

  // ── M14 (deferred lane): the playback-notification methods on
  // notificationService were DEAD code (zero call sites). Wired here to the
  // native 'play'/'pause'/'ended' events; the enableNotifications setting is
  // what makes the toggle real for this lane too. Android gets the ongoing
  // LOW-importance notification; media3 AudioFocus + wake mode are set on the
  // native side (PhlixPlayerView.kt). Full media3 MediaSession / lock-screen
  // controls and iOS MPNowPlayingInfoCenter remain companion follow-ups.
  //
  // Review Major 2 cure: that Android-only intent is now ENFORCED, not just
  // commented. A bare notifee displayNotification on iOS posts a REAL
  // UNUserNotificationCenter banner (the ongoing/channelId fields are
  // Android-only; presentation is not), and requestPermissions() prompts the
  // OS at first play — so out-of-the-box iOS got a permission alert plus a
  // "Now Playing"/"Paused" banner on every transition. The whole playback
  // lane gates on Platform below until MPNowPlayingInfoCenter ships.
  // Jest pins BOTH platforms (PlayerScreen.test.tsx): the iOS no-display
  // pin measured red pre-cure.
  const playbackNotifAskedRef = useRef(false);
  const playbackNotifVisibleRef = useRef(false);
  // Review Minor 2 cure: generation counter for the in-flight first-ask.
  // Every transition after the requestPermissions() prompt opened bumps it,
  // so a late grant resolve may only display while its generation is still
  // current — pausing during the OS prompt used to resurrect a "Now Playing"
  // banner for paused media (the pending .then only re-read visibleRef, which
  // the pause arm never clears).
  const playbackNotifGenRef = useRef(0);
  const updatePlaybackNotification = useCallback((playing: boolean) => {
    if (Platform.OS !== 'android') {
      return; // M14 is an Android-only lane until NowPlaying lands (see above)
    }
    if (!useSettingsStore.getState().enableNotifications) {
      return; // toggle OFF == no playback notification, same doctrine as downloads
    }
    const title = mediaTitle ?? 'Phlix';
    if (playing) {
      playbackNotifVisibleRef.current = true;
      if (playbackNotifAskedRef.current) {
        notificationService.showPlaybackNotification(title, true);
        return;
      }
      // M-MOBILE-72 doctrine: ask at the first moment the notification matters.
      playbackNotifAskedRef.current = true;
      const generation = ++playbackNotifGenRef.current;
      notificationService
        .requestPermissions()
        .then((granted) => {
          if (
            granted &&
            playbackNotifVisibleRef.current &&
            playbackNotifGenRef.current === generation
          ) {
            notificationService.showPlaybackNotification(title, true);
          }
        })
        .catch(() => undefined);
      return;
    }
    playbackNotifGenRef.current += 1; // void any in-flight first-ask resolve
    if (playbackNotifVisibleRef.current) {
      notificationService.showPlaybackNotification(title, false);
    }
  }, [mediaTitle]);
  const dismissPlaybackNotification = useCallback(() => {
    if (!playbackNotifVisibleRef.current) {
      return;
    }
    playbackNotifVisibleRef.current = false;
    notificationService.cancelPlaybackNotification();
  }, []);
  useEffect(
    () => () => {
      // Screen teardown (back / autoplay replace / app quit) must not leave a
      // stale ongoing "Now Playing" behind.
      if (playbackNotifVisibleRef.current) {
        playbackNotifVisibleRef.current = false;
        notificationService.cancelPlaybackNotification();
      }
    },
    [],
  );

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
  // M-MOBILE-01 (review mobile__casualgamer): the Autoplay setting used to be
  // theater — persisted, rendered, read by nothing while the view below
  // hardcoded autoPlay={true}. It now owns the native start-immediately prop
  // (default ON == the old hardcoded truth; flipping it means manual start).
  const autoplayEnabled = useSettingsStore((state) => state.autoplay);
  const [qualityVariants, setQualityVariants] = useState<Rendition[]>([]);
  const [qualityMasterUrl, setQualityMasterUrl] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<QualitySelection>(AUTO_QUALITY);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityOptions = buildQualityOptions(qualityVariants, qualityMasterUrl);

  // ── E3 + S407: track rails — ONE source of truth: the player store ───────
  // S407 killed the dead local mirrors that used to sit here: the pickers read
  // the SAME store lists the buttons gate on and the subtitleUrl find() resolves
  // against (feeding the modal a different list was the CC-button/picker duality
  // bug — the button appeared while the picker stayed empty). Never reintroduce
  // a parallel list.
  const subtitleTracksState = usePlayerStore((state) => state.subtitleTracks);
  const selectedSubtitleId = usePlayerStore((state) => state.currentSubtitleTrackId);
  const setSelectedSubtitleId = usePlayerStore((state) => state.setCurrentSubtitleTrackId);
  const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);

  const audioTracksState = usePlayerStore((state) => state.audioTracks);
  const selectedAudioTrackId = usePlayerStore((state) => state.currentAudioTrackId);
  const setSelectedAudioTrackId = usePlayerStore((state) => state.setCurrentAudioTrackId);
  const [showAudioPicker, setShowAudioPicker] = useState(false);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<any>(null);

  // Store actions
  const setPlayerStreamInfo = usePlayerStore((state) => state.setStreamInfo);
  const setSubtitleTracks = usePlayerStore((state) => state.setSubtitleTracks);
  const setAudioTracks = usePlayerStore((state) => state.setAudioTracks);
  const playerSetDuration = usePlayerStore((state) => state.setDuration);
  const playerSetIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  // MOB-10: buffering feedback — the store rail's one real reader (drives the
  // stall spinner below); written by the native 'buffering' event.
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const playerSetIsBuffering = usePlayerStore((state) => state.setIsBuffering);

  // SyncPlay state
  const [showSyncPlayOverlay, setShowSyncPlayOverlay] = useState(false);
  const currentGroup = useSyncplayStore((state) => state.currentGroup);
  const isHost = useSyncplayStore((state) => state.isHost);
  const updatePlaybackState = useSyncplayStore((state) => state.updatePlaybackState);

  // ── P3-S4: Sleep Timer state ─────────────────────────────────────────────
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const { remainingSeconds, startTimer } = useSleepTimer(() => {
    // Fire: pause playback when timer expires
    dispatchPlayerCommand(playerRef, 'pause');
    setIsPlaying(false);
    playerSetIsPlaying(false);
  });

  // ── P3-S4: Picture-in-Picture ─────────────────────────────────────────────
  const handleStartPiP = () => {
    dispatchPlayerCommand(playerRef, 'startPiP');
  };

  // SyncPlay effect - attach command/error listeners and (only when a group
  // exists) keep the socket warm for this item.
  useEffect(() => {
    // Real authenticated identity (audit H4): the server derives membership
    // from the JWT subject and answers group_state with `your_id`; the old
    // fabricated `mobile_${itemId}` string could NEVER match the host id, so
    // mobile users were permanently non-host. `yourId` in the service is
    // authoritative once a snapshot lands; this is the pre-snapshot claim.
    const memberId = useAuthStore.getState().user?.id ?? '';

    // Set up SyncPlay event handlers.
    //
    // C2 (review mobile__asphp): the host check reads the store AT DISPATCH
    // TIME. The old code closed over the render-time `isHost` from the single
    // mount run of this effect ([itemId] deps), so a viewer who joined the
    // group later — or was promoted by the host-elect — followed commands
    // forever as if frozen, and a demoted host kept ignoring them. The store
    // subscription below still drives the UI's isHost rendering; this is the
    // command-path authority the same frame of truth.
    const handleSyncPlayCommand = (cmd: PlaybackCommand) => {
      if (!useSyncplayStore.getState().isHost) {
        // Non-host members follow playback commands from host
        //
        // MW-118 (review mobile__crossfe Critical): every room command
        // carries the authoritative position — play/pause included, not just
        // explicit seeks. The old play/pause arms dropped it, so the
        // playback_sync echo and the directed S446 nudge never moved the
        // native player (the noteLocalPosition loop that feeds
        // reportPosition — the drift source — was meanwhile keeping the
        // LOCAL clock looking healthy). Re-anchor first, then apply the
        // state change: resume happens AT the room position, in that order.
        // Group echoes seek only past the tolerance window (small local
        // deltas are in-sync by the server's own law — no audible churn);
        // a forceReanchor (nudge) command seeks unconditionally. The target
        // passes the SAME M-MOBILE-27 clamp the seek arm uses — this is the
        // last stop before the native module.
        const reanchorSeconds =
          cmd.type === 'seek'
            ? null
            : syncReanchorTargetSeconds(
                cmd.position,
                currentPositionRef.current,
                cmd.forceReanchor === true
              );
        if (reanchorSeconds !== null) {
          const anchorTarget = clampSeekSeconds(reanchorSeconds, durationRef.current);
          dispatchPlayerCommand(playerRef, 'seekTo', [anchorTarget]);
          setCurrentTime(anchorTarget);
        }
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
            // S441 — `cmd.position` arrives in app-internal SECONDS: the wire's
            // ms were decoded once at the SyncPlayService boundary, so it feeds
            // the native `seekTo` (a seconds API) with no unit math here.
            // M-MOBILE-27: decoded is not the same as HONORABLE — a hostile or
            // buggy host can send a finite-but-absurd position (1e303), which
            // iOS turns into an invalid CMTime (stall) and Android into a
            // saturating Long. Clamp against the known duration at THIS
            // boundary; it is the last stop before the native module.
            {
              const seekTarget = clampSeekSeconds(cmd.position, durationRef.current);
              dispatchPlayerCommand(playerRef, 'seekTo', [seekTarget]);
              setCurrentTime(seekTarget);
            }
            break;
        }
      }
    };

    // m12 (review mobile__casualgamer): a flapping group can emit the SAME
    // failure every reconnect tick — an Alert per frame is an unusable modal
    // machine-gun. Identical code+sentence within the coalescing window are
    // logged, not stacked; distinct failures still surface immediately.
    const handleSyncPlayError = (code: string, message: string) => {
      console.warn(`SyncPlay error [${code}]: ${message}`);
      // Error-code-first doctrine: surface the failure to the viewer through
      // the repo's transient-feedback idiom (Alert, as used by the access-
      // schedule / stream-limit denial arms in this file). The catalog
      // picks the sentence from the stable wire code; the server's English
      // text is only a fallback (and quarantined — review mobile__exploiter
      // M7 — inside describeSyncPlayError).
      const sentence = describeSyncPlayError(code, message);
      const key = `${code}\u0000${sentence}`;
      const now = Date.now();
      const last = errorAlertTimesRef.current.get(key);
      if (last !== undefined && now - last < ERROR_ALERT_COALESCE_MS) {
        return; // already on screen for this exact failure
      }
      errorAlertTimesRef.current.set(key, now);
      Alert.alert('SyncPlay error', sentence);
    };

    // MW-101: membership visibility. These three events were emitted by the
    // service into the void — the party saw NOBODY leave, join, or change
    // host, and could not tell a flapping connection from a quiet room.
    // One notice rides the overlay pill at a time; a later event replaces
    // the sentence AND restarts the expiry clock.
    const showMembershipNotice = (sentence: string) => {
      if (membershipNoticeTimerRef.current !== null) {
        clearTimeout(membershipNoticeTimerRef.current);
      }
      setMembershipNotice(sentence);
      membershipNoticeTimerRef.current = setTimeout(() => {
        membershipNoticeTimerRef.current = null;
        setMembershipNotice(null);
      }, MEMBERSHIP_NOTICE_MS);
    };
    const handleMemberJoin = (member: SyncPlayMember) => {
      showMembershipNotice(`${member.name} joined`);
    };
    const handleMemberLeft = (_memberId: string, memberName: string) => {
      showMembershipNotice(`${memberName} left`);
    };
    const handleHostChanged = (newHostId: string) => {
      // The NEW snapshot is already in the store at emit time, so this is
      // the one roster lookup that CAN read names.
      const host = useSyncplayStore
        .getState()
        .currentGroup?.members.find((m) => m.id === newHostId);
      showMembershipNotice(host ? `${host.name} is now the host` : 'Host changed');
    };

    // MW-125 (review mobile__crossfe #2): the autoplay guard below says out
    // loud that "the SyncPlay group owns media selection, not this screen" —
    // but until now nothing on the screen ACTED on that ownership. The host
    // changing the party's title decoded into the store and fired
    // onGroupStateUpdate into a void. The phone follows through the same
    // replace() seam autoplay-next uses: Back does not stack one hop per
    // media change, and the room's position anchors the new title.
    const handleGroupMediaChange = (group: SyncPlayGroup) => {
      // null = the room carries no media (server omitted the field — an
      // empty room); equal = we are already watching it (the ~5s group echo
      // is a re-broadcast, not a change). Only a genuine difference follows.
      if (group.currentMediaId === null || group.currentMediaId === itemId) {
        return;
      }
      const nav = navigation as {
        replace?: (name: string, params: RootStackParamList['Player']) => void;
      };
      // S441: the store speaks SECONDS and the route param speaks SECONDS —
      // the snapshot anchor is already decoded at the service boundary, so it
      // threads through untouched; no re-conversion here.
      nav.replace?.('Player', { itemId: group.currentMediaId, startPosition: group.playbackPosition });
    };

    // The queue snapshot rides the overlay notice rail — mobile has no queue
    // surface yet; one replaced sentence on the MW-101 clock is the honest
    // disclosure, and the store rail keeps the FULL list for whoever mounts
    // one (the event→store write happened in the service before this fires).
    const handleQueueUpdate = (entries: SyncPlayQueueEntry[]) => {
      if (entries.length === 0) {
        showMembershipNotice('Queue cleared');
        return;
      }
      const next = entries[0];
      const label = next.name ?? `${next.mediaId.slice(0, 8)}…`;
      showMembershipNotice(`Queue updated — ${entries.length} items — next: ${label}`);
    };

    // Chat lines ride the same rail, sender resolved from the roster AT EVENT
    // TIME — the MW-101/handleHostChanged law (the emitting snapshot is
    // already in the store; the wire member_id is meaningless to a viewer).
    const handleChatMessage = (chat: SyncPlayChatMessage) => {
      const sender = useSyncplayStore.getState().currentGroup?.members.find((m) => m.id === chat.memberId);
      const text = chat.message.length > 60 ? `${chat.message.slice(0, 59)}…` : chat.message;
      showMembershipNotice(`${sender?.name ?? 'Unknown'}: ${text}`);
    };

    syncPlayService.on('onPlaybackCommand', handleSyncPlayCommand);
    syncPlayService.on('onError', handleSyncPlayError);
    syncPlayService.on('onMemberJoined', handleMemberJoin);
    syncPlayService.on('onMemberLeft', handleMemberLeft);
    syncPlayService.on('onHostChanged', handleHostChanged);
    syncPlayService.on('onGroupStateUpdate', handleGroupMediaChange);
    syncPlayService.on('onQueueUpdate', handleQueueUpdate);
    syncPlayService.on('onChatMessage', handleChatMessage);

    // Gate (audit M5): opening a player is not joining a group. The socket
    // must ONLY exist while a SyncPlay group is active — group join/create
    // connect through `SyncPlayModal` → `connectWithRoom`. Previously every
    // mount dialed the SyncPlay listener for a roomless session.
    if (memberId !== '' && useSyncplayStore.getState().currentGroup !== null) {
      syncPlayService.connect(memberId);
    }

    return () => {
      // C4 (review mobile__asphp): handlers unregister by IDENTITY, so this
      // unmount cannot evict a successor screen's freshly-registered pair,
      // and the SOCKET only comes down when the viewer is truly out of the
      // group. The old unconditional disconnect() wiped the store mid-
      // party whenever the player remounted (rotate→relaunch, episode
      // advance): the member lost their own watch party.
      syncPlayService.off('onPlaybackCommand', handleSyncPlayCommand);
      syncPlayService.off('onError', handleSyncPlayError);
      syncPlayService.off('onMemberJoined', handleMemberJoin);
      syncPlayService.off('onMemberLeft', handleMemberLeft);
      syncPlayService.off('onHostChanged', handleHostChanged);
      syncPlayService.off('onGroupStateUpdate', handleGroupMediaChange);
      syncPlayService.off('onQueueUpdate', handleQueueUpdate);
      syncPlayService.off('onChatMessage', handleChatMessage);
      if (membershipNoticeTimerRef.current !== null) {
        clearTimeout(membershipNoticeTimerRef.current);
        membershipNoticeTimerRef.current = null;
      }
      if (useSyncplayStore.getState().currentGroup === null) {
        syncPlayService.disconnect();
      }
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
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // C17 (review mobile__gameux): quitting mid-play must not lose the tail the
  // 15s throttle has not checkpointed yet. The reporter flushes its retained
  // snapshot (refreshed from the live refs) on teardown — the phone's final
  // position reaches the server so Resume/Continue-Watching see it. Live TV has
  // no VOD resume semantics, so the whole lifecycle is skipped there.
  useEffect(() => {
    return () => {
      if (isLiveStream) {
        return;
      }
      playbackProgressReporter
        .flush({
          mediaItemId: itemId,
          positionSeconds: currentPositionRef.current,
          durationSeconds: durationRef.current,
          paused: !isPlayingRef.current,
        })
        .catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // M-MOBILE-44 first clause (r2): what hides at 3s is the CHROME — top bar,
  // center controls, scrim. The progress rail (styles.progressRail, rendered
  // outside this gate below) deliberately SURVIVES the auto-hide: the finding
  // was that the bar was "part of what hides", leaving the player with zero
  // progress indication while playing.
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
      // S407: every load starts from empty rails; playback-info (loadMarkers)
      // is the one direct-play feeder and a transcode replaces the subtitle
      // rail. Clearing here (not mid-stream) keeps a single writer per phase.
      setSubtitleTracks([]);
      setAudioTracks([]);
      setSelectedSubtitleId(null);
      setSelectedAudioTrackId(null);
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
      // S407: no rail writes here. The direct-play rails come from the
      // playback-info response loadMarkers feeds into the store; the old `[]`
      // writes here raced that feeder and are why the pickers stayed empty.
      setPlayerStreamInfo(onlineStreamInfo);
    } catch (err) {
      // P5-S5: Check for access-schedule / stream-limit errors first.
      const accessError = detectAccessStreamError(err);
      if (accessError) {
        Alert.alert('Playback error', accessError.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch intro/outro markers (SECONDS) for the SkipButton overlay via the
   * one-call playback-info route. Non-fatal: a failure just means no skip UI.
   *
   * S407: the SAME response carries `audio_tracks`/`subtitle_tracks` (the
   * server always emits both keys — MediaItemController::getPlaybackInfo
   * verified at 01340633, re-verified at the v0.5.7-era server a63dc0db), so
   * this is the direct-play rails' ONE feeder —
   * consume it here, do not re-fetch elsewhere. Precedence: a transcode rail
   * (synth rows from the job's VTT set, see startTranscodeFallback) OWNS the
   * subtitle list once the job started — a late playback-info response must not
   * roll it back to rows describing the container that failed to direct-play.
   * Audio rails have no transcode counterpart: this feeder owns them outright,
   * including the clear on failure (stale previous-item rows must not linger).
   */
  const loadMarkers = async () => {
    try {
      const info = await markerManager.getPlaybackInfo(itemId);
      setIntroMarker(info.intro_marker);
      setOutroMarker(info.outro_marker);
      setAudioTracks(info.audio_tracks);
      if (!transcodeAttempted.current) {
        setSubtitleTracks(info.subtitle_tracks);
      }
    } catch {
      setIntroMarker(null);
      setOutroMarker(null);
      setAudioTracks([]);
      if (!transcodeAttempted.current) {
        setSubtitleTracks([]);
      }
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
      // playjump incident class: the fallback swap obeys the SAME G3 finding-1
      // law `handleQualitySelect` owns — a native player restarts the item from
      // `startPosition` on a `src` change, so re-point it at the LIVE playback
      // position read from `currentPositionRef` BEFORE swapping. Without this a
      // mid-play direct→transcode flip (e.g. an expired signed URL) jumped back
      // to the mount-time resume point, or to 0 on a fresh play.
      const resumeAt = Math.max(0, currentPositionRef.current || 0);
      setPlayerStartPosition(resumeAt);
      setStreamInfo(hlsStreamInfo);
      setPlayerStreamInfo(hlsStreamInfo);

      // Expose the signed VTT tracks from the transcode response as a picker.
      // S404: rows carry the honest wire `SubtitleTrack` shape (the
      // StreamTrackShaper emission; re-verified at contracts v0.5.7's
      // wire-truth rewrite — every subtitle row the server shapes carries
      // `delivery: 'external'` (S507/AD-8: subtitles reach the player as
      // signed sidecar URLs, never muxed), so these rows do too).
      // These particular rows are client-synthesised from the transcode
      // `subtitles[]` envelope (`{language,url}`): ordinals are positional,
      // `label` takes the server's display-string slot (exactly what the old
      // fictional `display_title` held — display behavior unchanged), and
      // `source` marks the client-side provenance.
      // S407 reconciliation (the handoff note above is now resolved): a
      // transcode REPLACES the playback-info subtitle rail, it does not merge
      // with it — the playable source is now the HLS master and only THESE
      // rows describe its subtitles. loadMarkers honours this precedence
      // (skips its subtitle feed once `transcodeAttempted.current` is set).
      const tracks: SubtitleTrack[] = subtitles.map((s, i) => ({
        id: `tx-${i}`,
        index: i,
        stream_index: i,
        language: s.language,
        label: s.language,
        codec: 'vtt',
        source: 'transcode',
        delivery: 'external',
        hearing_impaired: false,
        url: s.url,
      }));
      setSubtitleTracks(tracks);
      setSelectedSubtitleId(null);
    } catch (err) {
      // P5-S5: Check for access-schedule / stream-limit errors first.
      const accessError = detectAccessStreamError(err);
      if (accessError) {
        Alert.alert('Playback error', accessError.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      // A cancel (unmount) should not surface an error to the user.
      const message = err instanceof Error ? err.message : 'Transcode failed';
      if (message !== 'Transcode preparation cancelled') {
        setError(message);
      }
    } finally {
      prepareHandleRef.current = null;
      setPreparingTranscode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, defaultQuality, setSubtitleTracks, setSelectedSubtitleId, setPlayerStreamInfo, navigation]);

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

  // ── M-MOBILE-15: Autoplay-next-episode — the toggle's ONLY reader ────────
  // The setting persisted at SettingsScreen since its birth but nothing ever
  // consumed it (settings theater). On a real 'ended' of a normal VOD item we
  // resolve the positional next episode (utils/autoplayNextEpisode, a pure
  // mirror of the server NextUpSelector ordering law over the existing
  // /media/{id} + /media?parentId= wire — no new endpoints, no new codes) and
  // replace() into it. Every guard lives here; ANY failure degrades to the
  // stop-behavior this screen had before (that IS the toggle-off behavior).
  //
  // One-shot keyed by itemId: the resolution attempt is registered BEFORE the
  // async fetch, so a failed next-load can never retry-storm (a second
  // 'ended' for the same item is refused; arriving at the next item re-arms
  // because its id differs). Reads go through getState() at event time — no
  // new subscription, no re-render coupling.
  const autoplayAttemptedForRef = useRef<string | null>(null);
  const maybeAutoplayNextEpisode = useCallback(() => {
    if (isLiveStream) {
      return; // live / direct-URL streams have no "next"
    }
    if (useSyncplayStore.getState().currentGroup !== null) {
      return; // the SyncPlay group owns media selection, not this screen
    }
    if (useSettingsStore.getState().autoPlayNextEpisode !== true) {
      return; // toggle OFF (or a legacy snapshot without the key): stop
    }
    if (autoplayAttemptedForRef.current === itemId) {
      return; // already tried for this item: no retry storm
    }
    autoplayAttemptedForRef.current = itemId;
    resolveNextEpisodeId(itemId)
      .then((nextId) => {
        if (nextId === null) {
          return; // movie / finale / unanchored: the old stop-behavior
        }
        // replace() (not push): the finished episode leaves the stack, so
        // Back returns to where the viewer came from, across one-episode-
        // at-a-time binges. Typed via the route params; optional-call keeps
        // any container shape safe.
        const nav = navigation as {
          replace?: (name: string, params: RootStackParamList['Player']) => void;
        };
        nav.replace?.('Player', { itemId: nextId, startPosition: 0 });
      })
      .catch(() => undefined); // wire failure → silent stop, never an Alert ambush at episode end
  }, [isLiveStream, itemId, navigation]);

  const handlePlaybackEvent = useCallback((event: NativeSyntheticEvent<PlaybackEvent>) => {
    const { event: playbackEvent, currentTime: ct, duration: dur } = event.nativeEvent;
    // MOB-10: every non-buffering event means the stall (if any) is over.
    playerSetIsBuffering(playbackEvent === 'buffering');
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
        // M14 (deferred lane): ongoing "Now Playing" notification (settings-gated).
        updatePlaybackNotification(true);
        // C17: a resumed tick bypasses the throttle so the server row flips
        // out of `paused` at the transition, not at the next 15s window.
        if (!isLiveStream) {
          playbackProgressReporter
            .report(
              {
                mediaItemId: itemId,
                positionSeconds: ct ?? currentPositionRef.current,
                durationSeconds: dur ?? durationRef.current,
                paused: false,
              },
              true,
            )
            .catch(() => undefined);
        }
        break;
      case 'pause':
        setIsPlaying(false);
        playerSetIsPlaying(false);
        updatePlaybackNotification(false);
        // C17: a pause is the resume point — capture it immediately.
        if (!isLiveStream) {
          playbackProgressReporter
            .report(
              {
                mediaItemId: itemId,
                positionSeconds: ct ?? currentPositionRef.current,
                durationSeconds: dur ?? durationRef.current,
                paused: true,
              },
              true,
            )
            .catch(() => undefined);
        }
        break;
      case 'ended':
        setIsPlaying(false);
        playerSetIsPlaying(false);
        dismissPlaybackNotification();
        // C17: the explicit finish signal (POST /sessions/{id}/complete,
        // reached_end=true) — the only thing that marks the item watched,
        // drops it from Continue Watching, and finalizes watch-time stats.
        if (!isLiveStream) {
          playbackProgressReporter.complete(itemId).catch(() => undefined);
          // M-MOBILE-15: the Auto-play-next toggle's one and only reader. The
          // guards (toggle/live/group/one-shot) live in the callback; the
          // fallback for every refusal is exactly the stop-behavior above.
          maybeAutoplayNextEpisode();
        }
        break;
      case 'buffering':
        // Spinner is rendered from the store's isBuffering (set above).
        break;
    }
    if (ct !== undefined) {
      setCurrentTime(ct);
    }
  }, [isLiveStream, itemId, playerSetDuration, playerSetIsPlaying, playerSetIsBuffering, maybeAutoplayNextEpisode, updatePlaybackNotification, dismissPlaybackNotification]);

  const handleProgress = useCallback((event: NativeSyntheticEvent<{ currentTime: number; duration: number }>) => {
    const { currentTime: ct, duration: dur } = event.nativeEvent;
    setCurrentTime(ct);
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
      playerSetDuration(dur);
    }
    // C17: every tick feeds the reporter; the session/throttle logic lives in
    // the reporter (sub-floor and in-flight ticks are cheap no-ops there).
    if (!isLiveStream) {
      playbackProgressReporter
        .report({
          mediaItemId: itemId,
          positionSeconds: ct,
          durationSeconds: dur,
          paused: !isPlayingRef.current,
        })
        .catch(() => undefined);
      // C3 (review mobile__asphp): the SAME tick is the only place the phone
      // knows where its video sits, and until now that never reached the
      // group — reportPosition had zero callers, so this member's drift was
      // invisible to the host re-anchor (S291) and the S446 policy. The
      // service owns the cadence (≥2 s); this arm just feeds it wire-ms
      // (S293: convert once at the send boundary).
      syncPlayService.noteLocalPosition(toSyncPlayPositionMs(ct));
    }
  }, [duration, isLiveStream, itemId, playerSetDuration]);

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

  // MOB-15: a grouped member's pause/play is LOCAL only; say so at the
  // button (mirrors the seek bar's member hint) for a few seconds.
  const [memberPauseHint, setMemberPauseHint] = useState(false);
  const memberPauseHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (memberPauseHintTimer.current) clearTimeout(memberPauseHintTimer.current);
    },
    [],
  );

  const handlePlayPause = () => {
    // MOB-53: light tick on play/pause toggle (Android; iOS no-op per haptics.ts).
    fireHaptic('light');
    if (isHost) {
      // Host controls directly and broadcasts to group
      if (isPlaying) {
        dispatchPlayerCommand(playerRef, 'pause');
        setIsPlaying(false);
        playerSetIsPlaying(false);
        syncPlayService.sendPause(toSyncPlayPositionMs(currentTime));
      } else {
        dispatchPlayerCommand(playerRef, 'play');
        setIsPlaying(true);
        playerSetIsPlaying(true);
        syncPlayService.sendPlay(toSyncPlayPositionMs(currentTime));
      }
    } else {
      // Non-hosts just control locally (playback is controlled by host)
      if (currentGroup !== null) {
        setMemberPauseHint(true);
        if (memberPauseHintTimer.current) clearTimeout(memberPauseHintTimer.current);
        memberPauseHintTimer.current = setTimeout(() => setMemberPauseHint(false), 4000);
      }
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
      syncPlayService.sendPlay(toSyncPlayPositionMs(currentTime));
    }
  };

  const _handlePause = () => {
    dispatchPlayerCommand(playerRef, 'pause');
    setIsPlaying(false);
    playerSetIsPlaying(false);
    if (isHost) {
      syncPlayService.sendPause(toSyncPlayPositionMs(currentTime));
    }
  };

  /**
   * THE single seek choke point — every seek surface (the M-MOBILE-13 scrub bar
   * commit, the ±15 buttons, SkipButton intro/outro jumps) lands here, so the
   * SyncPlay group law is enforced exactly once:
   *  - Ungrouped: plain local seek (native `seekTo` is a SECONDS API).
   *  - Grouped host: the group timeline is ours to move — apply locally AND
   *    broadcast `syncplay_playback_seek`; positions go on the wire in
   *    MILLISECONDS via `toSyncPlayPositionMs` (S293: convert at the send
   *    boundary only).
   *  - Grouped NON-host: seeking is a HOST-ONLY wire command (phlix-syncplay
   *    SPEC.md §9 item 2 — the server authorizes it by the connection's host
   *    identity), and a member-local seek would desync from the group clock,
   *    so the seek is REFUSED outright. The scrub bar additionally renders
   *    non-capturing for members (`canSeek` below); this early exit is the
   *    belt for the button/skip surfaces sharing the choke point.
   */
  // MOB-18: referentially stable (reads the live position from
  // currentPositionRef) so the memoized SeekBar/SkipButton children are not
  // re-rendered by unrelated parent state changes.
  const handleSeek = useCallback((position: number) => {
    if (currentGroup && !isHost) {
      return;
    }
    dispatchPlayerCommand(playerRef, 'seekTo', [position]);
    setCurrentTime(position);
    if (currentGroup && isHost) {
      syncPlayService.sendSeek(
        toSyncPlayPositionMs(currentPositionRef.current),
        toSyncPlayPositionMs(position),
      );
    }
  }, [currentGroup, isHost]);

  // MOB-30: both skip legs go through stepSeekSeconds (the clampSeekSeconds
  // arm). The old forward `Math.min(duration, …)` jumped to 0 while the
  // duration was still unknown (0) — and always on live streams.
  const handleSeekBackward = () => {
    handleSeek(stepSeekSeconds(currentTime, -15, duration));
  };

  const handleSeekForward = () => {
    handleSeek(stepSeekSeconds(currentTime, 15, duration));
  };

  // Resolve the absolute signed VTT URL for the selected subtitle track ('' = off).
  // Playback-info rows carry a server-relative SIGNED path; the native player is
  // handed a bare URI, so absolutize at this single prop boundary
  // (`absolutizeApiPath` passes already-absolute transcode rows through).
  const selectedSubtitleWireUrl =
    subtitleTracksState.find((t) => t.id === selectedSubtitleId)?.url ?? '';
  const selectedSubtitleUrl = selectedSubtitleWireUrl
    ? absolutizeApiPath(selectedSubtitleWireUrl)
    : '';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
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
            autoPlay={autoplayEnabled}
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

      {/* MOB-10: mid-playback stall indicator (non-blocking). */}
      {isBuffering && !preparingTranscode && (
        <View style={styles.bufferingOverlay} pointerEvents="none" testID="bufferingIndicator">
          <ActivityIndicator size="large" color={colors.textPrimary} />
        </View>
      )}

      {/* Transcode "Preparing…" overlay */}
      {preparingTranscode && (
        <View style={styles.preparingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={styles.preparingText}>Preparing…</Text>
          {transcodeProgress > 0 && (
            <Text style={styles.preparingProgressText}>
              {Math.round(transcodeProgress)}%
            </Text>
          )}
        </View>
      )}

      {/* Skip Intro / Skip Outro overlay (positions in SECONDS).
          MOB-29: geometry from the LIVE insets (MW-107 law), not a
          SafeAreaView. A SafeAreaView pads by the insets of its OWN frame,
          so an absolute box parked at top 60 under a 47-59pt cutout got
          ~0 top padding and the pills landed on the top-bar row; in
          landscape the trailing cutout was only honoured by accident.
          Crown = top inset + 8 + 44pt bar row + 8 gap; trailing edge =
          right inset + 20, matching the top bar's own side padding. */}
      <View
        testID="skipButtonsLayer"
        style={[
          styles.skipButtonsContainer,
          { top: insets.top + 60, right: insets.right + 20 },
        ]}
        pointerEvents="box-none"
      >
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
      </View>

      {/* Overlay Controls */}
      {/* MOB-18: always mounted; the fade is the native-driven opacity and
       * showControls only gates touches (pointerEvents), so toggling never
       * remounts the control subtree. */}
      <Animated.View
          testID="controlsOverlay"
          style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
          pointerEvents={showControls ? 'box-none' : 'none'}
        >
          <View
            style={[
              styles.topBar,
              {
                // MW-107: crown by the TOP inset + 8, sides by the ACTIVE
                // edge insets — the fixed 20/20 is the fallback style only.
                paddingTop: insets.top + 8,
                paddingLeft: insets.left + 20,
                paddingRight: insets.right + 20,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Close player"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {mediaTitle ? (
              <Text testID="playerMediaTitle" style={styles.topBarTitle} numberOfLines={1}>
                {mediaTitle}
              </Text>
            ) : null}

            <View style={styles.topBarRight}>
              {/* M3 (deferred lane): data-plan notice — mirrors the offline
                  badge, shown whenever the active connection is cellular and
                  playback is NOT a local file (which consumes no data). */}
              {onCellular && !isOfflineMode && (
                <View style={styles.cellularBadge} accessibilityLabel="Playing over mobile data">
                  <Text style={styles.cellularBadgeText} maxFontSizeMultiplier={1.5}>
                    ⚠ Mobile data
                  </Text>
                </View>
              )}
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
                  <Text style={styles.qualityButtonText} numberOfLines={1}>
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

              {/* P3B-S7 + S407: Audio track picker — gated on the SAME store rail the modal reads */}
              {audioTracksState.length > 0 && (
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

              {/* SyncPlay entry (MW-117, review mobile__gameux #2): while IN a
                  room the pill is room STATE, not chrome — it lives on its own
                  always-on layer below the overlay so the control fade can no
                  longer erase it. The chrome keeps only the plain entry glyph
                  for users not in a room. */}
              {!currentGroup && (
                <TouchableOpacity
                  style={styles.syncPlayButton}
                  onPress={() => setShowSyncPlayOverlay(true)}
                  accessibilityLabel="SyncPlay"
                >
                  <Text style={styles.syncPlayButtonText}>👥</Text>
                </TouchableOpacity>
              )}

              {/* P3-S4: Sleep Timer — badge when running, button to set/change */}
              {remainingSeconds > 0 ? (
                <SleepTimerDisplay onPress={() => setShowSleepTimer(true)} remainingSeconds={remainingSeconds} />
              ) : (
                <TouchableOpacity
                  style={styles.syncPlayButton}
                  onPress={() => setShowSleepTimer(true)}
                  accessibilityLabel="Sleep timer"
                >
                  <Text style={styles.syncPlayButtonText}>🌙</Text>
                </TouchableOpacity>
              )}

              {/* P3-S4: Picture-in-Picture button. M-MOBILE-02 (review
                  mobile__casualgamer): Android's native receiveCommand
                  implements only play|pause|seekTo|setVolume|setMuted
                  (PhlixPlayerViewManager.kt) — a tap here dispatched a
                  command no branch matched, so the control was decorative
                  there. It is now iOS-only, where PiP genuinely exists
                  (PhlixPlayerView.swift); the README discloses the Android
                  background/MediaSession gap as feature-scale. */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.syncPlayButton}
                  onPress={handleStartPiP}
                  accessibilityLabel="Picture in picture"
                >
                  <Text style={styles.syncPlayButtonText}>📺</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.seekButton}
              onPress={handleSeekBackward}
              accessibilityLabel="Rewind 15 seconds"
            >
              <Text style={styles.seekButtonText}>-15</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={handlePlayPause}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              <Text style={styles.playPauseButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seekButton}
              onPress={handleSeekForward}
              accessibilityLabel="Forward 15 seconds"
            >
              <Text style={styles.seekButtonText}>+15</Text>
            </TouchableOpacity>
          </View>
          {memberPauseHint && currentGroup !== null && !isHost && (
            <Text testID="memberPauseHint" style={styles.memberTimelineHint}>
              The host controls playback — this only pauses your own screen
            </Text>
          )}

          {/* The SeekBar row used to live here, inside the auto-hiding
              overlay — M-MOBILE-44 r2 moved it to the persistent rail below
              the overlay. This fixed-height slot keeps the overlay's
              space-between geometry (top bar at top, buttons centered)
              EXACTLY as every earlier era measured it. Keep its height in
              sync with the rail's rendered box. */}
          <View style={styles.bottomControlsSpacer} />
        </Animated.View>

      {/* MW-117 (review mobile__gameux #2): the in-group SyncPlay pill on an
          ALWAYS-ON layer — it used to fade with the chrome, silently leaving
          an active member without any reminder of the room (or of the sync
          state this pill is the only surface for). Box-none, so every tap
          but the pill's own still falls through to the video surface and
          reveals the controls; the pill keeps its historic top-right home,
          inset-padded per MW-107. */}
      {currentGroup && (
        <View
          testID="syncPlayPillLayer"
          pointerEvents="box-none"
          style={[
            styles.pillLayer,
            { top: insets.top + 8, paddingRight: insets.right + 20 },
          ]}
        >
          <SyncPlayOverlay
            onPress={() => setShowSyncPlayOverlay(true)}
            notice={membershipNotice}
          />
        </View>
      )}

      {/* M-MOBILE-44 first clause (review mobile__gameux, r2 cure): a
          persistent progress rail OUTSIDE the auto-hide gate. The bar stays
          on screen after the chrome fades; while the chrome is hidden the
          rail is display-only (pointerEvents='none'), so a tap on it falls
          through to the video surface and REVEALS the controls instead of
          risking an unintended seek — with the chrome up it is the same
          interactive scrubber it has been since M-MOBILE-13. Live TV keeps
          no rail: with no duration clock its bar was always a 0:00 artifact,
          and there the old behavior (hide everything with the chrome) is the
          honest one. */}
      {!isLiveStream && (
        <View
          testID="playerProgressRail"
          style={[
            styles.progressRail,
            {
              // MW-107: the rail keeps its 40pt floor but lifts above a real
              // home indicator, and the side padding tracks the ACTIVE
              // (rotated) edge.
              paddingLeft: insets.left + 20,
              paddingRight: insets.right + 20,
              paddingBottom: Math.max(40, insets.bottom + 16),
            },
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            // Members follow the host timeline (host-only wire command,
            // SPEC §9) — the bar goes display-only for them.
            canSeek={currentGroup === null || isHost}
          />
          {/* m4 (review mobile__gameux): the bar going dead for members was
           * explained only inside the SyncPlay modal — on the viewing surface
           * it read as a broken scrubber. One honest line at the bar itself. */}
          {currentGroup !== null && !isHost && (
            <Text style={styles.memberTimelineHint}>
              The host controls the timeline — your playback follows theirs
            </Text>
          )}
        </View>
      )}

      {/* SyncPlay Modal */}
      <SyncPlayModal
        visible={showSyncPlayOverlay}
        onClose={() => setShowSyncPlayOverlay(false)}
        itemId={itemId}
      />

      {/* P3B-S7 + S407: Subtitle picker fed the SAME store rail the CC button gates on */}
      <SubtitleTrackList
        visible={showSubtitlePicker}
        tracks={subtitleTracksState}
        selected={selectedSubtitleId}
        onSelect={(trackId) => {
          setSelectedSubtitleId(trackId);
        }}
        onClose={() => setShowSubtitlePicker(false)}
      />

      {/* P3B-S7 + S407: Audio picker fed the store rail. Selection PERSISTS;
          applying it natively is the named refusal (footnote + bridge-boundary
          test) — see AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE. */}
      <AudioTrackList
        visible={showAudioPicker}
        tracks={audioTracksState}
        selected={selectedAudioTrackId}
        onSelect={(trackId) => {
          setSelectedAudioTrackId(trackId);
        }}
        note={AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE}
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

      {/* P3-S4: Sleep Timer picker */}
      <SleepTimerMenu
        visible={showSleepTimer}
        onSelect={(minutes) => {
          startTimer(minutes);
        }}
        onClose={() => setShowSleepTimer(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  playerWrapper: {
    flex: 1,
  },
  player: {
    flex: 1,
    backgroundColor: colors.black,
  },
  playerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
  },
  playerPlaceholderText: {
    // MW-104 promotion: this was the retired 666-gray (2.97:1-class — below
    // both floors). The census rotation of PlayerScreen off the survivor
    // list is EARNED by this promotion, not by moving the literal into a
    // token name.
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  streamUrlText: {
    color: colors.textMuted,
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
  // M-MOBILE-14 (review mobile__gameux): the right cluster packs up to seven
  // fixed-size targets (✕ + offline/quality pill + CC + audio + sync + sleep +
  // PiP). At 320pt the max ONLINE set (offline and the quality ladder are
  // mutually exclusive by load path) needs ≈400pt in a single flex-end row —
  // RN's default flexShrink is 0, so the row overflowed and `flex-end` packed
  // it against the RIGHT edge: the ✕ (the exit affordance) was what clipped
  // off-screen, worst exactly during a SyncPlay group (overlay minWidth 80).
  // THE DEGRADATION LAW: the cluster WRAPS (bar grows downward — it lives in
  // the absolute-positioned controls overlay, so a second chrome row simply
  // floats over the video) while every target keeps its 44pt footprint
  // (flexShrink: 0 — targets never squish). A horizontal ScrollView inside the
  // bar is FORBIDDEN here: the M-MOBILE-13 fix made the player chrome host a
  // responder-capturing surface (SeekBar track captures the RN core responder
  // system, src/components/player/SeekBar.tsx header @2666d4f); a scroll view
  // in the same overlay reintroduces touch-stealing next to it.
  // `alignItems: 'flex-start'` top-aligns the ✕ with the first cluster row once
  // wrapping fires (identical render while single-line — every row is 44 tall).
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: 20, // MW-107 fallback; live insets override inline
    paddingTop: 20,
    gap: 12,
  },
  // MW-117: always-on host for the in-group pill (top/right arrive inline
  // from the live insets). Row-end aligned so the pill sits exactly where
  // it did inside the chrome.
  pillLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  topBarTitle: {
    flex: 1,
    marginTop: 10,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    // The cluster box itself must be SHRINKABLE (RN default flexShrink is 0):
    // only a clamped inline width lets flexWrap break lines instead of pushing
    // the whole row off the left edge. This is the fix's hinge.
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  syncPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  syncPlayButtonActive: {
    backgroundColor: 'rgba(0,102,204,0.8)',
  },
  syncPlayButtonText: {
    color: colors.textPrimary,
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
    flexShrink: 0,
  },
  qualityButtonActive: {
    backgroundColor: 'rgba(0,102,204,0.8)',
  },
  qualityButtonText: {
    color: colors.textPrimary,
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
    flexShrink: 0,
  },
  offlineBadgeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  // M3 (deferred lane): amber so it reads as a CAUTION, distinct from the
  // blue "Offline" badge it shares the top-bar slot with.
  cellularBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(191,121,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 8,
  },
  cellularBadgeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.link,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButtonText: {
    color: colors.textPrimary,
    fontSize: 32,
  },
  // M-MOBILE-44 r2: the persistent progress rail — the SeekBar's post-auto-hide
  // home, OUTSIDE the fading overlay. Geometry mirrors the old in-overlay
  // bottomControls box (20pt side padding, 40pt bottom padding, row height 30
  // driven by the SeekBar's sliderContainer) so the chrome-up render is
  // unchanged; bottomControlsSpacer reserves the same box inside the overlay
  // (30 + 40 = 70).
  progressRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // m4 — the on-bar "host drives the timeline" line for members: quiet,
  // caption-grade, never competing with the scrubber it explains.
  memberTimelineHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12, // M-MOBILE-45 floor (12pt) — captions obey it too
    textAlign: 'center',
    marginTop: 6,
  },
  bottomControlsSpacer: {
    height: 70,
  },
  // MOB-29: top/right are FALLBACKS only — the live insets override inline
  // (top = insets.top + 60, right = insets.right + 20).
  skipButtonsContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  preparingProgressText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
});

export default PlayerScreen;
