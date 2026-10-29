/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/useFocusRefetch.test.ts
//
// M-MOBILE-17 (review mobile__gameux M-F): the navigation-adapter half. The
// repo has NO React renderer in test deps (see SkipButton.test.tsx doctrine),
// so the hook is driven through a tiny slot-backed host: useRef hands back a
// stable {current} object per call-site index, useCallback advances the cursor
// and hands back the fresh function. `useFocusEffect` is mocked to COLLECT
// its callback; invoking that captured callback IS the focus event.
//
// M-MOBILE-18 (review mobile__gameux M-G) adds the useEffect half: the host
// runs a call-site's effect exactly ONCE (deps [] — mount semantics), keeps
// its unsubscribe, and `unmountAll()` models the screen going away. The hub
// store is the REAL zustand store: bumping `serverGeneration` through
// setState IS the server switch from the hook's point of view.
//
// Red→green laws pinned:
//   1. a mount focus fires ZERO refetches (load-on-mount owns cold data);
//   2. a re-focus after the staleness window fires EXACTLY ONE refetch — the
//      cure itself (TV changed the rails → the phone re-pulls on tab switch);
//   3. a re-focus inside the window fires ZERO (existing data freshness);
//   4. the LATEST loader closure is the one invoked across re-renders;
//   5. a synchronous loader throw never escapes the focus callback;
//   6. a server-generation move refetches the mounted screen IMMEDIATELY and
//      re-arms the window (no double-fetch on the next focus);
//   7. unrelated hub writes never wake the invalidation channel;
//   8. unmount unsubscribes — a dead screen never refetches.

import { useFocusRefetch } from '../useFocusRefetch';
import { DEFAULT_MIN_INTERVAL_MS } from '../focusRefetchGate';
import { useHubStore } from '../../store/hubStore';

// ── collected focus effects (mock-prefixed name: jest hoisting rule) ───────
const mockFocusCallbacks: Array<() => unknown> = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => unknown) => {
    mockFocusCallbacks.push(cb);
  },
}));

// ── slot-backed hook host (useRef + useCallback + useEffect) ───────────────
class SlotHost {
  private slots: Array<Record<string, unknown>> = [];
  private effectSlots: Array<{ ran: boolean; unsub: (() => void) | undefined }> = [];
  private cursor = 0;

  useRef<T>(init: T | null): { current: T | null } {
    const i = this.cursor++;
    if (this.slots[i] === undefined) {
      this.slots[i] = { current: init };
    }
    return this.slots[i] as unknown as { current: T | null };
  }

  useCallback<F extends (...args: never[]) => unknown>(fn: F): F {
    this.cursor++;
    return fn;
  }

  /**
   * Mount semantics for deps-[] effects (every effect this hook owns): the
   * call-site runs EXACTLY once per mount; re-renders advance the cursor and
   * skip. The returned unsubscribe is kept so `unmountAll()` can model the
   * screen going away — a leaked subscription would keep refetching dead UI.
   */
  useEffect(fn: () => (() => void) | void): void {
    const i = this.cursor++;
    if (this.effectSlots[i]?.ran) {
      return;
    }
    const unsub = fn();
    this.effectSlots[i] = {
      ran: true,
      unsub: typeof unsub === 'function' ? unsub : undefined,
    };
  }

  unmountAll(): void {
    this.effectSlots.forEach((slot) => slot?.unsub?.());
    this.effectSlots = [];
  }

  render<R>(fn: () => R): R {
    this.cursor = 0;
    return fn();
  }
}

// Route the hook's React imports through the host. `mock`-prefix for hoisting.
const mockHost = { current: new SlotHost() };

jest.mock('react', () => ({
  useRef: <T,>(init: T | null) => mockHost.current.useRef<T>(init),
  useCallback: <F extends (...args: never[]) => unknown>(fn: F): F =>
    mockHost.current.useCallback(fn),
  useEffect: (fn: () => (() => void) | void) =>
    mockHost.current.useEffect(fn),
}));

/** Epoch clock the gate reads via Date.now — tests move TIME through this. */
let nowMs = 1_000_000;

function fireFocus(): void {
  // Real navigation calls the collected callback on every focus transition;
  // identity is stable (useCallback []), so the FIRST capture is the live one.
  const cb = mockFocusCallbacks[0];
  if (!cb) {
    throw new Error('useFocusEffect never registered — hook not rendered?');
  }
  cb();
}

beforeAll(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  // Kill the previous screen's live subscription BEFORE swapping hosts, and
  // rewind the generation so tests start from the store's cold shape.
  mockHost.current.unmountAll();
  mockFocusCallbacks.length = 0;
  mockHost.current = new SlotHost();
  useHubStore.setState({ serverGeneration: 0 });
  nowMs = 1_000_000;
});

