/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/PlayerScreen.test.tsx
//
// Screen-level test for the PlayerScreen G3 quality wiring (menu-gating,
// `defaultQuality` seed/apply, and — most importantly — the finding-1
// position-preservation fix: a mid-play quality swap must resume from the LIVE
// playback position, not the mount-time `startPosition`).
//
// The repo has NO React renderer in its test deps (react-test-renderer / RNTL
// are intentionally absent — see SkipButton.test.tsx's note about the
// React 19 + test-renderer instability under @react-native/jest-preset). So we
// drive PlayerScreen through a tiny purpose-built "hook host": we mock React's
// hooks with a slot-backed dispatcher, invoke the component function to get its
// element tree, run committed effects, and re-invoke to observe state changes.
// This exercises the REAL PlayerScreen wiring (not just the pure helpers) so
// reverting the finding-1 fix turns the position assertion red (mutation-tested).
//
// All I/O collaborators (stores, managers, services) are mocked as inert stubs
// so no hook/renderer internals or network run during a pass.
//
// S407 added the track-picker fake-transport arms: the mocked
// `markerManager.getPlaybackInfo` is the FAKE WIRE — it resolves payloads
// built from the contracts golden vectors (provenance comment on the
// constants below) and the assertions run through the REAL PlayerScreen
// wiring (feed → store → picker props / native `subtitleUrl` prop).

import { AUTO_QUALITY } from '@phlix/contracts';
import { Alert as RNAlert, Platform as RNPlatform } from 'react-native';
import type { AudioTrack, SubtitleTrack } from '../../types/playback';
import { SubtitleTrackList } from '../../components/player/SubtitleTrackList';
import { AudioTrackList } from '../../components/player/AudioTrackList';
import { SleepTimerMenu, SleepTimerDisplay } from '../../components/player/SleepTimer';
import { SyncPlayOverlay } from '../../components/syncplay';

// ── controlled hook host ──────────────────────────────────────────────────
// A minimal, single-component hooks runtime. Slots are keyed by call order,
// which PlayerScreen keeps stable (no conditional hooks), so it works generically
// regardless of how many useState/useRef/useEffect the component adds.
interface EffectSlot {
  deps?: unknown[];
  cleanup?: void | (() => void);
}

class HookHost {
  private slots: unknown[] = [];
  private cursor = 0;
  private pending: Array<() => void> = [];
  private renderFn: (() => unknown) | null = null;
  tree: unknown = null;

  useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void] {
    const i = this.cursor++;
    if (this.slots[i] === undefined) {
      const value = typeof init === 'function' ? (init as () => T)() : init;
      this.slots[i] = { value };
    }
    const slot = this.slots[i] as { value: T };
    const setter = (v: T | ((p: T) => T)) => {
      slot.value = typeof v === 'function' ? (v as (p: T) => T)(slot.value) : v;
    };
    return [slot.value, setter];
  }

  useRef<T>(init: T): { current: T } {
    const i = this.cursor++;
    if (this.slots[i] === undefined) this.slots[i] = { ref: { current: init } };
    return (this.slots[i] as { ref: { current: T } }).ref;
  }

  useEffect(fn: () => void | (() => void), deps?: unknown[]): void {
    const i = this.cursor++;
    const prev = this.slots[i] as EffectSlot | undefined;
    const changed =
      !prev ||
      !deps ||
      !prev.deps ||
      deps.length !== prev.deps.length ||
      deps.some((d, j) => !Object.is(d, (prev.deps as unknown[])[j]));
    if (!prev) this.slots[i] = { deps, cleanup: undefined };
    else prev.deps = deps;
    if (changed) {
      const slot = this.slots[i] as EffectSlot;
      this.pending.push(() => {
        if (typeof slot.cleanup === 'function') slot.cleanup();
        const c = fn();
        slot.cleanup = typeof c === 'function' ? c : undefined;
      });
    }
  }

  render(fn: () => unknown): unknown {
    this.renderFn = fn;
    return this.commit();
  }

  rerender(): unknown {
    return this.commit();
  }

  // React unmount semantics: run every effect cleanup. PlayerScreen's
  // hideControls effect clears its 3s timeout here (:304) — the S293 fixtures
  // press play, arming it; the harness otherwise never unmounts, so the timer
  // would fire post-suite (uncaught Animated.timing TypeError, jest exit 1).
  unmount(): void {
    for (const slot of this.slots) {
      const cleanup = (slot as EffectSlot | undefined)?.cleanup;
      if (typeof cleanup === 'function') cleanup();
    }
    this.slots = [];
    this.renderFn = null;
  }

  private commit(): unknown {
    this.cursor = 0;
    this.pending = [];
    mockHost.current = this;
    try {
      this.tree = this.renderFn!();
    } finally {
      mockHost.current = null;
    }
    const effects = this.pending;
    this.pending = [];
    for (const run of effects) run();
    return this.tree;
  }
}

// `mock`-prefixed so the jest.mock factory below may reference it (jest lint rule).
const mockHost: { current: HookHost | null } = { current: null };

// The most recently mounted hook host — the S293 describe's afterEach unmounts
// it so PlayerScreen's hideControls timer (armed by pressing play) is cleared
// before the suite ends (the harness never unmounts otherwise).
let mountedHost: HookHost | null = null;

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (init: unknown) => mockHost.current!.useState(init as never),
    useRef: (init: unknown) => mockHost.current!.useRef(init),
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) =>
      mockHost.current!.useEffect(fn, deps),
  };
});

// ── inert collaborator mocks ────────────────────────────────────────────────
// Singletons are BOUND at import time, so each factory must construct its stub
// eagerly (a `mock*`-var read inside the factory would still be `undefined`
// when PlayerScreen imports it). We grab handles back via `jest.requireMock`
// below and mutate them per test.
jest.mock('../../stores/useSettingsStore', () => {
  const state = {
    defaultQuality: 'auto',
    // M-MOBILE-01: the Autoplay toggle drives the native start-immediately
    // prop; honest default mirrors the store (ON = today's hardcoded truth).
    autoplay: true,
    // M-MOBILE-15: the autoplay law reads this via getState() at event time.
    // Honest default here is OFF so the pre-existing suites keep asserting
    // the stop-behavior; the autoplay describe flips it deliberately.
    autoPlayNextEpisode: false,
    setDefaultQuality: jest.fn(),
  };
  // Real zustand hooks carry .getState too (the screen's ended-arm reads the
  // toggle imperatively) — mirror that surface, like the syncplay fake does.
  const hook = Object.assign((sel: (s: unknown) => unknown) => sel(state), {
    getState: () => state,
  });
  return { __state: state, useSettingsStore: hook };
});

jest.mock('../../stores/usePlayerStore', () => {
  const state = {
    subtitleTracks: [] as unknown[],
    currentSubtitleTrackId: null as string | null,
    audioTracks: [] as unknown[],
    currentAudioTrackId: null as string | null,
    setCurrentSubtitleTrackId: jest.fn(),
    setCurrentAudioTrackId: jest.fn(),
    setStreamInfo: jest.fn(),
    setSubtitleTracks: jest.fn(),
    setAudioTracks: jest.fn(),
    setCurrentTime: jest.fn(),
    setDuration: jest.fn(),
    setIsPlaying: jest.fn(),
  };
  return { __state: state, usePlayerStore: (sel: (s: unknown) => unknown) => sel(state) };
});

// S407: the screen joins relative wire paths to the server root at the native
// prop boundary via api/client. Hermetic stub here (the REAL join arithmetic is
// unit-pinned in src/api/__tests__/client.test.ts); the screen test asserts the
// boundary is EXERCISED — a relative path comes out prefixed, an absolute one
// passes through.
jest.mock('../../api/client', () => ({
  absolutizeApiPath: (pathOrUrl: string) =>
    pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
      ? pathOrUrl
      : `https://srv.test${pathOrUrl}`,
  // useAuthStore.ts wires these at import time (M2/M3 plumbing) — the factory
  // must export them or the store module crashes this suite.
  apiErrorMessage: (error: { response?: { data?: { error?: string } }; message?: string }, fallback: string) =>
    error?.response?.data?.error ?? error?.message ?? fallback,
  onAuthInvalidated: jest.fn(() => () => undefined),
}));

jest.mock('../../store/syncplayStore', () => {
  const state = {
    currentGroup: null,
    isHost: false,
    timeSyncStable: false,
    error: null,
    updatePlaybackState: jest.fn(),
  };
  // Real zustand hooks also carry .getState (PlayerScreen's effect gate reads
  // the snapshot imperatively) — mirror that surface here.
  const hook = Object.assign((sel: (s: unknown) => unknown) => sel(state), {
    getState: () => state,
  });
  return { __state: state, useSyncplayStore: hook };
});

