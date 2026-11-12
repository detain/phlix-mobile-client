/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/LibraryScreen.loadMore.test.tsx
//
// MOB-7 (fix-plan MOB-S6): LibraryScreen's load-more pager.
//
//   * FlatList fires onEndReached more than once per gesture, and the old
//     guard read React STATE (isLoadingItems) that only flips on the next
//     render — two same-tick events both fetched the SAME offset. The guard
//     is now a ref latched BEFORE the await and cleared in finally: a burst
//     of onEndReached calls from one render issues exactly one request.
//   * A failed page used to vanish into console.error (the grid just stopped
//     growing). It now renders an inline Retry that re-requests the SAME
//     page; the auto-pager stays quiet while the error stands.
//   * A page that resolves after a reset (refresh / library switch) is
//     dropped, never appended to the new grid.
//
// Driven through the repo's hook-host venue (no React renderer in test deps —
// see PlayerScreen.test.tsx's rationale): the REAL screen's hooks, guards and
// footer/empty branches run; only I/O collaborators are stubbed.

// ── controlled hook host (ported from SearchScreen.test.tsx) ──────────────
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

  useCallback<F>(fn: F, deps?: unknown[]): F {
    const i = this.cursor++;
    const prev = this.slots[i] as { fn: F; deps?: unknown[] } | undefined;
    const same =
      !!prev &&
      !!deps &&
      !!prev.deps &&
      deps.length === prev.deps.length &&
      deps.every((d, j) => Object.is(d, (prev.deps as unknown[])[j]));
    if (same) return prev!.fn;
    this.slots[i] = { fn, deps };
    return fn;
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

// `mock`-prefixed so the jest.mock factory below may reference it (jest rule).
const mockHost: { current: HookHost | null } = { current: null };

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (init: unknown) => mockHost.current!.useState(init as never),
    useRef: (init: unknown) => mockHost.current!.useRef(init),
    useCallback: (fn: unknown, deps?: unknown[]) =>
      mockHost.current!.useCallback(fn, deps),
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) =>
      mockHost.current!.useEffect(fn, deps),
  };
});

// ── collaborator mocks ─────────────────────────────────────────────────────
const mockGetLibraries = jest.fn();
const mockGetLibraryItems = jest.fn();
jest.mock('../../api/LibraryManager', () => ({
  libraryManager: {
    getLibraries: (...a: unknown[]) => mockGetLibraries(...a),
    getLibraryItems: (...a: unknown[]) => mockGetLibraryItems(...a),
  },
}));
// The REST error door: fallback copy only (its catalog is pinned in
// src/api/__tests__/client.test.ts).
jest.mock('../../api/client', () => ({
  apiErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const mockNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('../../utils/useFocusRefetch', () => ({
  useFocusRefetch: () => undefined,
}));
jest.mock('../../components/layout', () => ({
  SafeContainer: () => null,
}));
jest.mock('../../components/media/MediaCard', () => ({
  MediaCard: () => null,
}));
jest.mock('../../components/ui/EmptyState', () => ({
  EmptyState: () => null,
}));
jest.mock('../../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => null,
}));
jest.mock('../../components/ui/ErrorView', () => ({
  ErrorView: () => null,
}));

import { FlatList, TouchableOpacity } from 'react-native';
import LibraryScreen from '../LibraryScreen';

const ErrorViewStub = (
  jest.requireMock('../../components/ui/ErrorView') as { ErrorView: unknown }
).ErrorView;
const EmptyStateStub = (
  jest.requireMock('../../components/ui/EmptyState') as { EmptyState: unknown }
).EmptyState;
const LoadingSpinnerStub = (
  jest.requireMock('../../components/ui/LoadingSpinner') as {
    LoadingSpinner: unknown;
  }
).LoadingSpinner;

// ── tree helpers ───────────────────────────────────────────────────────────
type El = { type: unknown; props: Record<string, unknown> };

const isEl = (n: unknown): n is El =>
  !!n && typeof n === 'object' && 'props' in (n as object);

function findEls(node: unknown, pred: (el: El) => boolean, acc: El[] = []): El[] {
  if (Array.isArray(node)) {
    for (const c of node) findEls(c, pred, acc);
    return acc;
  }
  if (isEl(node)) {
    if (pred(node)) acc.push(node);
    findEls(node.props.children, pred, acc);
  }
  return acc;
}

const LIMIT = 20;
const page = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `m${from + i}`, title: `T${from + i}` }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
};

let host: HookHost;

/** The items grid (the only 2-column FlatList the screen builds). */
const grid = (): El => {
  const g = findEls(host.tree, (el) => el.type === FlatList && el.props.numColumns === 2)[0];
  if (!g) throw new Error('items grid not rendered');
  return g;
};
const itemCount = () => (grid().props.data as unknown[]).length;
const footer = () => grid().props.ListFooterComponent as unknown;
const retryButton = (): El | null =>
  findEls(
    footer(),
    (el) =>
      el.type === TouchableOpacity &&
      el.props.accessibilityLabel === 'Retry loading library items'
  )[0] ?? null;
const endReached = () => (grid().props.onEndReached as () => void)();

/** Mount and land page 1 (a FULL page, so hasMore stays true). */
async function mountWithFirstPage(firstPage = page(0, LIMIT)) {
  mockGetLibraries.mockResolvedValue([{ id: 'L1', name: 'Movies', type: 'movie' }]);
  mockGetLibraryItems.mockResolvedValueOnce({ items: firstPage });
  host = new HookHost();
  host.render(() => (LibraryScreen as unknown as () => unknown)());
  await flush();
  host.rerender(); // selectedLibrary landed → page-1 effect fires
  await flush();
  host.rerender();
}

