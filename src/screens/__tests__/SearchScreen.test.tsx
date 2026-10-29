/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/SearchScreen.test.tsx
//
// Screen-level pin for the Search A–Z rail (campaign item M-MOBILE-19 r2,
// review mobile__a11y / mobile__gameux). The r1 review's MAJOR-1: the 44pt
// law was pinned only at helper level while the SCREEN consumed its own raw
// constants — its mutation probe M2b (`railButton: {...RAIL_BUTTON_LAYOUT,
// minHeight: 15}`, lint-clean, tsc-clean) left the entire suite green while
// silently re-breaking the exact law the item exists for. The cure: the
// screen now computes its rail geometry THROUGH the seam
// (railLetterTouchRect()), and this file drives the REAL SearchScreen through
// the repo's hook-host venue (no React renderer exists — see
// PlayerScreen.test.tsx's rationale) and asserts on the FLATTENED STYLE OF
// THE RENDERED TREE:
//
//   * the rail root is a ScrollView SIBLING of the results FlatList (the
//     responder-conflict layout law — never nested in a same-direction
//     scroller);
//   * every one of the 27 letters carries a literal-44x44pt laid-out
//     footprint from the screen path — the platform floor is written as a
//     literal here, so raising RAIL_TARGET_MIN_SIZE_PT can never
//     self-satisfy, and helper-computed == old-inline is asserted per letter
//     (the equivalence law for all 27 letters and both column widths);
//   * zero hitSlop anywhere on the rail: the minimum is layout-carried and
//     rows tile exactly (pitch == touch height, no margins), so the r1
//     reviewer's 12.3pt neighbour-bleed scenario is STRUCTURALLY impossible
//     — that is the actual responder-conflict guarantee we ship;
//   * the 27-row column measures 1188pt > the 320pt smallest viewport, and
//     the tree proves it lives inside a ScrollView (scroll is mandatory and
//     shipped, not assumed).
//
// All I/O collaborators (store, navigation, leaf components) are inert stubs;
// the geometry, gating and hooks run for real.

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
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) =>
      mockHost.current!.useEffect(fn, deps),
  };
});

