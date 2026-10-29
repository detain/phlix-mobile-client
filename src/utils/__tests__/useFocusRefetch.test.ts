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
// Red→green laws pinned:
//   1. a mount focus fires ZERO refetches (load-on-mount owns cold data);
//   2. a re-focus after the staleness window fires EXACTLY ONE refetch — the
//      cure itself (TV changed the rails → the phone re-pulls on tab switch);
//   3. a re-focus inside the window fires ZERO (existing data freshness);
//   4. the LATEST loader closure is the one invoked across re-renders;
//   5. a synchronous loader throw never escapes the focus callback.

import { useFocusRefetch } from '../useFocusRefetch';
import { DEFAULT_MIN_INTERVAL_MS } from '../focusRefetchGate';

// ── collected focus effects (mock-prefixed name: jest hoisting rule) ───────
const mockFocusCallbacks: Array<() => unknown> = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => unknown) => {
    mockFocusCallbacks.push(cb);
  },
}));

// ── slot-backed hook host (useRef + useCallback only) ──────────────────────
class SlotHost {
  private slots: Array<Record<string, unknown>> = [];
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
  mockFocusCallbacks.length = 0;
  mockHost.current = new SlotHost();
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
