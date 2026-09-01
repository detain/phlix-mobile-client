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
import type { AudioTrack, SubtitleTrack } from '../../types/playback';
import { SubtitleTrackList } from '../../components/player/SubtitleTrackList';
import { AudioTrackList } from '../../components/player/AudioTrackList';

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
  const state = { defaultQuality: 'auto', setDefaultQuality: jest.fn() };
  return { __state: state, useSettingsStore: (sel: (s: unknown) => unknown) => sel(state) };
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
}));

jest.mock('../../store/syncplayStore', () => {
  const state = {
    currentGroup: null,
    isHost: false,
    timeSyncStable: false,
    error: null,
    updatePlaybackState: jest.fn(),
  };
  return { __state: state, useSyncplayStore: (sel: (s: unknown) => unknown) => sel(state) };
});

jest.mock('../../api/PlaybackManager', () => ({ playbackManager: { getStreamUrl: jest.fn() } }));
jest.mock('../../api/TranscodeManager', () => ({ transcodeManager: { prepare: jest.fn() } }));
jest.mock('../../api/MarkerManager', () => ({ markerManager: { getPlaybackInfo: jest.fn() } }));
jest.mock('../../services/DownloadService', () => ({
  downloadService: { getItemLocalPath: jest.fn() },
}));
jest.mock('../../syncplay/SyncPlayService', () => ({
  syncPlayService: {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendPlay: jest.fn(),
    sendPause: jest.fn(),
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
const mockTranscodeManager = (jest.requireMock('../../api/TranscodeManager') as any)
  .transcodeManager as { prepare: jest.Mock };
const mockMarkerManager = (jest.requireMock('../../api/MarkerManager') as any)
  .markerManager as { getPlaybackInfo: jest.Mock };
const mockDownloadService = (jest.requireMock('../../services/DownloadService') as any)
  .downloadService as { getItemLocalPath: jest.Mock };
const mockSyncplayStore = (jest.requireMock('../../store/syncplayStore') as any)
  .__state as { isHost: boolean; currentGroup: unknown };
const mockSyncPlaySvc = () =>
  (jest.requireMock('../../syncplay/SyncPlayService') as any).syncPlayService as {
    sendPlay: jest.Mock;
    sendPause: jest.Mock;
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