jest.mock('../../api/PlaybackManager', () => ({ playbackManager: { getStreamUrl: jest.fn() } }));
// C17 (review mobile__gameux): PlayerScreen now drives the resume reporter at
// every lifecycle point (progress ticks, play/pause transitions, ended,
// unmount flush). The reporter's own semantics are pinned in
// src/services/__tests__/PlaybackProgressReporter.test.ts; here we assert the
// WIRING — that the screen actually calls it. The async fakes keep the real
// call sites' `.catch(() => undefined)` chain safe.
const mockReporterRouteParams: Record<string, unknown> = { itemId: 'm-1' };
jest.mock('../../services/PlaybackProgressReporter', () => ({
  playbackProgressReporter: {
    report: jest.fn(async () => undefined),
    flush: jest.fn(async () => undefined),
    complete: jest.fn(async () => undefined),
  },
}));
// The global route mock (jest.setup) hands PlayerScreen empty params; the C17
// lifecycle assertions need a real itemId on the wire calls.
// Stable navigation handle (M-MOBILE-15): the ended-arm's replace() must be
// assertable — a per-call object with fresh jest.fn()s is unobservable.
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({
    params: mockReporterRouteParams,
  }),
}));
// M-MOBILE-15: the autoplay resolver reads the wire through libraryManager —
// mock the module so NO PlayerScreen boot ever touches it (the boot lifecycle
// stays read-free; only the ended arm may call), and never the real API.
jest.mock('../../api/LibraryManager', () => ({
  libraryManager: {
    getMediaItem: jest.fn(),
    browseMedia: jest.fn(),
  },
}));
jest.mock('../../api/TranscodeManager', () => ({ transcodeManager: { prepare: jest.fn() } }));
jest.mock('../../api/MarkerManager', () => ({ markerManager: { getPlaybackInfo: jest.fn() } }));
jest.mock('../../services/DownloadService', () => ({
  downloadService: { getItemLocalPath: jest.fn() },
}));
jest.mock('../../syncplay/SyncPlayService', () => ({
  syncPlayService: {
    on: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendPlay: jest.fn(),
    sendPause: jest.fn(),
    sendSeek: jest.fn(),
  },
}));
jest.mock('../../api/SyncPlayManager', () => ({
  syncPlayManager: {
    getPublicRooms: jest.fn(),
    createRoom: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    getWebSocketUrl: jest.fn(),
  },
}));

// useRoute/useNavigation are mocked globally in jest.setup.js (params: {}).

// Import AFTER the mocks are registered (jest hoists the mock calls).
import PlayerScreen, { AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE } from '../PlayerScreen';

const mockSettings = (jest.requireMock('../../stores/useSettingsStore') as any).__state as {
  defaultQuality: string;
  autoplay: boolean;
  autoPlayNextEpisode: boolean;
  setDefaultQuality: jest.Mock;
};
const mockPlayerStore = (jest.requireMock('../../stores/usePlayerStore') as any).__state as {
  subtitleTracks: unknown[];
  currentSubtitleTrackId: string | null;
  audioTracks: unknown[];
  currentAudioTrackId: string | null;
  setSubtitleTracks: jest.Mock;
  setCurrentSubtitleTrackId: jest.Mock;
  setAudioTracks: jest.Mock;
  setCurrentAudioTrackId: jest.Mock;
};
const mockPlaybackManager = (jest.requireMock('../../api/PlaybackManager') as any)
  .playbackManager as { getStreamUrl: jest.Mock };
const mockReporter = (jest.requireMock('../../services/PlaybackProgressReporter') as any)
  .playbackProgressReporter as { report: jest.Mock; flush: jest.Mock; complete: jest.Mock };
const mockTranscodeManager = (jest.requireMock('../../api/TranscodeManager') as any)
  .transcodeManager as { prepare: jest.Mock };
const mockMarkerManager = (jest.requireMock('../../api/MarkerManager') as any)
  .markerManager as { getPlaybackInfo: jest.Mock };
const mockDownloadService = (jest.requireMock('../../services/DownloadService') as any)
  .downloadService as { getItemLocalPath: jest.Mock };
const mockSyncplayStore = (jest.requireMock('../../store/syncplayStore') as any)
  .__state as { isHost: boolean; currentGroup: unknown };
// M-MOBILE-15: the autoplay resolver's wire surface (getMediaItem + browseMedia).
const mockLibrary = (jest.requireMock('../../api/LibraryManager') as any)
  .libraryManager as { getMediaItem: jest.Mock; browseMedia: jest.Mock };
const mockSyncPlaySvc = () =>
  (jest.requireMock('../../syncplay/SyncPlayService') as any).syncPlayService as {
    sendPlay: jest.Mock;
    sendPause: jest.Mock;
    sendSeek: jest.Mock;
  };

// ── tree helpers ────────────────────────────────────────────────────────────
type El = { type: unknown; props: Record<string, unknown> };

const isEl = (n: unknown): n is El =>
  !!n && typeof n === 'object' && 'props' in (n as object);

function findEl(node: unknown, pred: (el: El) => boolean): El | null {
  if (Array.isArray(node)) {
    for (const c of node) {
      const r = findEl(c, pred);
      if (r) return r;
    }
    return null;
  }
  if (isEl(node)) {
    if (pred(node)) return node;
    return findEl(node.props.children, pred);
  }
  return null;
}

// The native player element (has the numeric `startPosition` + `onProgress` props).
const findPlayer = (tree: unknown): El | null =>
  findEl(
    tree,
    (el) => el.props.autoPlay === true && 'startPosition' in el.props,
  );

// The QualityMenu element (mounted unconditionally; carries onSelect + options).
const findQualityMenu = (tree: unknown): El | null =>
  findEl(
    tree,
    (el) => typeof el.props.onSelect === 'function' && Array.isArray(el.props.options),
  );

// The top-bar quality pill (only rendered when >1 option exists).
const findQualityButton = (tree: unknown): El | null =>
  findEl(tree, (el) => el.props.accessibilityLabel === 'Video quality');

// The center play/pause control (glyph text: '⏸' playing, '▶' paused).
const findPlayPauseControl = (tree: unknown): El | null =>
  findEl(
    tree,
    (el) =>
      typeof el.props.onPress === 'function' &&
      JSON.stringify(el.props.children ?? '').match(/[⏸▶]/) !== null,
  );

// SeekBar carries the internal SECONDS clock (currentTime prop).
const findSeekBar = (tree: unknown): El | null =>
  findEl(
    tree,
    (el) => typeof el.props.onSeek === 'function' && typeof el.props.currentTime === 'number',
  );

// S407: the picker modals are identifiable by their component reference — the
// hook host keeps the tree as unrendered elements, so `el.type` IS the real
// picker function imported above.
const findRailModal = (tree: unknown, component: unknown): El | null =>
  findEl(tree, (el) => el.type === component);

// Top-bar affordances by their accessibility labels.
const findButton = (tree: unknown, label: string): El | null =>
  findEl(tree, (el) => el.props.accessibilityLabel === label);

// ── S407 fake-transport payload ───────────────────────────────────────────
// Golden values copied from contracts `test/fixtures/stream-track-vectors.json`
// @ 068d5e86 (provenance: phlix-server 01340633, StreamTrackShaper dump).
// Audio: case `stored-default-on-second-nullables-passthrough`.
// Subtitle: case `embedded-text-codecs-bitmap-skipped-but-counted` — the
// fixture stores PATH-ONLY urls (the signer's `?exp=<digits>&sig=<base64url>`
// is stripped at dump time); the documented mint form is re-appended here so
// the payload matches what the client actually reads off the wire.
const GOLDEN_AUDIO_TRACKS: AudioTrack[] = [
  {
    id: 'as-1',
    index: 0,
    stream_index: 1,
    codec: 'eac3',
    language: 'en',
    channels: 6,
    bitrate: 640000,
    title: null,
    default: false,
  },
  {
    id: 'as-2',
    index: 1,
    stream_index: 2,
    codec: 'aac',
    language: 'en',
    channels: 2,
    bitrate: 128000,
    title: 'Commentary',
    default: true,
  },
];
const GOLDEN_SUBTITLE_TRACKS: SubtitleTrack[] = [
  {
    id: 'ss-1',
    index: 0,
    stream_index: 1,
    language: 'eng',
    label: 'eng',
    codec: 'subrip',
    source: null,
    hearing_impaired: true,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/0?exp=1800000000&sig=dGVzdC1zaWc',
  },
  {
    id: 'ss-2',
    index: 2,
    stream_index: 4,
    language: 'spa',
    label: 'Español (Forzada)',
    codec: 'mov_text',
    source: null,
    hearing_impaired: false,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/2?exp=1800000000&sig=dGVzdC1zaWc',
  },
];
const GOLDEN_PLAYBACK_INFO = {
  item_id: '11111111-2222-3333-4444-555555555555',
  intro_marker: null,
  outro_marker: null,
  chapters: [],
  audio_tracks: GOLDEN_AUDIO_TRACKS,
  subtitle_tracks: GOLDEN_SUBTITLE_TRACKS,
};