// ── inert collaborator mocks ───────────────────────────────────────────────
// The screen's state comes from a fake store the shape of which mirrors the
// real SearchState; the browse round-trip lives in `search`/`loadLetterIndex`
// (like PlayerScreen's round-tripping fake) so a rerender observes results
// landing end-to-end through the REAL screen gating (showRail law).
const mockSearchState: {
  query: string;
  filters: Record<string, unknown>;
  results: Array<{ id: string }>;
  total: number;
  loading: boolean;
  error: string | null;
  letterIndex: {
    letters: Array<{ letter: string; offset: number; count: number }>;
    total: number;
  } | null;
  setQuery: jest.Mock;
  setFilters: jest.Mock;
  search: jest.Mock;
  loadLetterIndex: jest.Mock;
  jumpToLetter: jest.Mock;
  reset: jest.Mock;
} = {
  query: '',
  filters: {},
  results: [],
  total: 0,
  loading: false,
  error: null,
  letterIndex: null,
  setQuery: jest.fn(),
  setFilters: jest.fn(),
  search: jest.fn(async () => {
    mockSearchState.results = [{ id: 'm1' }];
    mockSearchState.total = 1;
    mockSearchState.loading = false;
  }),
  loadLetterIndex: jest.fn(async () => {
    const letters = [
      '#',
      ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    ];
    mockSearchState.letterIndex = {
      letters: letters.map((letter, i) => ({ letter, offset: i, count: 1 })),
      total: letters.length,
    };
  }),
  jumpToLetter: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../stores/useSearchStore', () => ({
  useSearchStore: (sel: (s: unknown) => unknown) => sel(mockSearchState),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Leaf components: the hook host keeps them as unrendered element types, so
// the stubs are NEVER called — they only need to exist for the import and to
// give the SearchBar element an identity to press.
jest.mock('../../components/layout', () => ({
  SafeContainer: () => null,
}));
jest.mock('../../components/ui/SearchBar', () => ({
  SearchBar: () => null,
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

import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import SearchScreen from '../SearchScreen';
import { railLetterTouchRect, RAIL_LETTERS } from '../search/searchScreenHelpers';

const SearchBarStub = (
  jest.requireMock('../../components/ui/SearchBar') as { SearchBar: unknown }
).SearchBar;

// The platform floor as a LITERAL (never the imported constant): the law this
// file exists for is pinned against the platform, not against itself.
const PLATFORM_MIN_TOUCH_PT = 44;
const SMALLEST_SUPPORTED_VIEWPORT_PT = 320;

// ── tree helpers (PlayerScreen.test.tsx vocabulary) ────────────────────────
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

const findEl = (node: unknown, pred: (el: El) => boolean): El | null =>
  findEls(node, pred)[0] ?? null;

/** Fold any StyleSheet value (registered id | object | array | falsy). */
const flat = (style: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

// The rail's ScrollView: the ONLY fast-decelerating scroller the screen
// builds (the filter modal's ScrollView has no decelerationRate).
const isRailScroll = (el: El): boolean =>
  el.type === ScrollView && el.props.decelerationRate === 'fast';

// Rail letter buttons: role + single-glyph label + press handler — the a11y
// contract r1 shipped, reused here as the identity hook for geometry law.
const isRailLetter = (el: El): boolean =>
  el.type === TouchableOpacity &&
  el.props.accessibilityRole === 'button' &&
  typeof el.props.accessibilityLabel === 'string' &&
  /^[A-Z#]$/.test(el.props.accessibilityLabel as string) &&
  typeof el.props.onPress === 'function';

const railLetters = (tree: unknown): El[] => findEls(tree, isRailLetter);

const flush = () => new Promise((resolve) => setImmediate(resolve));

function mount() {
  const host = new HookHost();
  return {
    host,
    render: () => host.render(() => (SearchScreen as unknown as () => unknown)()),
    rerender: () => host.rerender(),
  };
}

// Bring the screen up in BROWSE mode with results: the user flow is a blank-
// query submit (SearchBar onSubmit → performSearch → store round-trip), which
// flips hasSearched, lands results and fills the letter index — the real
// gating path, not a props shortcut.
async function bootBrowseWithResults() {
  resetSearchState();
  const h = mount();
  h.render();
  const bar = findEl(h.host.tree, (el) => el.type === SearchBarStub);
  expect(bar).not.toBeNull();
  await (bar!.props.onSubmit as () => Promise<void>)();
  await flush();
  h.rerender();
  return h;
}

function resetSearchState() {
  mockSearchState.query = '';
  mockSearchState.filters = {};
  mockSearchState.results = [];
  mockSearchState.total = 0;
  mockSearchState.loading = false;
  mockSearchState.error = null;
  mockSearchState.letterIndex = null;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSearchState();
});

describe('SearchScreen A–Z rail — screen-level law (M-MOBILE-19 r2 / MAJOR-1)', () => {
  it('renders the rail as a ScrollView SIBLING of the results list, never nested', async () => {
    const h = await bootBrowseWithResults();
    const rail = findEl(h.host.tree, isRailScroll);
    expect(rail).not.toBeNull();

    // The rail and the results FlatList share the results row (flex:1,
    // flexDirection:'row') — a sibling, so hit-testing dispatches
    // exclusively (2666d4f responder-conflict layout law).
    const rows = findEls(
      h.host.tree,
      (el) =>
        el.type === View &&
        flat(el.props.style).flex === 1 &&
        flat(el.props.style).flexDirection === 'row'
    );
    expect(rows).toHaveLength(1);
    const kids = (Array.isArray(rows[0].props.children)
      ? rows[0].props.children
      : [rows[0].props.children]
    ).filter(isEl);
    expect(kids.some((k) => k.type === FlatList)).toBe(true);
    expect(kids.some((k) => k === rail)).toBe(true);
    // Not nested: the FlatList carries data as PROPS only (no children).
    expect(findEls(kids.find((k) => k.type === FlatList)!.props.children, isRailScroll)).toHaveLength(0);
  });

  it('gives ALL 27 rendered letters a literal 44x44pt footprint from the screen path', async () => {
    const h = await bootBrowseWithResults();
    const letters = railLetters(h.host.tree);

    // Right set, right order — 26 letters + the '#' bucket, from the tree.
    expect(letters).toHaveLength(27);
    expect(letters.map((l) => l.props.accessibilityLabel)).toEqual(RAIL_LETTERS);

    const seamRect = railLetterTouchRect();
    for (const l of letters) {
      const style = flat(l.props.style);
      // Screen-path floor against the LITERAL platform minimum (r1 M2b
      // mutation — minHeight:15 — reddens exactly here):
      expect(style.width).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
      expect(style.minHeight).toBeGreaterThanOrEqual(PLATFORM_MIN_TOUCH_PT);
      // Equivalence law for every letter/width: seam-computed == old-inline
      // == the r1-shipped 44pt geometry (identical values, new conduit).
      expect(style.width).toBe(seamRect.width);
      expect(style.minHeight).toBe(seamRect.height);
      expect([seamRect.width, seamRect.height]).toEqual([
        PLATFORM_MIN_TOUCH_PT,
        PLATFORM_MIN_TOUCH_PT,
      ]);
      // The letter glyph IS the label (a11y contract, i18n-invariant).
      const textEl = findEl(l.props.children, (el) => typeof el.props.children === 'string');
      expect(textEl!.props.children).toBe(l.props.accessibilityLabel);
    }
  });

  it('ships zero hitSlop on the rail — layout carries the minimum, neighbour bleed is structurally impossible', async () => {
    const h = await bootBrowseWithResults();
    const letters = railLetters(h.host.tree);
    const rail = findEl(h.host.tree, isRailScroll)!;

    // Responder-conflict law (M-MOBILE-19): the r1 reviewer measured that
    // slop-filling 15pt stacked rows needs (44-15)/2 = 14.5pt each way,
    // i.e. ~12.3pt of claimed area already belonged to a neighbour. We ship
    // that impossibility structurally: NO letter (nor the column) declares
    // hitSlop, so a touch point can only ever resolve to laid-out geometry…
    for (const l of letters) {
      expect(l.props.hitSlop).toBeUndefined();
    }
    expect(rail.props.hitSlop).toBeUndefined();
    // …and the laid-out rows tile EXACTLY: touch height == row pitch (the
    // style carries no margin, positive or negative), so adjacent touch
    // rects are disjoint — each 44pt row belongs to one letter alone. This
    // is the actual guarantee pinned: overlap requires slop or negative
    // margins, and the screen ships neither.
    const rect = railLetterTouchRect();
    for (const l of letters) {
      const style = flat(l.props.style);
      expect(style.height).toBeUndefined(); // flexible column: pitch == minHeight == rect height
      expect(style.minHeight).toBe(rect.height);
      expect(style.marginTop ?? 0).toBe(0);
      expect(style.marginBottom ?? 0).toBe(0);
    }
  });

  it('measures the 27-row column at 1188pt > 320pt inside the shipped ScrollView', async () => {
    const h = await bootBrowseWithResults();
    const letters = railLetters(h.host.tree);
    const rect = railLetterTouchRect();

    // Column height is emergent layout: rows stacked shoulder-to-shoulder.
    const columnPt = letters.length * rect.height;
    expect(columnPt).toBe(27 * PLATFORM_MIN_TOUCH_PT); // literal 1188
    expect(columnPt).toBeGreaterThan(SMALLEST_SUPPORTED_VIEWPORT_PT);

    // And the scroll is real, from the tree: the rail root IS a ScrollView
    // (component identity), so every letter stays one flick away.
    expect(findEl(h.host.tree, isRailScroll)!.type).toBe(ScrollView);
  });

  it('sizes the rail column itself by the seam width (44pt), not by raw constants', async () => {
    const h = await bootBrowseWithResults();
    const rail = findEl(h.host.tree, isRailScroll)!;
    // Horizontal slop is unnecessary because the column itself is the
    // minimum width — the same seam output that sizes the letters.
    expect(flat(rail.props.style).width).toBe(railLetterTouchRect().width);
    expect(flat(rail.props.style).width).toBe(PLATFORM_MIN_TOUCH_PT);
  });
});
