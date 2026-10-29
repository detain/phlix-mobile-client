/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/CastScreen.test.tsx
//
// M-MOBILE-16: the Cast controller must stay REACHABLE after dismissal. These
// tests drive the REAL screen through the REAL cast store state machine (the
// zustand hook is bridged to the actual store; only the HTTP-level
// CastManager is stubbed) so the assertions are about session lifecycle, not
// props: Done no longer drops the session; the pill-visibility law is true
// for the post-dismiss store state; re-entry renders the STORED session;
// Stop and Switch-device behave exactly as the lifecycle law demands.
//
// The repo has NO React renderer in test deps (see PlayerScreen.test.tsx's
// rationale), so we reuse that file's purpose-built hook host.

// ── controlled hook host (ported from PlayerScreen.test.tsx) ─────────────
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

const mockHost: { current: HookHost | null } = { current: null };
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

// ── the REAL store, viewed through a host-safe hook ──────────────────────
// The zustand hook form crashes outside a real React render
// (useSyncExternalStore), but every ACTION runs for real: this bridge keeps
// the full state machine (castTo retention, server-confirmed retirement,
// screen visibility) under test.
interface CastStoreLike {
  getState: () => any;
  setState: (partial: object) => void;
}
jest.mock('../../stores/useCastStore', () => {
  const actual = jest.requireActual('../../stores/useCastStore');
  const real: CastStoreLike = actual.useCastStore;
  const hook = (sel: (s: unknown) => unknown) => sel(real.getState());
  return {
    useCastStore: Object.assign(hook, {
      getState: () => real.getState(),
      setState: (partial: object) => real.setState(partial),
    }),
  };
});

// HTTP-level cast transport stub — the manager's wire behavior is pinned in
// src/api/__tests__/CastManager.test.ts; here we only observe the CALLS.
jest.mock('../../api/CastManager', () => ({
  castManager: {
    discover: jest.fn(),
    castTo: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    seek: jest.fn(),
    status: jest.fn(),
  },
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};
const mockRouteParams: { current: Record<string, unknown> } = { current: {} };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams.current }),
}));

import CastScreen from '../CastScreen';
import { useCastStore } from '../../stores/useCastStore';
import { isCastPillVisible } from '../../components/cast/castPillHelpers';
import { castManager } from '../../api/CastManager';
import { FlatList } from 'react-native';
import type { CastDevice } from '../../types/cast';

const mocked = castManager as jest.Mocked<typeof castManager>;

const tv: CastDevice = { backend: 'chromecast', id: 'cc1', name: 'Living Room TV' };

const resetAll = () => {
  jest.clearAllMocks();
  useCastStore.setState({
    devices: [],
    isDiscovering: false,
    discoverError: null,
    activeDevice: null,
    activeSession: null,
    activeMedia: null,
    transport: null,
    transportError: null,
    screenVisible: false,
  });
  mockNavigation.navigate.mockReset();
  mockNavigation.goBack.mockReset();
  mockRouteParams.current = {
    mediaItemId: 'm1',
    streamUrl: 'https://srv/stream.m3u8',
    title: 'Different Movie',
    durationSecs: 120,
  };
};

// Microtask flush for fire-and-forget void promises inside effects/handlers.
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

const mount = () => {
  const host = new HookHost();
  mountedHost = host;
  host.render(() => (CastScreen as unknown as () => unknown)());
  return host;
};

// ── tree helpers (elements are never evaluated; we walk them) ────────────
type El = { type: unknown; props: Record<string, unknown> };
const isEl = (n: unknown): n is El =>
  typeof n === 'object' && n !== null && 'props' in (n as El);

const collectText = (node: unknown, acc: string[] = []): string[] => {
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
  } else if (Array.isArray(node)) {
    for (const child of node) collectText(child, acc);
  } else if (isEl(node)) {
    collectText(node.props.children, acc);
  }
  return acc;
};

const hasText = (el: unknown, needle: string): boolean =>
  collectText(el).join('').includes(needle);

/** Nearest pressable ancestor-or-self containing `needle` in its subtree. */
const findPressable = (node: unknown, needle: string): El | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const r = findPressable(child, needle);
      if (r) return r;
    }
    return null;
  }
  if (!isEl(node)) return null;
  const hasPress = typeof node.props.onPress === 'function';
  if (hasPress && hasText(node, needle)) {
    // Prefer the SMALLEST pressable subtree containing the needle: keep
    // descending; only return self if no pressable child also matches.
    const inner = findPressable(node.props.children, needle);
    return inner ?? node;
  }
  return findPressable(node.props.children, needle);
};

const press = (host: HookHost, needle: string) => {
  const el = findPressable(host.tree, needle);
  if (!el) throw new Error(`no pressable containing "${needle}"`);
  (el.props.onPress as () => void)();
  return el;
};

// The picker renders through FlatList.renderItem — inert elements are never
// evaluated, so the device card is produced by INVOKING renderItem (same
// direct-invocation precedent as PlayerScreen.test's overlay handling).
const pressDeviceCard = (host: HookHost, device: CastDevice) => {
  const walk = (node: unknown): El | null => {
    if (Array.isArray(node)) {
      for (const c of node) {
        const r = walk(c);
        if (r) return r;
      }
      return null;
    }
    if (!isEl(node)) return null;
    if (node.type === FlatList) return node;
    return walk(node.props.children);
  };
  const list = walk(host.tree);
  if (!list || typeof list.props.renderItem !== 'function') {
    throw new Error('picker FlatList not rendered');
  }
  const card = (list.props.renderItem as (a: { item: CastDevice }) => unknown)({
    item: device,
  });
  const pressable = findPressable(card, device.name);
  if (!pressable) throw new Error('device card not pressable');
  (pressable.props.onPress as () => void)();
};