// Press the center play/pause control (props are untyped; cast like onProgress).
const pressPlayPause = (tree: unknown): void => {
  const control = findPlayPauseControl(tree);
  (control!.props.onPress as () => void)();
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const LADDER = {
  masterUrl: 'https://cdn/master.m3u8',
  subtitles: [],
  variants: [
    { id: '720p', label: '720p', url: 'https://cdn/media_v720.m3u8' },
    { id: '480p', label: '480p', url: 'https://cdn/media_v480.m3u8' },
  ],
};

function mount() {
  const host = new HookHost();
  mountedHost = host;
  const render = () => host.render(() => (PlayerScreen as unknown as () => unknown)());
  return { host, render, rerender: () => host.rerender() };
}

// Bring the screen up on the direct-play path (menu hidden, no ladder yet).
async function bootDirectPlay() {
  const h = mount();
  h.render();
  await flush();
  h.rerender();
  return h;
}

// Force the transcode fallback so a real variant ladder exists.
async function triggerTranscode(h: ReturnType<typeof mount>) {
  const player = findPlayer(h.host.tree);
  (player!.props.onError as (e: unknown) => void)({ nativeEvent: { error: 'boom' } });
  await flush();
  h.rerender();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncplayStore.isHost = false; // S293 describe flips it; restore for siblings.
  mockSettings.defaultQuality = AUTO_QUALITY;
  // M-MOBILE-15: honest default is OFF — every pre-existing suite keeps
  // asserting the stop-behavior unchanged; the autoplay describe flips it.
  mockSettings.autoPlayNextEpisode = false;
  // M-MOBILE-01: restore the honest default so a flipped sibling test cannot
  // leak an OFF state into the suites whose finders key on autoPlay === true.
  mockSettings.autoplay = true;
  // jest.clearAllMocks() keeps implementations; the autoplay wire fakes MUST
  // start each test blank (a leaked mockResolvedValue would fake a "next").
  mockLibrary.getMediaItem.mockReset();
  mockLibrary.browseMedia.mockReset();
  mockPlayerStore.subtitleTracks = [];
  mockPlayerStore.currentSubtitleTrackId = null;
  mockPlayerStore.audioTracks = [];
  mockPlayerStore.currentAudioTrackId = null;
  // S407: make the fake store ROUND-TRIP the rail writes (like zustand does),
  // so a rerender observes the playback-info feed end-to-end — feed → store →
  // picker props / native `subtitleUrl` prop.
  mockPlayerStore.setSubtitleTracks.mockImplementation((tracks: unknown[]) => {
    mockPlayerStore.subtitleTracks = tracks;
  });
  mockPlayerStore.setCurrentSubtitleTrackId.mockImplementation((id: string | null) => {
    mockPlayerStore.currentSubtitleTrackId = id;
  });
  mockPlayerStore.setAudioTracks.mockImplementation((tracks: unknown[]) => {
    mockPlayerStore.audioTracks = tracks;
  });
  mockPlayerStore.setCurrentAudioTrackId.mockImplementation((id: string | null) => {
    mockPlayerStore.currentAudioTrackId = id;
  });
  mockDownloadService.getItemLocalPath.mockReturnValue(null);
  mockPlaybackManager.getStreamUrl.mockResolvedValue('https://cdn/direct.mp4');
  // Honest default: the server ALWAYS emits both rails (S407 type pin), so the
  // stub carries the full shape even when a test does not exercise rails.
  mockMarkerManager.getPlaybackInfo.mockResolvedValue({
    item_id: 'm-test',
    intro_marker: null,
    outro_marker: null,
    chapters: [],
    audio_tracks: [],
    subtitle_tracks: [],
  });
  mockTranscodeManager.prepare.mockReturnValue({
    promise: Promise.resolve(LADDER),
    cancel: jest.fn(),
  });
});

describe('PlayerScreen — G3 quality wiring', () => {
  it('renders the native player and HIDES the quality menu on direct play (no ladder)', async () => {
    const h = await bootDirectPlay();
    const player = findPlayer(h.host.tree);
    expect(player).not.toBeNull();
    expect(player!.props.src).toBe('https://cdn/direct.mp4');
    // No transcode ⇒ 0/1 options ⇒ pill hidden.
    expect(findQualityButton(h.host.tree)).toBeNull();
  });

  it('SHOWS the quality menu once a transcode ladder resolves', async () => {
    const h = await bootDirectPlay();
    await triggerTranscode(h);
    const button = findQualityButton(h.host.tree);
    expect(button).not.toBeNull();
    const menu = findQualityMenu(h.host.tree);
    expect(menu).not.toBeNull();
    // Auto + 720p + 480p = 3 options.
    expect((menu!.props.options as unknown[]).length).toBe(3);
  });

  it('applies the persisted defaultQuality on the transcode ladder (READ+APPLY)', async () => {
    mockSettings.defaultQuality = '720p';
    const h = await bootDirectPlay();
    await triggerTranscode(h);
    const player = findPlayer(h.host.tree);
    // Seeded to the persisted rung ⇒ plays that rung's own media playlist.
    expect(player!.props.src).toBe('https://cdn/media_v720.m3u8');
    const menu = findQualityMenu(h.host.tree);
    expect(menu!.props.selected).toBe('720p');
    // Seeding must NOT re-persist the setting.
    expect(mockSettings.setDefaultQuality).not.toHaveBeenCalled();
  });

  it('falls back to Auto when the persisted rung is absent from the ladder', async () => {
    mockSettings.defaultQuality = '2160p'; // not in LADDER
    const h = await bootDirectPlay();
    await triggerTranscode(h);
    const player = findPlayer(h.host.tree);
    expect(player!.props.src).toBe('https://cdn/master.m3u8');
    const menu = findQualityMenu(h.host.tree);
    expect(menu!.props.selected).toBe(AUTO_QUALITY);
  });

  // ── finding 1: mid-play quality swap must PRESERVE the live position ──────
  it('resumes from the LIVE playback position (not 0) after a quality swap', async () => {
    const h = await bootDirectPlay();
    await triggerTranscode(h);

    // Simulate playback advancing to 137s via the native progress callback.
    const player = findPlayer(h.host.tree);
    (player!.props.onProgress as (e: unknown) => void)({
      nativeEvent: { currentTime: 137, duration: 600 },
    });
    h.rerender(); // commit → currentPositionRef syncs to 137

    // Pin a rung mid-play.
    const menu = findQualityMenu(h.host.tree);
    (menu!.props.onSelect as (v: string) => void)('480p');
    h.rerender();

    const after = findPlayer(h.host.tree);
    // The swap must re-point startPosition at the live spot, NOT the mount value.
    expect(after!.props.startPosition).toBe(137);
    expect(after!.props.src).toBe('https://cdn/media_v480.m3u8');
    // And the choice is persisted.
    expect(mockSettings.setDefaultQuality).toHaveBeenCalledWith('480p');
  });

  it('switching back to Auto also preserves the live position', async () => {
    mockSettings.defaultQuality = '720p';
    const h = await bootDirectPlay();
    await triggerTranscode(h);

    const player = findPlayer(h.host.tree);
    (player!.props.onProgress as (e: unknown) => void)({
      nativeEvent: { currentTime: 88, duration: 600 },
    });
    h.rerender();

    const menu = findQualityMenu(h.host.tree);
    (menu!.props.onSelect as (v: string) => void)(AUTO_QUALITY);
    h.rerender();

    const after = findPlayer(h.host.tree);
    expect(after!.props.startPosition).toBe(88);
    expect(after!.props.src).toBe('https://cdn/master.m3u8');
  });
});

// ── S293: SyncPlay send boundaries carry MILLISECONDS (SPEC.md:91) ─────────
// The wire unit is ms; `currentTime` is SECONDS. Each boundary fixture uses a
// 1000×-sensitive position (42.5 s → 42_500 ms — never 0, never a value that
// reads the same in both units). Swapping the conversion (identity) turns the
// two named assertions below red — mutation-proved.
describe('PlayerScreen — S293 SyncPlay send boundaries (seconds → ms)', () => {
  // Host mode: only hosts broadcast play/pause (the `isHost` gate at :610).
  beforeEach(() => {
    mockSyncplayStore.isHost = true;
  });

  // Teardown: these fixtures are the first to press play, arming the 3s
  // hideControls timer (PlayerScreen :299). The hook-host harness never
  // unmounts, so run the host's effect cleanups (which clear the timer) after
  // each test — the sibling suites use the same afterEach-cleanup convention.
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
  });

  // Advance the internal seconds clock to a 1000×-sensitive position: 42.5 s.
  // The wire value 42_500 ms is off by exactly 1000× if a boundary is left
  // unconverted (it would carry 42.5).
  async function bootAt42_5s() {
    const h = await bootDirectPlay();
    const player = findPlayer(h.host.tree);
    (player!.props.onProgress as (e: unknown) => void)({
      nativeEvent: { currentTime: 42.5, duration: 600 },
    });
    h.rerender();
    return h;
  }

  it('host PLAY broadcasts the position in MILLISECONDS (42.5 s → 42_500 ms)', async () => {
    const h = await bootAt42_5s();
    pressPlayPause(h.host.tree);
    h.rerender();

    expect(mockSyncPlaySvc().sendPlay).toHaveBeenCalledTimes(1);
    expect(mockSyncPlaySvc().sendPlay).toHaveBeenCalledWith(42_500);
  });

  it('host PAUSE broadcasts the position in MILLISECONDS (42.5 s → 42_500 ms)', async () => {
    const h = await bootAt42_5s();
    // First press starts playback (play branch); the second pauses it.
    pressPlayPause(h.host.tree);
    h.rerender();
    pressPlayPause(h.host.tree);
    h.rerender();

    expect(mockSyncPlaySvc().sendPause).toHaveBeenCalledTimes(1);
    expect(mockSyncPlaySvc().sendPause).toHaveBeenCalledWith(42_500);
  });

  it('the internal clock stays SECONDS while the wire carries ms', async () => {
    const h = await bootAt42_5s();
    // SeekBar is fed the internal seconds state — conversion must NOT leak in.
    expect(findSeekBar(h.host.tree)!.props.currentTime).toBe(42.5);
  });
});

// ── S441: the INBOUND seek command lands in SECONDS (finish-S293) ──────────
// The service decodes the wire's ms once (pinned in SyncPlayService.test.ts);
// from there the whole consumer chain is seconds-native. This harness mounts
// through the repo's custom HookHost (no reconciler ⇒ no native ref), so the
// OBSERVABLE seek surface is the seconds state the native `seekTo` is fed —
// the same value `dispatchPlayerCommand(playerRef, 'seekTo', [cmd.position])`
// carries at PlayerScreen :264. A raw-ms (42 500) or double-decoded (0.0425)
// command both turn the 42.5 assertion red.
describe('PlayerScreen — S441 inbound seek lands as seconds', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
  });

  it('a follow-member seek of 42.5 SECONDS moves the internal clock to 42.5', async () => {
    const h = await bootDirectPlay();

    // The service mock records every `on(event, handler)` registration.
    const svcOn = (jest.requireMock('../../syncplay/SyncPlayService') as any)
      .syncPlayService.on as jest.Mock;
    const seekHandler = svcOn.mock.calls
      .filter(([event]) => event === 'onPlaybackCommand')
      .map(([, handler]) => handler)
      .pop() as (cmd: unknown) => void;
    expect(seekHandler).toBeDefined();

    seekHandler({ type: 'seek', position: 42.5, serverTime: Date.now() });
    h.rerender();

    expect(findSeekBar(h.host.tree)!.props.currentTime).toBe(42.5);
  });
});

