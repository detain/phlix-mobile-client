/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/cast/__tests__/CastSessionPill.test.tsx
//
// M-MOBILE-16 re-entry affordance. Drives the pill through the REAL cast store
// (only the HTTP CastManager is stubbed) and asserts the four laws the review
// asked for: (a) a live-but-dismissed session yields a reachable pill; (b) the
// pill re-opens the controller with the STORED media params; (c) the pill's
// own poll drives server-confirmed retirement; (d) no session renders nothing.
// Same hook host as PlayerScreen/CastScreen tests (no renderer in test deps).

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

jest.mock('../../../stores/useCastStore', () => {
  const actual = jest.requireActual('../../../stores/useCastStore');
  const real = actual.useCastStore;
  const hook = (sel: (s: unknown) => unknown) => sel(real.getState());
  return {
    useCastStore: Object.assign(hook, {
      getState: () => real.getState(),
      setState: (partial: object) => real.setState(partial),
    }),
  };
});

jest.mock('../../../api/CastManager', () => ({
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

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
}));

import { CastSessionPill } from '../CastSessionPill';
import { useCastStore } from '../../../stores/useCastStore';
import { castManager } from '../../../api/CastManager';
import type { CastDevice } from '../../../types/cast';

const mocked = castManager as jest.Mocked<typeof castManager>;
const tv: CastDevice = { backend: 'chromecast', id: 'cc1', name: 'Living Room TV' };

const resetAll = () => {
  jest.clearAllMocks();
  mockNavigation.navigate.mockReset();
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
};

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

const mount = () => {
  const host = new HookHost();
  mountedHost = host;
  host.render(() => (CastSessionPill as unknown as () => unknown)());
  return host;
};

type El = { type: unknown; props: Record<string, unknown> };
const isEl = (n: unknown): n is El =>
  typeof n === 'object' && n !== null && 'props' in (n as El);

const collectText = (node: unknown, acc: string[] = []): string[] => {
  if (typeof node === 'string' || typeof node === 'number') acc.push(String(node));
  else if (Array.isArray(node)) for (const c of node) collectText(c, acc);
  else if (isEl(node)) collectText(node.props.children, acc);
  return acc;
};

const pressPill = (host: HookHost) => {
  const walk = (node: unknown): (() => void) | null => {
    if (Array.isArray(node)) {
      for (const c of node) {
        const r = walk(c);
        if (r) return r;
      }
      return null;
    }
    if (!isEl(node)) return null;
    if (typeof node.props.onPress === 'function' && collectText(node).some((t) => t.includes('Casting to'))) {
      return node.props.onPress as () => void;
    }
    return walk(node.props.children);
  };
  const onPress = walk(host.tree);
  if (!onPress) throw new Error('pill not rendered');
  onPress();
};

afterEach(() => {
  mountedHost?.unmount();
  mountedHost = null;
});

describe('CastSessionPill — M-MOBILE-16', () => {
  beforeEach(resetAll);

  it('(d) renders NOTHING without a session', () => {
    const host = mount();
    expect(host.tree).toBeNull();
  });

  it('renders NOTHING while the Cast screen itself is up', async () => {
    mocked.status.mockResolvedValue({ active: true, state: 'playing' });
    await useCastStore.getState().castTo(tv, { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' });
    useCastStore.getState().setScreenVisible(true);

    const host = mount();
    expect(host.tree).toBeNull();
    // The pill must not double-poll while the screen owns the status read.
    expect(mocked.status).not.toHaveBeenCalled();
  });

  it('(a) surfaces a reachable pill for a live, dismissed session', async () => {
    mocked.status.mockResolvedValue({ active: true, state: 'playing', sessionId: 's1' });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm1',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Show',
    });
    useCastStore.getState().setScreenVisible(false); // Done dismissed the screen

    const host = mount();
    await flush();
    host.rerender();

    expect(host.tree).not.toBeNull();
    expect(collectText(host.tree).join('').includes('Casting to Living Room TV')).toBe(true);
    // The pill owns the poll while the screen is away.
    expect(mocked.status).toHaveBeenCalledWith(tv);
  });

  it('(b) re-opens the controller with the STORED session params', async () => {
    mocked.status.mockResolvedValue({ active: true, state: 'playing' });
    await useCastStore.getState().castTo(tv, {
      mediaItemId: 'm1',
      mediaUrl: 'https://srv/x.m3u8',
      title: 'Show',
      durationSecs: 90,
    });
    useCastStore.getState().setScreenVisible(false);

    const host = mount();
    await flush();
    host.rerender();

    pressPill(host);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Cast', {
      mediaItemId: 'm1',
      streamUrl: 'https://srv/x.m3u8',
      title: 'Show',
      durationSecs: 90,
    });
  });

  it('renders NOTHING when a session has no stored media (cannot deliver control)', async () => {
    // Hand-craft an activeDevice with null activeMedia: no honest re-entry is
    // possible, so the pill must not promise one.
    useCastStore.setState({ activeDevice: tv, activeMedia: null, screenVisible: false });

    const host = mount();
    expect(host.tree).toBeNull();
  });

  it('(c) the pill poll drives server-confirmed retirement', async () => {
    mocked.status.mockResolvedValue({ active: true, state: 'playing' });
    await useCastStore.getState().castTo(tv, { mediaItemId: 'm1', mediaUrl: 'u', title: 'X' });
    useCastStore.getState().setScreenVisible(false);

    const host = mount();
    await flush();
    host.rerender();
    expect(host.tree).not.toBeNull();

    // Next poll the server reports the cast has ended → the store retires the
    // slot → the pill disappears on the following render.
    mocked.status.mockResolvedValue({ active: false });
    // trigger another refreshStatus via the store directly (the interval body).
    await useCastStore.getState().refreshStatus();
    host.rerender();

    expect(useCastStore.getState().activeDevice).toBeNull();
    expect(host.tree).toBeNull();
    expect(mocked.stop).not.toHaveBeenCalled();
  });
});