describe('useFocusRefetch — focus-driven liveness (M-MOBILE-17)', () => {
  it('mount focus fires zero refetches; a stale re-focus fires exactly one; a fresh re-focus fires zero', () => {
    const loader = jest.fn();
    mockHost.current.render(() => useFocusRefetch(loader));
    expect(mockFocusCallbacks).toHaveLength(1);

    // (1) mount focus — cold load already happened elsewhere.
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(0);

    // (3) re-focus inside the window — existing data is fresh, no stampede.
    nowMs += DEFAULT_MIN_INTERVAL_MS - 1;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(0);

    // (2) re-focus past the window — THE CURE: TV/web changes re-land here.
    nowMs += 1;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(1);

    // re-armed: the immediate next hop is fresh again.
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invokes the LATEST loader closure after a re-render', () => {
    const first = jest.fn();
    const second = jest.fn();
    mockHost.current.render(() => useFocusRefetch(first));
    mockHost.current.render(() => useFocusRefetch(second));

    fireFocus(); // mount focus (gate law 1 — consumes the cold pass)
    nowMs += DEFAULT_MIN_INTERVAL_MS;
    fireFocus();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(0);
  });

  it('a synchronous loader throw never escapes the focus callback', () => {
    const boom = jest.fn(() => {
      throw new Error('sync loader blew up');
    });
    mockHost.current.render(() => useFocusRefetch(boom));

    fireFocus(); // mount focus
    nowMs += DEFAULT_MIN_INTERVAL_MS;
    expect(() => fireFocus()).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
  });

  it('honours a custom minIntervalMs', () => {
    const loader = jest.fn();
    mockHost.current.render(() =>
      useFocusRefetch(loader, { minIntervalMs: 1000 })
    );
    fireFocus(); // mount
    expect(loader).toHaveBeenCalledTimes(0);
    nowMs += 999;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(0);
    nowMs += 1;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('useFocusRefetch — server-switch invalidation channel (M-MOBILE-18)', () => {
  it('a generation move refetches the mounted screen IMMEDIATELY and re-arms the window', () => {
    const loader = jest.fn();
    mockHost.current.render(() => useFocusRefetch(loader));
    fireFocus(); // mount focus — gate mounted, zero fetches (law 1)
    expect(loader).toHaveBeenCalledTimes(0);

    // THE CURE: hub switch mid-residency. No navigation happens; the screen
    // must still drop the old server's rows and re-pull.
    useHubStore.setState({ serverGeneration: 1 });
    expect(loader).toHaveBeenCalledTimes(1);

    // The invalidation re-armed the stamp: a focus inside the window is the
    // SAME fresh data the switch just pulled — no double-fetch.
    nowMs += DEFAULT_MIN_INTERVAL_MS - 1;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(1);

    // Past the window the ordinary liveness law resumes.
    nowMs += 1;
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('unrelated hub writes stay inert on the invalidation channel', () => {
    const loader = jest.fn();
    mockHost.current.render(() => useFocusRefetch(loader));
    fireFocus(); // mount

    // Loading flags / errors / hubUrl churn move CONSTANT generations — the
    // subscription must sleep through all of them.
    useHubStore.setState({ isLoading: true, error: 'transient', hubUrl: 'https://hub.example.com' });
    expect(loader).toHaveBeenCalledTimes(0);
  });

  it('invalidation BEFORE the mount-focus stays silent — load-on-mount owns the first fetch', () => {
    const loader = jest.fn();
    mockHost.current.render(() => useFocusRefetch(loader));
    // Screen mounted but navigation never announced focus (gate not mounted):
    // the screen's own load-on-mount effect has not run yet — it WILL fetch
    // the new server's truth; a second immediate load would be a stampede.
    useHubStore.setState({ serverGeneration: 1 });
    expect(loader).toHaveBeenCalledTimes(0);

    // The mount-focus passes as always (law 1 survives the invalidation).
    fireFocus();
    expect(loader).toHaveBeenCalledTimes(0);

    // After mount, switches fire again.
    useHubStore.setState({ serverGeneration: 2 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('unmount unsubscribes — a dead screen never refetches (law 8)', () => {
    const loader = jest.fn();
    mockHost.current.render(() => useFocusRefetch(loader));
    fireFocus(); // mount

    mockHost.current.unmountAll();
    useHubStore.setState({ serverGeneration: 1 });
    expect(loader).toHaveBeenCalledTimes(0);
  });

  it('invokes the LATEST loader closure across the invalidation path too', () => {
    const first = jest.fn();
    const second = jest.fn();
    mockHost.current.render(() => useFocusRefetch(first));
    mockHost.current.render(() => useFocusRefetch(second)); // re-render, effect NOT re-run
    fireFocus(); // mount

    useHubStore.setState({ serverGeneration: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(0);
  });

  it('a synchronous loader throw on the invalidation path never raises into the zustand notify loop', () => {
    const boom = jest.fn(() => {
      throw new Error('loader blew up mid-switch');
    });
    mockHost.current.render(() => useFocusRefetch(boom));
    fireFocus(); // mount

    // A store write that throws into its listener would poison the SWITCHER
    // itself (setActiveServer died mid-notify) — the quiet path must swallow.
    expect(() => useHubStore.setState({ serverGeneration: 1 })).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
  });
});