// ── S407: the track pickers are fed by the REAL playback-info payload ──────
// The mocked `markerManager.getPlaybackInfo` is the fake wire; every assertion
// below runs through the real PlayerScreen wiring. The subtitle picker ships
// the OBSERVABLE-EFFECT arm (selection drives the native `subtitleUrl` prop —
// iOS PhlixPlayerView.swift didSet→reload / Android SubtitleConfiguration).
// The audio picker ships the NAMED-REFUSAL arm (the native bridge exposes no
// audio-track switching surface — see NativeAudioSelectionBoundary.test.ts);
// selection persists to the store and the refusal note reaches the modal.
describe('PlayerScreen — S407 track pickers fed by playback-info', () => {
  async function bootWithTracks() {
    mockMarkerManager.getPlaybackInfo.mockResolvedValue(GOLDEN_PLAYBACK_INFO);
    const h = mount();
    h.render();
    await flush();
    h.rerender();
    return h;
  }

  it('feeds BOTH rails into the store from the fake playback-info payload', async () => {
    const h = await bootWithTracks();
    expect(mockPlayerStore.subtitleTracks).toEqual(GOLDEN_SUBTITLE_TRACKS);
    expect(mockPlayerStore.audioTracks).toEqual(GOLDEN_AUDIO_TRACKS);
    // And the setters actually ran (not a silent drop).
    expect(mockPlayerStore.setSubtitleTracks).toHaveBeenCalledWith(GOLDEN_SUBTITLE_TRACKS);
    expect(mockPlayerStore.setAudioTracks).toHaveBeenCalledWith(GOLDEN_AUDIO_TRACKS);
    h.host.unmount();
  });

  it('kills the button/picker duality: CC button gate and modal read the SAME store rail', async () => {
    const h = await bootWithTracks();
    const ccButton = findButton(h.host.tree, 'Subtitles');
    expect(ccButton).not.toBeNull(); // store rail non-empty ⇒ button shows
    const modal = findRailModal(h.host.tree, SubtitleTrackList);
    expect(modal).not.toBeNull();
    expect(modal!.props.tracks).toBe(mockPlayerStore.subtitleTracks); // identical reference
  });

  it('subtitle selection has an OBSERVABLE EFFECT: the native subtitleUrl prop becomes the absolutized signed path', async () => {
    const h = await bootWithTracks();
    const playerBefore = findPlayer(h.host.tree);
    expect(playerBefore!.props.subtitleUrl).toBe(''); // off by default

    const modal = findRailModal(h.host.tree, SubtitleTrackList);
    (modal!.props.onSelect as (id: string | null) => void)('ss-1');
    h.rerender();

    const player = findPlayer(h.host.tree);
    // The wire row carries a RELATIVE signed path; the boundary absolutizes it.
    expect(player!.props.subtitleUrl).toBe(
      `https://srv.test${GOLDEN_SUBTITLE_TRACKS[0].url}`,
    );
    h.host.unmount();
  });

  it('subtitle OFF row resets the observable effect to empty string', async () => {
    const h = await bootWithTracks();
    const modal = findRailModal(h.host.tree, SubtitleTrackList);
    (modal!.props.onSelect as (id: string | null) => void)('ss-2');
    h.rerender();
    (modal!.props.onSelect as (id: string | null) => void)(null);
    h.rerender();
    expect(findPlayer(h.host.tree)!.props.subtitleUrl).toBe('');
    h.host.unmount();
  });

  it('AUDIO picker carries the named refusal note into the modal', async () => {
    const h = await bootWithTracks();
    const modal = findRailModal(h.host.tree, AudioTrackList);
    expect(modal).not.toBeNull();
    expect(modal!.props.note).toBe(AUDIO_TRACK_APPLY_UNSUPPORTED_NATIVE);
    h.host.unmount();
  });

  it('AUDIO selection PERSISTS to the store but emits NO native audio surface (named refusal)', async () => {
    const h = await bootWithTracks();
    const modal = findRailModal(h.host.tree, AudioTrackList);
    // The picker is POPULATED (fake transport → store → modal), not phantom.
    expect(modal!.props.tracks).toEqual(GOLDEN_AUDIO_TRACKS);
    (modal!.props.onSelect as (id: string) => void)('as-2');
    h.rerender();
    // Choice is remembered (store round-trip)...
    expect(mockPlayerStore.currentAudioTrackId).toBe('as-2');
    // ...but the native player receives NO audio prop — the ONLY track-ish
    // prop it carries is subtitleUrl. A phantom `audioTrackId`/`audioUrl` on
    // the native element would mean the refusal was faked away.
    const player = findPlayer(h.host.tree)!;
    const nativeAudioProp = Object.keys(player.props).find(
      (k) => /audio/i.test(k) && k !== 'autoPlay',
    );
    expect(nativeAudioProp).toBeUndefined();
    h.host.unmount();
  });

  // Rail precedence (named in PlayerScreen): the transcode synth rail OWNS the
  // subtitle list once the job started; a late playback-info response must not
  // roll it back to rows describing the container that failed to direct-play.
  it('a late playback-info does NOT roll back a started transcode subtitle rail; audio still feeds', async () => {
    let releasePlaybackInfo: (value: unknown) => void = () => {};
    mockMarkerManager.getPlaybackInfo.mockReturnValue(
      new Promise((resolve) => {
        releasePlaybackInfo = resolve;
      }),
    );
    // Transcode carries one signed VTT row so the synth rail is observable.
    mockTranscodeManager.prepare.mockReturnValue({
      promise: Promise.resolve({
        ...LADDER,
        subtitles: [{ language: 'en', url: 'https://cdn.example/sub_en.vtt?sig=x' }],
      }),
      cancel: jest.fn(),
    });
    const h = mount();
    h.render();
    await flush();
    h.rerender();
    // Direct play is up, playback-info still in flight; force the fallback.
    await triggerTranscode(h);
    // Now the late wire response lands.
    releasePlaybackInfo(GOLDEN_PLAYBACK_INFO);
    await flush();
    h.rerender();

    // Subtitle rail: still the single synth row (id tx-0), NOT the 2 wire rows.
    expect(mockPlayerStore.subtitleTracks).toHaveLength(1);
    expect((mockPlayerStore.subtitleTracks[0] as { id: string }).id).toBe('tx-0');
    // The synth URL is already ABSOLUTE — the boundary passes it through.
    const modal = findRailModal(h.host.tree, SubtitleTrackList);
    (modal!.props.onSelect as (id: string | null) => void)('tx-0');
    h.rerender();
    expect(findPlayer(h.host.tree)!.props.subtitleUrl).toBe(
      'https://cdn.example/sub_en.vtt?sig=x',
    );
    // Audio rail: playback-info is its ONLY feeder — it arrives regardless.
    expect(mockPlayerStore.audioTracks).toEqual(GOLDEN_AUDIO_TRACKS);
    h.host.unmount();
  });
});

// ── W5: SyncPlay errors are USER-VISIBLE (code → catalog → Alert) ─────────
// Before this lane the onError handler was console.warn-only — the viewer saw
// nothing when the room failed. Doctrine: the stable wire CODE decides the
// sentence (syncplayErrors catalog), the server's English text is fallback,
// and the Alert is the repo's transient-feedback idiom (cf. the access /
// stream-limit arms in PlayerScreen). The harness's mocked service
// records every `on(event, handler)`, so we invoke the REAL registered
// handler and assert the REAL Alert the component fires.
describe('PlayerScreen — SyncPlay onError surfaces a user-visible Alert', () => {
  let alertSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(RNAlert, 'alert').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    alertSpy.mockRestore();
    warnSpy.mockRestore();
  });

  function grabErrorHandler(): (code: string, message: string) => void {
    const svcOn = (jest.requireMock('../../syncplay/SyncPlayService') as any)
      .syncPlayService.on as jest.Mock;
    const handler = svcOn.mock.calls
      .filter(([event]) => event === 'onError')
      .map(([, fn]) => fn)
      .pop() as (code: string, message: string) => void;
    expect(handler).toBeDefined();
    return handler;
  }

  it('renders the CATALOG sentence for a mapped code — catalog beats server text', async () => {
    await bootDirectPlay();
    grabErrorHandler()('NOT_HOST', 'Only the host can control playback');

    expect(alertSpy).toHaveBeenCalledWith('SyncPlay error', 'Only the room host can do that.');
    // Dev diagnostics stay (console.warn kept on purpose), user visibility is NEW.
    expect(warnSpy).toHaveBeenCalledWith('SyncPlay error [NOT_HOST]: Only the host can control playback');
  });

  it('renders PROTOCOL_VERSION_MISMATCH copy for the upgrade family', async () => {
    await bootDirectPlay();
    grabErrorHandler()('PROTOCOL_VERSION_MISMATCH', 'server protocol 2 > client 1');

    expect(alertSpy).toHaveBeenCalledWith(
      'SyncPlay error',
      'Please update the Phlix app — this server speaks a newer SyncPlay protocol.'
    );
  });

  it('degrades to the server message for an unknown code', async () => {
    await bootDirectPlay();
    grabErrorHandler()('FUTURE_SERVER_CODE', 'Brand new failure the app predates');

    expect(alertSpy).toHaveBeenCalledWith('SyncPlay error', 'Brand new failure the app predates');
  });

  it('degrades to the generic sentence when neither code nor message helps', async () => {
    await bootDirectPlay();
    grabErrorHandler()('UNKNOWN', 'Unknown error');

    // 'UNKNOWN' is the service sentinel: it behaves like an unmapped code and
    // shows the service's own last-resort text rather than rendering a key.
    expect(alertSpy).toHaveBeenCalledWith('SyncPlay error', 'Unknown error');
  });
});

