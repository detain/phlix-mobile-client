/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/__tests__/QualityMenu.test.tsx
//
// QualityMenu is a pure, hook-less presentational component (G3): its only logic
// is mapping `options` to rows, marking the selected row, and — the part that
// matters — the row `onPress` that must fire BOTH `onSelect(value)` AND
// `onClose()` (pick a rung → the sheet closes). We test it by invoking the
// component as a function and walking the returned element tree, which exercises
// that logic directly WITHOUT a React renderer (RNTL v14 + React 19 +
// test-renderer@1 is not a stable combo under @react-native/jest-preset — the
// rest of the suite is renderer-free too; see SkipButton.test.tsx).
//
// NOTE: PlayerScreen.test.tsx only reads QualityMenu's PROPS and calls `onSelect`
// directly, so it never touches this component's own `onPress` wiring. Dropping
// the `onClose()` from the row handler (menu stays open after a pick) would pass
// every other test in the repo — this file is the guard for that.
import { AUTO_QUALITY } from '@phlix/contracts';
import { QualityMenu } from '../QualityMenu';
import type { QualityOption } from '../quality';

type El = { type: unknown; props: Record<string, unknown> };

const isEl = (n: unknown): n is El =>
  !!n && typeof n === 'object' && 'props' in (n as object);

// Collect every element in the tree matching a predicate (depth-first).
function findAll(node: unknown, pred: (el: El) => boolean): El[] {
  const out: El[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (isEl(n)) {
      if (pred(n)) out.push(n);
      walk(n.props.children);
    }
  };
  walk(node);
  return out;
}

const findOne = (node: unknown, pred: (el: El) => boolean): El | undefined =>
  findAll(node, pred)[0];

// Invoke the hook-less FC directly → its element tree.
const render = (props: Parameters<typeof QualityMenu>[0]): unknown =>
  (QualityMenu as unknown as (p: unknown) => unknown)(props);

// Option rows carry an accessibilityState (the close button does not).
const optionRows = (tree: unknown): El[] =>
  findAll(tree, (el) => 'accessibilityState' in el.props);

const OPTIONS: QualityOption[] = [
  { value: AUTO_QUALITY, label: 'Auto', url: 'https://cdn/master.m3u8' },
  { value: '720p', label: '720p', url: 'https://cdn/media_v720.m3u8' },
  { value: '480p', label: '480p', url: 'https://cdn/media_v480.m3u8' },
];

const baseProps = () => ({
  visible: true,
  options: OPTIONS,
  selected: '720p' as const,
  onSelect: jest.fn(),
  onClose: jest.fn(),
});

describe('QualityMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes `visible` through to the underlying Modal', () => {
    const tree = render({ ...baseProps(), visible: false });
    const modal = findOne(tree, (el) => 'animationType' in el.props && 'transparent' in el.props);
    expect(modal).toBeDefined();
    expect(modal!.props.visible).toBe(false);
  });

  it('renders exactly one row per option (no self-hide — gating is the caller’s job)', () => {
    // The component intentionally renders whatever it is given; PlayerScreen
    // enforces the >1-option convention. A single option still renders a row.
    expect(optionRows(render(baseProps())).length).toBe(3);
    expect(optionRows(render({ ...baseProps(), options: [OPTIONS[0]] })).length).toBe(1);
    expect(optionRows(render({ ...baseProps(), options: [] })).length).toBe(0);
  });

  it('marks ONLY the selected row via accessibilityState (the ✓ check)', () => {
    const rows = optionRows(render(baseProps()));
    const selectedStates = rows.map(
      (r) => (r.props.accessibilityState as { selected: boolean }).selected,
    );
    // OPTIONS = [Auto, 720p, 480p], selected = 720p.
    expect(selectedStates).toEqual([false, true, false]);
  });

  it('fires BOTH onSelect(value) AND onClose when a row is pressed', () => {
    const props = baseProps();
    const rows = optionRows(render(props));
    // Press the 480p row (index 2).
    (rows[2].props.onPress as () => void)();
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith('480p');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('picking Auto also selects + closes', () => {
    const props = baseProps();
    const rows = optionRows(render(props));
    (rows[0].props.onPress as () => void)();
    expect(props.onSelect).toHaveBeenCalledWith(AUTO_QUALITY);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('the header close control calls onClose (and does not select)', () => {
    const props = baseProps();
    const tree = render(props);
    const closeBtn = findOne(
      tree,
      (el) => el.props.accessibilityLabel === 'Close quality menu',
    );
    expect(closeBtn).toBeDefined();
    (closeBtn!.props.onPress as () => void)();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
