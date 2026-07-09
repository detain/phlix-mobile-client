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

import { AUTO_QUALITY } from '@phlix/contracts';

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
    setCurrentSubtitleTrackId: jest.fn(),
    setStreamInfo: jest.fn(),
    setSubtitleTracks: jest.fn(),
    setAudioTracks: jest.fn(),
    setCurrentTime: jest.fn(),
    setDuration: jest.fn(),
    setIsPlaying: jest.fn(),
  };
  return { __state: state, usePlayerStore: (sel: (s: unknown) => unknown) => sel(state) };
});

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
import PlayerScreen from '../PlayerScreen';

const mockSettings = (jest.requireMock('../../stores/useSettingsStore') as any).__state as {
  defaultQuality: string;
  setDefaultQuality: jest.Mock;
};
const mockPlayerStore = (jest.requireMock('../../stores/usePlayerStore') as any).__state as {
  subtitleTracks: unknown[];
  currentSubtitleTrackId: string | null;
};
const mockPlaybackManager = (jest.requireMock('../../api/PlaybackManager') as any)
  .playbackManager as { getStreamUrl: jest.Mock };
const mockTranscodeManager = (jest.requireMock('../../api/TranscodeManager') as any)
  .transcodeManager as { prepare: jest.Mock };
const mockMarkerManager = (jest.requireMock('../../api/MarkerManager') as any)
  .markerManager as { getPlaybackInfo: jest.Mock };
const mockDownloadService = (jest.requireMock('../../services/DownloadService') as any)
  .downloadService as { getItemLocalPath: jest.Mock };

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
  mockSettings.defaultQuality = AUTO_QUALITY;
  mockPlayerStore.subtitleTracks = [];
  mockPlayerStore.currentSubtitleTrackId = null;
  mockDownloadService.getItemLocalPath.mockReturnValue(null);
  mockPlaybackManager.getStreamUrl.mockResolvedValue('https://cdn/direct.mp4');
  mockMarkerManager.getPlaybackInfo.mockResolvedValue({
    intro_marker: null,
    outro_marker: null,
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