// ---------------------------------------------------------------------------
// Audit H4 + M5 — identity and socket gating
// ---------------------------------------------------------------------------

describe('PlayerScreen — H4/M5 room-gated connect with authenticated identity', () => {
  // The REAL zustand store is used (only its client.ts deps are mocked), so
  // setState drives exactly what the effect reads via getState().
  const { useAuthStore } = require('../../stores/useAuthStore') as {
    useAuthStore: { setState: (s: object) => void; getState: () => { user: unknown } };
  };
  const svc = () =>
    (jest.requireMock('../../syncplay/SyncPlayService') as any)
      .syncPlayService as { connect: jest.Mock };

  afterEach(() => {
    mockSyncplayStore.currentGroup = null;
    useAuthStore.setState({ user: null, isAuthenticated: false, error: null });
  });

  it('does NOT open the socket when no group is active (M5: mount ≠ join)', async () => {
    useAuthStore.setState({ user: { id: 'u-9', username: 'bob' }, isAuthenticated: true });
    mockSyncplayStore.currentGroup = null;

    await bootDirectPlay();

    expect(svc().connect).not.toHaveBeenCalled();
  });

  it('stays silent while signed out even if a stale group lingers (H4: no fabricated id)', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    mockSyncplayStore.currentGroup = { id: 'sp_room9', name: 'Room', members: [], hostId: 'u-9' };

    await bootDirectPlay();

    expect(svc().connect).not.toHaveBeenCalled();
  });

  it('connects with the AUTHENTICATED USER ID — never a fabricated mobile_* (H4)', async () => {
    useAuthStore.setState({ user: { id: 'u-9', username: 'bob' }, isAuthenticated: true });
    mockSyncplayStore.currentGroup = { id: 'sp_room9', name: 'Room', members: [], hostId: 'u-9' };

    await bootDirectPlay();

    expect(svc().connect).toHaveBeenCalledTimes(1);
    const claimedIdentity = String(svc().connect.mock.calls[0][0]);
    expect(claimedIdentity).toBe('u-9'); // JWT subject, not itemId-derived
    expect(claimedIdentity).not.toMatch(/^mobile_/);
  });
});

// ── C17 (review mobile__gameux): playback lifecycle reaches the reporter ───
// The phone was a resume BLACK HOLE: PlayerScreen never told the server where
// playback stood, so Continue Watching / Watch History / Resume stayed blind
// to phone watching. The reporter owns the session/throttle/tick math (pinned
// in PlaybackProgressReporter.test.ts); THESE pins assert the screen actually
// calls it at the four lifecycle points: progress tick, play transition,
// pause transition, natural end — and flushes the final position on teardown.
// Breaking any one wiring (e.g. reverting the `ended` → complete call) reddens
// exactly one test here.
describe('PlayerScreen — C17 resume reporting wiring', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
  });

  const firePlaybackEvent = (h: { host: HookHost }, nativeEvent: Record<string, unknown>) => {
    const player = findPlayer(h.host.tree);
    (player!.props.onPlaybackEvent as (e: unknown) => void)({ nativeEvent });
  };
  const fireProgress = (h: { host: HookHost }, currentTime: number, duration: number) => {
    const player = findPlayer(h.host.tree);
    (player!.props.onProgress as (e: unknown) => void)({
      nativeEvent: { currentTime, duration },
    });
  };

  it('every native progress tick is fed to the reporter in PLAYER SECONDS', async () => {
    const h = await bootDirectPlay();
    fireProgress(h, 137, 600);

    expect(mockReporter.report).toHaveBeenCalledWith(
      { mediaItemId: 'm-1', positionSeconds: 137, durationSeconds: 600, paused: true },
    );
  });

  it('a native play transition forces a paused=false report', async () => {
    const h = await bootDirectPlay();
    firePlaybackEvent(h, { event: 'play', currentTime: 150, duration: 600 });

    expect(mockReporter.report).toHaveBeenCalledWith(
      { mediaItemId: 'm-1', positionSeconds: 150, durationSeconds: 600, paused: false },
      true,
    );
  });

  it('a native pause transition forces a paused=true report (the resume point)', async () => {
    const h = await bootDirectPlay();
    firePlaybackEvent(h, { event: 'pause', currentTime: 200, duration: 600 });

    expect(mockReporter.report).toHaveBeenCalledWith(
      { mediaItemId: 'm-1', positionSeconds: 200, durationSeconds: 600, paused: true },
      true,
    );
  });

  it('the natural end fires the COMPLETE signal (marks watched server-side)', async () => {
    const h = await bootDirectPlay();
    firePlaybackEvent(h, { event: 'ended', currentTime: 600, duration: 600 });

    expect(mockReporter.complete).toHaveBeenCalledTimes(1);
    expect(mockReporter.complete).toHaveBeenCalledWith('m-1');
  });

  it('unmounting mid-play flushes the LIVE position (no lost tail on quit)', async () => {
    const h = await bootDirectPlay();
    firePlaybackEvent(h, { event: 'play', currentTime: 100, duration: 600 });
    h.rerender(); // commit isPlaying → the live mirrors sync
    fireProgress(h, 245, 600);
    h.rerender();

    mockReporter.flush.mockClear();
    h.host.unmount();

    expect(mockReporter.flush).toHaveBeenCalledWith(
      { mediaItemId: 'm-1', positionSeconds: 245, durationSeconds: 600, paused: false },
    );
  });
});

// ── M-MOBILE-13: the seek choke point is syncplay-aware ───────────────────
// handleSeek is THE seam every seek surface (scrub-bar commit, ±15 buttons,
// SkipButton jumps) shares. Group law: the wire makes seeking a HOST-ONLY
// command (phlix-syncplay SPEC.md §9 item 2 — the server authorizes it by the
// connection's host identity), and a member-local seek desyncs from the group
// clock. So: host broadcasts `syncplay_playback_seek` in WIRE MS (S293), the
// member's seek is refused outright (and the bar renders non-capturing via
// canSeek), and the ungrouped path stays local-only with zero wire traffic.
describe('PlayerScreen — M-MOBILE-13 syncplay-aware seek routing', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    mockSyncplayStore.currentGroup = null;
    mockSyncplayStore.isHost = false;
  });

  async function bootGroupedAt42_5s(group: { isHost: boolean; grouped: boolean }) {
    if (group.grouped) {
      mockSyncplayStore.currentGroup = {
        id: 'sp_room13',
        name: 'Room',
        members: [],
        hostId: 'u-13',
      };
      mockSyncplayStore.isHost = group.isHost;
    }
    const h = await bootDirectPlay();
    (findPlayer(h.host.tree)!.props.onProgress as (e: unknown) => void)({
      nativeEvent: { currentTime: 42.5, duration: 600 },
    });
    h.rerender();
    return h;
  }

  const seekTo = (h: Awaited<ReturnType<typeof bootGroupedAt42_5s>>, seconds: number) => {
    (findSeekBar(h.host.tree)!.props.onSeek as (p: number) => void)(seconds);
    h.rerender();
  };

  it('grouped HOST: one drag-commit broadcasts the seek in WIRE MS, exact', async () => {
    const h = await bootGroupedAt42_5s({ grouped: true, isHost: true });
    // The host's bar is interactive.
    expect(findSeekBar(h.host.tree)!.props.canSeek).toBe(true);

    seekTo(h, 480);

    // EXACTLY one group command: from 42.5 s → 42_500 ms, to 480 s → 480_000 ms
    // (identity would carry 42.5/480 — 1000×-sensitive fixtures per S293 law).
    expect(mockSyncPlaySvc().sendSeek).toHaveBeenCalledTimes(1);
    expect(mockSyncPlaySvc().sendSeek).toHaveBeenCalledWith(42_500, 480_000);
    // The internal clock (and the native seekTo feed) stays SECONDS.
    expect(findSeekBar(h.host.tree)!.props.currentTime).toBe(480);
  });

  it('grouped MEMBER: bar is non-capturing AND the seek is refused (no desync)', async () => {
    const h = await bootGroupedAt42_5s({ grouped: true, isHost: false });
    expect(findSeekBar(h.host.tree)!.props.canSeek).toBe(false);

    // Even a seek driven straight into the choke point (the ±15/skip surfaces
    // share it, so the refusal must live HERE, not only in the bar's gating):
    seekTo(h, 480);

    expect(mockSyncPlaySvc().sendSeek).not.toHaveBeenCalled();
    // The member stays on the HOST timeline — no local seek landed.
    expect(findSeekBar(h.host.tree)!.props.currentTime).toBe(42.5);
  });

  it('UNGROUPED: seek stays local — zero wire traffic, clock moves', async () => {
    const h = await bootGroupedAt42_5s({ grouped: false, isHost: false });
    expect(findSeekBar(h.host.tree)!.props.canSeek).toBe(true);

    seekTo(h, 480);

    expect(mockSyncPlaySvc().sendSeek).not.toHaveBeenCalled();
    expect(findSeekBar(h.host.tree)!.props.currentTime).toBe(480);
  });
});