beforeEach(resetAll);

afterEach(() => {
  mountedHost?.unmount();
  mountedHost = null;
});

describe('CastScreen — M-MOBILE-16 session persistence', () => {
  it('picker → select → transport view; Done keeps the session and hands reachability to the pill', async () => {
    mocked.discover.mockResolvedValue([tv]);
    mocked.castTo.mockResolvedValue({ sessionId: 's1', deviceId: 'cc1', state: 'playing' });
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });

    const host = mount();
    await flush();
    host.rerender();
    // Discovery picker with the found device.
    expect(hasText(host.tree as El, 'Cast to a device')).toBe(true);

    pressDeviceCard(host, tv);
    await flush();
    host.rerender();
    // Transport view for the fresh session.
    expect(hasText(host.tree as El, '⏸ Pause')).toBe(true);

    press(host, 'Done — keep casting to');
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    // THE FIX: dismissing no longer drops the session.
    const state = useCastStore.getState();
    expect(state.activeDevice).toEqual(tv);
    expect(state.activeMedia?.mediaItemId).toBe('m1');

    host.unmount();
    mountedHost = null;
    const after = useCastStore.getState();
    expect(after.screenVisible).toBe(false);
    // Reachability law: the pill is up the moment the screen is not.
    expect(isCastPillVisible(after.activeDevice, after.screenVisible)).toBe(true);
  });

  it('native header back (unmount WITHOUT any in-screen action) has identical session semantics', async () => {
    mocked.discover.mockResolvedValue([]);
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm9',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Stored Show',
    });

    const host = mount();
    await flush();
    expect(useCastStore.getState().screenVisible).toBe(true);

    // The native back bypasses every in-screen handler: plain unmount.
    host.unmount();
    mountedHost = null;
    const after = useCastStore.getState();
    expect(after.activeDevice).toEqual(tv);
    expect(after.screenVisible).toBe(false);
    expect(isCastPillVisible(after.activeDevice, after.screenVisible)).toBe(true);
    expect(mocked.stop).not.toHaveBeenCalled();
  });

  it('re-entry renders the STORED session device+title, never the launching route params', async () => {
    mocked.discover.mockResolvedValue([]);
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm9',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Stored Show',
    });

    // Re-entered from a DIFFERENT title's detail page.
    mockRouteParams.current = {
      mediaItemId: 'other',
      streamUrl: 'https://srv/other.m3u8',
      title: 'Different Movie',
    };
    const host = mount();
    await flush();
    host.rerender();

    expect(hasText(host.tree as El, 'Stored Show')).toBe(true);
    expect(hasText(host.tree as El, 'Living Room TV')).toBe(true);
    expect(hasText(host.tree as El, 'Different Movie')).toBe(false);
    // The mount takes over the poll with an immediate status read.
    expect(mocked.status).toHaveBeenCalledWith(tv);
  });

  it('Stop from re-entry halts the device, clears the slot, and retires the pill', async () => {
    mocked.discover.mockResolvedValue([]);
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });
    mocked.stop.mockResolvedValue(undefined);
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm9',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Stored Show',
    });

    const host = mount();
    await flush();
    host.rerender();
    // Only one control surface while the screen is up.
    expect(useCastStore.getState().screenVisible).toBe(true);

    press(host, '⏹ Stop');
    await flush();

    expect(mocked.stop).toHaveBeenCalledWith(tv);
    const after = useCastStore.getState();
    expect(after.activeDevice).toBeNull();
    expect(after.activeMedia).toBeNull();
    expect(isCastPillVisible(after.activeDevice, after.screenVisible)).toBe(false);
  });

  it('Switch device detaches WITHOUT stopping and re-opens the picker', async () => {
    mocked.discover.mockResolvedValue([tv]);
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm9',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Stored Show',
    });

    const host = mount();
    await flush();
    host.rerender();

    press(host, 'Switch device');
    // Synchronous store primitive — no await needed.
    expect(mocked.stop).not.toHaveBeenCalled();
    const mid = useCastStore.getState();
    expect(mid.activeDevice).toBeNull();
    expect(mid.activeMedia).toBeNull();

    host.rerender();
    expect(hasText(host.tree as El, 'Cast to a device')).toBe(true);
    const after = useCastStore.getState();
    expect(isCastPillVisible(after.activeDevice, after.screenVisible)).toBe(false);
  });

  it('server-confirmed end WHILE ON the transport view retires the screen to the picker', async () => {
    mocked.discover.mockResolvedValue([tv]);
    mocked.status.mockResolvedValue({ active: false });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm9',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Stored Show',
    });

    const host = mount();
    await flush(); // the mount's immediate refreshStatus reads active:false
    host.rerender();

    expect(useCastStore.getState().activeDevice).toBeNull();
    expect(hasText(host.tree as El, 'Cast to a device')).toBe(true);
    expect(mocked.stop).not.toHaveBeenCalled();
  });
});