beforeEach(() => {
  mockGetLibraries.mockReset();
  mockGetLibraryItems.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('MOB-7 — load-more in-flight ref guard', () => {
  it('a burst of onEndReached from ONE render issues exactly one page request', async () => {
    await mountWithFirstPage();
    expect(mockGetLibraryItems).toHaveBeenCalledTimes(1);
    expect(itemCount()).toBe(LIMIT);

    const p2 = deferred<{ items: unknown[] }>();
    mockGetLibraryItems.mockReturnValueOnce(p2.promise);

    // Same render, same closures: the old state-only guard let all three pass.
    const fire = grid().props.onEndReached as () => void;
    fire();
    fire();
    fire();

    expect(mockGetLibraryItems).toHaveBeenCalledTimes(2);
    expect(mockGetLibraryItems).toHaveBeenLastCalledWith('L1', {
      limit: LIMIT,
      offset: LIMIT,
    });

    p2.resolve({ items: page(LIMIT, LIMIT) });
    await flush();
    host.rerender();
    expect(itemCount()).toBe(2 * LIMIT);
    const ids = (grid().props.data as Array<{ id: string }>).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicated page

    // The latch cleared in finally: the next page is reachable.
    mockGetLibraryItems.mockResolvedValueOnce({ items: page(2 * LIMIT, 3) });
    endReached();
    expect(mockGetLibraryItems).toHaveBeenLastCalledWith('L1', {
      limit: LIMIT,
      offset: 2 * LIMIT,
    });
    await flush();
    host.rerender();
    expect(itemCount()).toBe(2 * LIMIT + 3);
  });

  it('the footer shows a spinner while a page is in flight', async () => {
    await mountWithFirstPage();
    const p2 = deferred<{ items: unknown[] }>();
    mockGetLibraryItems.mockReturnValueOnce(p2.promise);
    endReached();
    host.rerender();
    expect((footer() as El).type).toBe(LoadingSpinnerStub);
    p2.resolve({ items: page(LIMIT, 1) });
    await flush();
    host.rerender();
    expect(footer()).toBeNull();
  });
});

describe('MOB-7 — visible retry on page failure', () => {
  it('a failed page renders an inline Retry that re-requests the SAME page', async () => {
    await mountWithFirstPage();
    mockGetLibraryItems.mockRejectedValueOnce(new Error('socket hang up'));
    endReached();
    await flush();
    host.rerender();

    // Visible, named, at the 44pt floor — not a silent console.error.
    const retry = retryButton();
    expect(retry).not.toBeNull();
    expect(retry!.props.accessibilityRole).toBe('button');
    expect(
      findEls(footer(), (el) => el.props.children === 'Could not load more items')
    ).toHaveLength(1);
    expect(itemCount()).toBe(LIMIT);

    // The auto-pager stays quiet while the error stands (no retry storm).
    const callsAfterFailure = mockGetLibraryItems.mock.calls.length;
    endReached();
    endReached();
    expect(mockGetLibraryItems).toHaveBeenCalledTimes(callsAfterFailure);

    // Retry re-requests the page that failed (offset never advanced).
    mockGetLibraryItems.mockResolvedValueOnce({ items: page(LIMIT, 5) });
    (retry!.props.onPress as () => void)();
    expect(mockGetLibraryItems).toHaveBeenLastCalledWith('L1', {
      limit: LIMIT,
      offset: LIMIT,
    });
    await flush();
    host.rerender();
    expect(itemCount()).toBe(LIMIT + 5);
    expect(retryButton()).toBeNull();
    expect(footer()).toBeNull();
  });

  it('a failed FIRST page shows an error with Retry, never "This library is empty"', async () => {
    mockGetLibraries.mockResolvedValue([{ id: 'L1', name: 'Movies', type: 'movie' }]);
    mockGetLibraryItems.mockRejectedValueOnce(new Error('503'));
    host = new HookHost();
    host.render(() => (LibraryScreen as unknown as () => unknown)());
    await flush();
    host.rerender();
    await flush();
    host.rerender();

    const empty = grid().props.ListEmptyComponent as El;
    expect(empty.type).toBe(ErrorViewStub);
    expect(empty.type).not.toBe(EmptyStateStub);
    expect(empty.props.message).toBe('Could not load this library');

    mockGetLibraryItems.mockResolvedValueOnce({ items: page(0, 4) });
    (empty.props.onRetry as () => void)();
    expect(mockGetLibraryItems).toHaveBeenLastCalledWith('L1', { limit: LIMIT, offset: 0 });
    await flush();
    host.rerender();
    expect(itemCount()).toBe(4);
    expect((grid().props.ListEmptyComponent as El).type).toBe(EmptyStateStub);
  });
});

describe('MOB-7 — a reset supersedes an in-flight page', () => {
  it('a page resolving after pull-to-refresh is dropped, never appended', async () => {
    await mountWithFirstPage();
    const stale = deferred<{ items: unknown[] }>();
    mockGetLibraryItems.mockReturnValueOnce(stale.promise);
    endReached();

    mockGetLibraryItems.mockResolvedValueOnce({ items: page(100, LIMIT) });
    const refreshControl = grid().props.refreshControl as El;
    await (refreshControl.props.onRefresh as () => Promise<void>)();
    await flush();
    host.rerender();
    expect(itemCount()).toBe(LIMIT);

    stale.resolve({ items: page(LIMIT, LIMIT) });
    await flush();
    host.rerender();
    const ids = (grid().props.data as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual(page(100, LIMIT).map((i) => i.id));

    // The stale request still released the latch.
    mockGetLibraryItems.mockResolvedValueOnce({ items: [] });
    endReached();
    expect(mockGetLibraryItems).toHaveBeenLastCalledWith('L1', {
      limit: LIMIT,
      offset: LIMIT,
    });
  });
});