// ── M-MOBILE-14 (review mobile__gameux): the top bar survives 320–390pt ───
// The bar packs ✕ + up to six right-cluster targets; at 320pt the row's
// structural minimum (≈312pt, computed below IGNORING all glyph widths) blew
// past the ≈224pt cluster budget, and RN's flexShrink:0 default +
// `justifyContent: 'flex-end'` packed the overflow off the LEFT edge — the ✕
// (the exit affordance) clipped, worst during a SyncPlay group. The cure is
// the degradation law in `styles.topBar*` (flexWrap + shrinkable cluster box
// + non-shrinking targets), NOT a ScrollView (the M-MOBILE-13 responder
// SeekBar owns touch in this overlay — see src/components/player/SeekBar.tsx
// header @2666d4f).
//
// There is NO renderer in this repo's test deps, so the fit proof is a
// STATIC LAYOUT MEASUREMENT: widths, paddings and gaps are read from the very
// StyleSheet objects the mounted tree references (jest resolves
// StyleSheet.create to plain objects) and summed against the device budget.
// Reverting any law line turns the corresponding assertion red (the parent
// shipped none of it) — mutation-proven, see fixlog.
describe('PlayerScreen — M-MOBILE-14 narrow-screen top bar law', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    mockSyncplayStore.currentGroup = null;
    mockSyncplayStore.isHost = false;
  });

  /** StyleSheet props arrive as object | array | falsy — fold to one record. */
  const flat = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>(
        (acc, s) => Object.assign(acc, flat(s)),
        {},
      );
    }
    return style as Record<string, unknown>;
  };

  /** Ancestor chain (root → match) for the first node satisfying pred. */
  function findPath(node: unknown, pred: (el: El) => boolean, trail: El[] = []): El[] | null {
    if (Array.isArray(node)) {
      for (const child of node) {
        const r = findPath(child, pred, trail);
        if (r) return r;
      }
      return null;
    }
    if (isEl(node)) {
      const next = [...trail, node];
      if (pred(node)) return next;
      return findPath(node.props.children, pred, next);
    }
    return null;
  }

  /** The ✕ Text is bar-local identity: climb from it to (closeButton, topBar). */
  function barParts(tree: unknown): { close: El; topBar: El; cluster: El } {
    const path = findPath(tree, (el) => el.props.children === '✕');
    expect(path).not.toBeNull();
    const close = path![path!.length - 2];
    const topBar = path![path!.length - 3];
    const cluster = (Array.isArray(topBar.props.children) ? topBar.props.children : [])
      .filter(isEl)
      .find((c) => c !== close);
    expect(cluster).toBeDefined();
    return { close, topBar, cluster: cluster as El };
  }

  // Max crowded ONLINE state: ladder (quality pill) + subtitle rail (CC) +
  // audio rail (🎧) + group (SyncPlayOverlay pill) + running sleep timer
  // (countdown badge) + PiP = the full six-child right cluster. The offline
  // badge is EXCLUSIVE with the ladder by load path (a local file never
  // transcodes), so seven-simultaneous is unreachable — six is the worst set.
  async function bootMaxCrowding() {
    mockMarkerManager.getPlaybackInfo.mockResolvedValue(GOLDEN_PLAYBACK_INFO);
    mockSyncplayStore.currentGroup = {
      id: 'sp_bar14',
      name: 'The Very Long Room Name Of Endless Wonder',
      members: [],
      hostId: 'u-bar14',
    };
    mockSyncplayStore.isHost = false;
    const h = mount();
    h.render();
    await flush();
    h.rerender();
    // Ladder WITH one subtitle row so the transcode rail keeps CC alive.
    mockTranscodeManager.prepare.mockReturnValue({
      promise: Promise.resolve({
        ...LADDER,
        subtitles: [{ language: 'en', url: 'https://cdn.example/sub_en.vtt?sig=x' }],
      }),
      cancel: jest.fn(),
    });
    (findPlayer(h.host.tree)!.props.onError as (e: unknown) => void)({
      nativeEvent: { error: 'boom' },
    });
    await flush();
    h.rerender();
    // Start the sleep timer so the countdown badge replaces the 🌙 button.
    const menu = findEl(h.host.tree, (el) => el.type === SleepTimerMenu);
    (menu!.props.onSelect as (m: number) => void)(15);
    h.rerender();
    return h;
  }

  it('the cluster box wraps and shrinks; the row packs right and top-aligns', async () => {
    const h = await bootMaxCrowding();
    const { topBar, cluster } = barParts(h.host.tree);

    const bar = flat(topBar.props.style);
    expect(bar.flexDirection).toBe('row');
    expect(bar.justifyContent).toBe('flex-end');
    expect(bar.alignItems).toBe('flex-start'); // ✕ top-aligns the first wrap row
    expect(bar.paddingHorizontal).toBe(20);
    expect(bar.gap).toBe(12);

    const right = flat(cluster.props.style);
    expect(right.flexDirection).toBe('row');
    expect(right.flexWrap).toBe('wrap');
    expect(right.flexShrink).toBe(1); // THE hinge: shrinkable box lets wrap fire
    expect(right.justifyContent).toBe('flex-end');
    expect(right.gap).toBe(8);
  });

  it('the full six-target cluster renders, and every target keeps a pressable 44pt+ footprint', async () => {
    const h = await bootMaxCrowding();
    const { close, cluster } = barParts(h.host.tree);

    // All six members present in the tree (component-reference identity).
    const kids = (Array.isArray(cluster.props.children) ? cluster.props.children : [])
      .filter(isEl);
    expect(kids.some((k) => k.props.accessibilityLabel === 'Video quality')).toBe(true);
    expect(kids.some((k) => k.props.accessibilityLabel === 'Subtitles')).toBe(true);
    expect(kids.some((k) => k.props.accessibilityLabel === 'Audio tracks')).toBe(true);
    expect(kids.some((k) => k.type === SyncPlayOverlay)).toBe(true);
    expect(kids.some((k) => k.type === SleepTimerDisplay)).toBe(true);
    expect(kids.some((k) => k.props.accessibilityLabel === 'Picture in picture')).toBe(true);

    // Non-shrink law on the ✕ and every INLINE-styled target (the two pill
    // components enforce theirs in their own style sheets — asserted below).
    expect(flat(close.props.style).flexShrink).toBe(0);
    for (const k of kids) {
      if (k.type === SyncPlayOverlay || k.type === SleepTimerDisplay) continue;
      expect(flat(k.props.style).flexShrink).toBe(0);
    }

    // Hittable: every rendered target carries a real press handler.
    for (const k of kids) {
      expect(typeof k.props.onPress).toBe('function');
    }
    expect(typeof close.props.onPress).toBe('function');
  });

  it('static 320pt measurement: overflow premise is real, the wrap law resolves it', async () => {
    const h = await bootMaxCrowding();
    const { topBar, cluster } = barParts(h.host.tree);
    const bar = flat(topBar.props.style);
    const right = flat(cluster.props.style);
    const kids = (Array.isArray(cluster.props.children) ? cluster.props.children : [])
      .filter(isEl);

    // Device budgets (logical pt; topBar spans the full width edge-to-edge
    // inside the absolute overlay, safe-area insets only cost vertical space).
    const NARROWEST = 320; // iPhone SE (1st gen) class
    const mainstreamMax = 390; // iPhone 14/15, Pixel 7 class
    const structural = (bar.paddingHorizontal as number) * 2 + 44 /* ✕ */ + (bar.gap as number);

    // ZERO-Glyph structural minimum of one row (TEXT WIDTHS DELIBERATELY
    // EXCLUDED — the premise must not depend on font metrics):
    // 4 inline 44 circles + overlay minWidth + sleep badge paddingH only.
    const oneRowMin =
      kids.length * (right.gap as number) - (right.gap as number) +
      44 * 4 + // CC, audio, PiP, quality (quality: minWidth 44)
      80 + // SyncPlayOverlay minWidth
      10 * 2; // SleepTimerDisplay paddingHorizontal, no text
    const clusterBudgetAt = (w: number) => w - structural;

    // PREMISE (the bug, style-mathematically): one row exceeds the cluster
    // budget even at 390pt…
    expect(oneRowMin).toBeGreaterThan(clusterBudgetAt(mainstreamMax));
    expect(oneRowMin).toBeGreaterThan(clusterBudgetAt(NARROWEST));
    // …and on the parent the cluster could neither shrink nor wrap (both law
    // lines below were absent → RN default flexShrink 0 + flexWrap nowrap →
    // the overflow packed off the left edge and clipped the ✕).
    expect(right.flexWrap).toBe('wrap');
    expect(right.flexShrink).toBe(1);
    // RESOLUTION: with wrapping, clipping is impossible iff every single
    // target fits the narrowest cluster line by itself.
    for (const w of [NARROWEST, mainstreamMax]) {
      expect(44).toBeLessThanOrEqual(clusterBudgetAt(w));
      expect(80).toBeLessThanOrEqual(clusterBudgetAt(w));
    }
  });

  it('bar presses drive their real affordances (CC picker, quality menu)', async () => {
    const h = await bootMaxCrowding();
    const { cluster } = barParts(h.host.tree);
    const kids = (Array.isArray(cluster.props.children) ? cluster.props.children : [])
      .filter(isEl);

    const cc = kids.find((k) => k.props.accessibilityLabel === 'Subtitles')!;
    (cc.props.onPress as () => void)();
    h.rerender();
    expect(findRailModal(h.host.tree, SubtitleTrackList)!.props.visible).toBe(true);

    const quality = kids.find((k) => k.props.accessibilityLabel === 'Video quality')!;
    (quality.props.onPress as () => void)();
    h.rerender();
    expect(findQualityMenu(h.host.tree)!.props.visible).toBe(true);
  });

  it('SyncPlayOverlay: long room name truncates under its cap, full title stays announced, pill never squishes', () => {
    const LONG = 'The Very Long Room Name Of Endless Wonder — Season 4 Finale Watch Party';
    // The component reads the mocked store at CALL time (plain FC — no
    // renderer needed): set the group, then invoke.
    mockSyncplayStore.currentGroup = { id: 'sp_ov', name: LONG, members: [], hostId: 'u' };
    const tree = (SyncPlayOverlay as unknown as (p: { onPress: () => void }) => unknown)({
      onPress: () => undefined,
    });

    const path = findPath(tree, (el) => el.props.children === LONG);
    expect(path).not.toBeNull();
    const name = path![path!.length - 1];
    expect(name.props.numberOfLines).toBe(1); // truncates instead of pushing
    expect(name.props.accessibilityLabel).toBe(LONG); // FULL title still announced
    const nameStyle = flat(name.props.style);
    expect(typeof nameStyle.maxWidth).toBe('number'); // bounded growth
    expect(nameStyle.maxWidth as number).toBeLessThanOrEqual(100);

    // Container: non-shrink + a bounded min so the fit math above stays honest.
    const container = path![0];
    const containerStyle = flat(container.props.style);
    expect(containerStyle.flexShrink).toBe(0);
    expect(containerStyle.minWidth).toBe(80);
  });

  it('ungrouped 👥 button carries its accessibility label and a press handler', async () => {
    const h = await bootDirectPlay();
    const groupButton = findButton(h.host.tree, 'SyncPlay');
    expect(groupButton).not.toBeNull();
    expect(typeof groupButton!.props.onPress).toBe('function');
    expect(flat(groupButton!.props.style).flexShrink).toBe(0);
  });
});

// ── M-MOBILE-15 (review mobile__gameux): the "Auto-play next episode"
// toggle is wired ──────────────────────────────────────────────────────────
// Pre-fix the toggle persisted from Settings and NO component read it — the
// native player stopped at every episode end no matter what it said (settings
// theater). PlayerScreen's 'ended' arm now resolves the positional next
// episode through utils/autoplayNextEpisode over the EXISTING wire contract
// and replace()s into it. Every describe-level case below reddens on exactly
// one broken guard: toggle honored, wire untouched when OFF, non-episodic
// items keep the stop, failed loads never retry-storm, one attempt per item,
// SyncPlay groups and live streams are excluded. The global beforeEach pins
// the toggle OFF, so all sibling suites keep asserting the unchanged
// stop-behavior (this is itself the cure-proof: flipping the default here
// would leak autoplay into them and redden C17's complete-count tests).
describe('PlayerScreen — M-MOBILE-15 autoplay-next wiring', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    delete mockReporterRouteParams.streamUrl;
  });

  const fireEnded = (h: { host: HookHost }) => {
    const player = findPlayer(h.host.tree);
    (player!.props.onPlaybackEvent as (e: unknown) => void)({
      nativeEvent: { event: 'ended', currentTime: 600, duration: 600 },
    });
  };

  // Minimal episode world: m-1 = S1E1 of season s-1, sibling m-2 = S1E2.
  const EPISODE_M1 = { id: 'm-1', name: 'Pilot', type: 'episode', parent_id: 's-1', season_number: 1, episode_number: 1 };
  const SEASON_S1 = { id: 's-1', name: 'Season 1', type: 'season', parent_id: 'tv-1', season_number: 1 };
  const wireItem = (item: Record<string, unknown> | null) => ({
    getMediaItem: async (id: string) => {
      if (id === 'm-1') return item ?? null;
      if (id === 's-1') return SEASON_S1;
      throw new Error(`unexpected detail read ${id}`);
    },
    browseMedia: async ({ parentId }: { parentId: string }) => {
      if (parentId === 's-1') {
        return { items: [EPISODE_M1, { id: 'm-2', name: 'Second', type: 'episode', parent_id: 's-1', season_number: 1, episode_number: 2 }] };
      }
      throw new Error(`unexpected browse ${parentId}`);
    },
  });
  const installWire = (impls: { getMediaItem: (id: string) => Promise<unknown>; browseMedia: (p: { parentId: string }) => Promise<unknown> }) => {
    mockLibrary.getMediaItem.mockImplementation(impls.getMediaItem);
    mockLibrary.browseMedia.mockImplementation(impls.browseMedia);
  };

  it('toggle ON + episode with a sibling → replace() into the next id', async () => {
    mockSettings.autoPlayNextEpisode = true;
    installWire(wireItem(EPISODE_M1) as never);
    const h = await bootDirectPlay();
    fireEnded(h);
    await flush();
    expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).toHaveBeenCalledWith('Player', { itemId: 'm-2', startPosition: 0 });
    // The COMPLETE signal still lands — autoplay does not swallow the finish.
    expect(mockReporter.complete).toHaveBeenCalledWith('m-1');
  });

  it('toggle OFF (default) → the wire is never even asked; stop-behavior holds', async () => {
    installWire(wireItem(EPISODE_M1) as never);
    const h = await bootDirectPlay();
    // M-MOBILE-44 added a boot-time title read (getMediaItem(itemId)) to the
    // screen's lifecycle; the autoplay-arm law below is about the ENDED arm,
    // so clear the boot read before counting. (Live-title discipline is a
    // separate assertion; see the E8 case, which never clears because the
    // boot read is gated OFF for streams.)
    mockLibrary.getMediaItem.mockClear();
    fireEnded(h);
    await flush();
    expect(mockLibrary.getMediaItem).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockReporter.complete).toHaveBeenCalledWith('m-1');
  });

  it('toggle ON + non-episodic item → null resolution, no replace, no browse', async () => {
    mockSettings.autoPlayNextEpisode = true;
    const movie = { id: 'm-1', name: 'A Film', type: 'movie' };
    mockLibrary.getMediaItem.mockImplementation(async () => movie);
    const h = await bootDirectPlay();
    fireEnded(h);
    await flush();
    expect(mockLibrary.browseMedia).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('next-load failure → silent stop, exactly ONE wire attempt across two ended events', async () => {
    mockSettings.autoPlayNextEpisode = true;
    mockLibrary.getMediaItem.mockRejectedValue(new Error('500 from the wire'));
    const h = await bootDirectPlay();
    mockLibrary.getMediaItem.mockClear(); // boot title read (rejected, swallowed) is not an autoplay attempt
    fireEnded(h);
    await flush();
    fireEnded(h); // a second 'ended' for the same item must NOT retry-storm
    await flush();
    expect(mockLibrary.getMediaItem).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('a successful resolve is still ONE attempt per item (double ended → single replace)', async () => {
    mockSettings.autoPlayNextEpisode = true;
    installWire(wireItem(EPISODE_M1) as never);
    const h = await bootDirectPlay();
    mockLibrary.getMediaItem.mockClear(); // see boot-read note above
    fireEnded(h);
    await flush();
    fireEnded(h);
    await flush();
    expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
    expect(mockLibrary.getMediaItem).toHaveBeenCalledTimes(2); // m-1 + s-1, once
  });

  it('season finale → crosses into the FIRST episode of the next numbered season, skipping Specials', async () => {
    mockSettings.autoPlayNextEpisode = true;
    // m-1 is the ONLY episode of season 1 → exhausted listing.
    mockLibrary.getMediaItem.mockImplementation(async (id: string) => {
      if (id === 'm-1') return EPISODE_M1;
      if (id === 's-1') return SEASON_S1;
      if (id === 's-2') return { id: 's-2', name: 'Season 2', type: 'season', parent_id: 'tv-1', season_number: 2 };
      throw new Error(`unexpected detail read ${id}`);
    });
    mockLibrary.browseMedia.mockImplementation(async ({ parentId }: { parentId: string }) => {
      if (parentId === 's-1') return { items: [EPISODE_M1], total: 1 };
      if (parentId === 'tv-1') {
        return {
          items: [
            SEASON_S1,
            { id: 'sp-0', name: 'Specials', type: 'season', parent_id: 'tv-1', season_number: 0 },
            { id: 's-2', name: 'Season 2', type: 'season', parent_id: 'tv-1', season_number: 2 },
          ],
          total: 3,
        };
      }
      if (parentId === 's-2') return { items: [{ id: 'n-1', name: 'S2E1', type: 'episode', parent_id: 's-2', season_number: 2, episode_number: 1 }] };
      throw new Error(`unexpected browse ${parentId}`);
    });
    const h = await bootDirectPlay();
    fireEnded(h);
    await flush();
    expect(mockNavigation.replace).toHaveBeenCalledWith('Player', { itemId: 'n-1', startPosition: 0 });
  });

  it('SyncPlay grouped → suppressed entirely (the group owns media selection)', async () => {
    mockSettings.autoPlayNextEpisode = true;
    mockSyncplayStore.currentGroup = { id: 'g-1', name: 'watch party' };
    installWire(wireItem(EPISODE_M1) as never);
    const h = await bootDirectPlay();
    mockLibrary.getMediaItem.mockClear(); // boot title read is not a group-aware autoplay read
    fireEnded(h);
    await flush();
    expect(mockLibrary.getMediaItem).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    mockSyncplayStore.currentGroup = null;
  });

  it('live stream (E8 direct-URL params) → no autoplay, no COMPLETE, no wire reads', async () => {
    mockSettings.autoPlayNextEpisode = true;
    mockReporterRouteParams.streamUrl = 'https://live.example/cam.m3u8';
    installWire(wireItem(EPISODE_M1) as never);
    const h = await bootDirectPlay();
    fireEnded(h);
    await flush();
    expect(mockLibrary.getMediaItem).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockReporter.complete).not.toHaveBeenCalled();
  });
});

// ── M-MOBILE-44 (review mobile__gameux): the chrome says WHAT plays and
// every control names itself to screen readers ─────────────────────────────
// Pre-cure the player carried no title anywhere (liveTitle was a dead route
// param; on-demand items never surfaced their name) and the ✕/play/±15 glyphs
// were unlabeled emoji-text buttons. Law: title comes from liveTitle on the
// live lane (NO catalog read — the E8 lifecycle stays read-free, pinned by
// the M-MOBILE-15 suite's untouched "no wire reads" case) or from ONE
// fail-soft getMediaItem(itemId) on the on-demand lane; a failed/absent
// lookup renders no title, never an error.
describe('PlayerScreen — M-MOBILE-44 title + control labels', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    delete mockReporterRouteParams.liveTitle;
    mockLibrary.getMediaItem.mockReset();
  });

  const titleEl = (tree: unknown) =>
    findEl(tree, (el) => el.props.testID === 'playerMediaTitle');
  const labeled = (tree: unknown, label: string) =>
    findEl(tree, (el) => el.props.accessibilityLabel === label);

  it('liveTitle param renders verbatim and the catalog is NEVER asked', async () => {
    mockReporterRouteParams.streamUrl = 'https://live.example/cam.m3u8';
    mockReporterRouteParams.liveTitle = 'Friday Night Live';
    const h = await bootDirectPlay();
    expect(titleEl(h.host.tree)?.props.children).toBe('Friday Night Live');
    expect(mockLibrary.getMediaItem).not.toHaveBeenCalled();
    delete mockReporterRouteParams.streamUrl;
  });

  it('on-demand boot resolves the title from ONE getMediaItem(itemId) read', async () => {
    mockLibrary.getMediaItem.mockImplementation(async () => ({
      id: 'm-1',
      name: 'Big Buck Bunny',
    }));
    const h = await bootDirectPlay();
    await flush();
    h.rerender();
    expect(titleEl(h.host.tree)?.props.children).toBe('Big Buck Bunny');
    expect(mockLibrary.getMediaItem).toHaveBeenCalledTimes(1);
    expect(mockLibrary.getMediaItem).toHaveBeenCalledWith('m-1');
  });

  it('a failing lookup degrades to NO title — silent, never an error arm', async () => {
    mockLibrary.getMediaItem.mockRejectedValue(new Error('500 from the wire'));
    const h = await bootDirectPlay();
    await flush();
    h.rerender();
    expect(titleEl(h.host.tree)).toBeNull();
  });

  it('✕, ±15 and play/pause carry screen-reader labels; the toggle flips live', async () => {
    const h = await bootDirectPlay();
    expect(labeled(h.host.tree, 'Close player')).not.toBeNull();
    expect(labeled(h.host.tree, 'Rewind 15 seconds')).not.toBeNull();
    expect(labeled(h.host.tree, 'Forward 15 seconds')).not.toBeNull();
    const pp = labeled(h.host.tree, 'Play');
    expect(pp).not.toBeNull();
    (pp!.props.onPress as () => void)();
    h.rerender();
    expect(labeled(h.host.tree, 'Pause')).not.toBeNull();
    expect(labeled(h.host.tree, 'Play')).toBeNull();
  });
});

// ── M-MOBILE-02 (review mobile__casualgamer): the 📺 PiP control is not
// decorative on Android any more ───────────────────────────────────────────
// Android's native receiveCommand handles ONLY play|pause|seekTo|setVolume|
// setMuted (PhlixPlayerViewManager.kt:56-75 — `startPiP` matches no branch),
// so before this cure the button existed on Android to silently do nothing
// (finding: "renders unconditionally … on Android it's decorative"). The
// button is now an iOS-only affordance: the iOS PiP surface genuinely exists
// (PhlixPlayerView.swift). The full Android background story (MediaSession /
// foreground service) stays feature-scale and is disclosed in the README.
describe('PlayerScreen — M-MOBILE-02 PiP affordance is iOS-only', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    (RNPlatform as unknown as { OS: 'ios' | 'android' }).OS = 'ios';
  });

  const pipEl = (tree: unknown) =>
    findEl(tree, (el) => el.props.accessibilityLabel === 'Picture in picture');

  it('iOS boot renders the PiP control (gate is platform, not removal)', async () => {
    const h = await bootDirectPlay();
    expect(pipEl(h.host.tree)).not.toBeNull();
  });

  it('Android boot renders NO PiP control — the decorative affordance is gone', async () => {
    (RNPlatform as unknown as { OS: 'ios' | 'android' }).OS = 'android';
    const h = await bootDirectPlay();
    expect(pipEl(h.host.tree)).toBeNull();
    // The rest of the top cluster still renders (this is a gate, not a wipe).
    expect(findEl(h.host.tree, (el) => el.props.accessibilityLabel === 'Close player')).not.toBeNull();
  });
});

// ── M-MOBILE-44 first clause (review mobile__gameux, r2 cure): what the 3s
// auto-hide may take is the CHROME — never the progress bar ─────────────────
// The finding: "controls auto-hide after 3s while the *decorative* seek bar is
// part of what hides". The W-min55 batch cured the item's title/label clauses
// but shipped the bar still inside the auto-hiding overlay — the reviewer
// convicted the overclaim. The cure is structural: the SeekBar renders on a
// persistent rail OUTSIDE that gate. Law pinned here, three ways:
//  1. after the 3s auto-hide the bar SURVIVES (progress stays on screen) while
//     the chrome is gone;
//  2. while hidden the rail is display-only (pointerEvents='none' — a tap on
//     it falls through to the video surface and REVEALS the controls rather
//     than risking an unintended seek), and with the chrome up it is the
//     interactive scrubber again; the video toggle brings chrome + interactivity
//     back together;
//  3. live TV grows NO rail — with no duration clock its bar is a 0:00
//     artifact, so there the chrome may hide everything (pre-cure behavior).
// Timers: fake-timers are armed AFTER boot (boot's flush rides the real
// setImmediate); the 300ms Animated fade and its completion callback run under
// the same faked clock, so one 3000ms + 400ms advance lands the hide.
describe('PlayerScreen — M-MOBILE-44 r2 persistent progress rail', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
    jest.useRealTimers();
    delete mockReporterRouteParams.streamUrl;
    delete mockReporterRouteParams.liveTitle;
  });

  const railEl = (tree: unknown) =>
    findEl(tree, (el) => el.props.testID === 'playerProgressRail');
  // The video-surface TouchableOpacity is the tree's ONLY activeOpacity={1}.
  const videoToggle = (tree: unknown) =>
    findEl(
      tree,
      (el) => el.props.activeOpacity === 1 && typeof el.props.onPress === 'function',
    );

  async function bootPlaying() {
    const h = await bootDirectPlay();
    jest.useFakeTimers();
    pressPlayPause(h.host.tree); // isPlaying=true → the 3s auto-hide timer arms
    h.rerender();
    return h;
  }

  const AUTO_HIDE_MS = 3000;
  const FADE_MS = 300;

  it('after the 3s auto-hide the chrome is gone and the seek bar SURVIVES', async () => {
    const h = await bootPlaying();
    // Chrome up: rail present and interactive.
    expect(railEl(h.host.tree)?.props.pointerEvents).toBe('auto');
    expect(findButton(h.host.tree, 'Close player')).not.toBeNull();

    jest.advanceTimersByTime(AUTO_HIDE_MS + FADE_MS + 100);
    h.rerender();

    // Chrome gone…
    expect(findButton(h.host.tree, 'Close player')).toBeNull();
    // …progress stays on screen (pre-cure: the bar lived in the overlay and
    // vanished with it — the exact defect this r2 pins dead).
    const bar = findSeekBar(h.host.tree);
    expect(bar).not.toBeNull();
    expect(bar!.props.canSeek).toBe(true); // direct play, no group: host-side law intact
    // While hidden the rail must not eat the reveal tap: display-only.
    expect(railEl(h.host.tree)?.props.pointerEvents).toBe('none');
  });

  it('tapping the video brings the chrome AND rail interactivity back', async () => {
    const h = await bootPlaying();
    jest.advanceTimersByTime(AUTO_HIDE_MS + FADE_MS + 100);
    h.rerender();
    expect(railEl(h.host.tree)?.props.pointerEvents).toBe('none');

    (videoToggle(h.host.tree)!.props.onPress as () => void)();
    h.rerender();
    expect(findButton(h.host.tree, 'Close player')).not.toBeNull();
    expect(railEl(h.host.tree)?.props.pointerEvents).toBe('auto');
  });

  it('live TV grows no rail — the 0:00 artifact bar hides with the chrome', async () => {
    mockReporterRouteParams.streamUrl = 'https://live.example/cam.m3u8';
    mockReporterRouteParams.liveTitle = 'Friday Night Live';
    const h = await bootDirectPlay();
    // Chrome up, live lane: no rail, no SeekBar anywhere in the tree.
    expect(railEl(h.host.tree)).toBeNull();
    expect(findSeekBar(h.host.tree)).toBeNull();
    // The rest of the chrome is a gate, not a wipe.
    expect(findButton(h.host.tree, 'Close player')).not.toBeNull();
  });
});

// ── M-MOBILE-01 (review mobile__casualgamer #1): the "Autoplay" toggle ────
// Used to be persisted, rendered, and read by NOTHING while the screen
// hardcoded autoPlay={true} on the native view — settings theater. The
// native start-immediately prop is its one legitimate consumer; wired there,
// the toggle now actually decides whether playback begins on open.
describe('PlayerScreen — M-MOBILE-01 Autoplay toggle drives the native prop', () => {
  afterEach(() => {
    mountedHost?.unmount();
    mountedHost = null;
  });

  // The generic view finder: the shared findPlayer keys on autoPlay === true,
  // which is exactly the law under test, so locate the element structurally.
  const findNativeView = (tree: unknown): El | null =>
    findEl(
      tree,
      (el) => 'startPosition' in el.props && typeof el.props.onProgress === 'function',
    );

  it('toggle OFF → the native view is handed autoPlay=false (no start on open)', async () => {
    mockSettings.autoplay = false;
    const h = await bootDirectPlay();
    const player = findNativeView(h.host.tree);
    expect(player).not.toBeNull();
    expect(player!.props.autoPlay).toBe(false);
  });

  it('toggle ON (default) → the native view is handed autoPlay=true (unchanged behavior)', async () => {
    mockSettings.autoplay = true;
    const h = await bootDirectPlay();
    const player = findNativeView(h.host.tree);
    expect(player).not.toBeNull();
    expect(player!.props.autoPlay).toBe(true);
  });
});
