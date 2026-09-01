/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/__tests__/SubtitleTrackList.test.tsx
//
// S407 wire-shape component test (S406 lesson: UI without wire-shape tests is
// how phantom rails lived). `SubtitleTrackList` is a hook-less FC, so — exactly
// like QualityMenu.test.tsx — we invoke it directly and walk the returned
// element tree; the repo deliberately ships NO React renderer.
//
// The rows it renders prove it reads the playback-info WIRE vocabulary
// (`label`, `hearing_impaired`) and NOT the retired DB-mirror fiction
// (`title`, `isForced`, `isDefault`) — the exact hazard S404 flagged and S407
// rewired. Feed it the contracts golden vectors: if any code path reaches for
// `title`, the row renders empty and these assertions go RED.

import type { SubtitleTrack } from '../../../types/playback';
import { SubtitleTrackList } from '../SubtitleTrackList';

// ── renderer-free tree walk (same shape as QualityMenu.test.tsx) ───────────
type El = { type: unknown; props: Record<string, unknown> };
const isEl = (n: unknown): n is El => !!n && typeof n === 'object' && 'props' in (n as object);

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

// Golden rows — contracts test/fixtures/stream-track-vectors.json @ 068d5e86
// (provenance server 01340633), subtitle case
// `embedded-text-codecs-bitmap-skipped-but-counted`. `label` is the DISPLAY
// string; there is NO `title` key on the wire.
const TRACKS: SubtitleTrack[] = [
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

const baseProps = (overrides: Partial<{ tracks: SubtitleTrack[]; selected: string | null }> = {}) => ({
  visible: true,
  tracks: TRACKS,
  selected: null as string | null,
  onSelect: jest.fn(),
  onClose: jest.fn(),
  ...overrides,
});

const render = (props: Parameters<typeof SubtitleTrackList>[0]): unknown =>
  (SubtitleTrackList as unknown as (p: unknown) => unknown)(props);

const allStrings = (tree: unknown): string[] =>
  findAll(tree, (el) => typeof el.props.children === 'string').map(
    (el) => String(el.props.children),
  );

describe('SubtitleTrackList — S407 wire vocabulary (label, not title)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders one selectable row per wire track, labelled by `label`', () => {
    const props = baseProps();
    const tree = render(props);
    // Rows expose the track label in their accessibilityLabel — the DB-mirror
    // `title`/`isForced`/`isDefault` fiction is GONE from the emitted strings.
    const labels = findAll(tree, (el) => typeof el.props.accessibilityLabel === 'string')
      .map((el) => String(el.props.accessibilityLabel))
      .filter((l) => l !== 'Subtitles off' && l !== 'Close subtitles menu');
    expect(labels).toEqual([
      'eng hearing impaired',
      'Español (Forzada)',
    ]);
    // The visible row Text renders the WIRE `label` (this is the exact line a
    // `title` regression empties out — the wire never carries `title`).
    const strings = allStrings(tree);
    expect(strings).toContain('eng');
    expect(strings).toContain('Español (Forzada)');
  });

  it('does NOT render FORCED/DEFAULT badges (no forced/default concept on the wire)', () => {
    const tree = render(baseProps());
    const badgeTexts = findAll(tree, (el) => typeof el.props.children === 'string')
      .map((el) => String(el.props.children));
    expect(badgeTexts).not.toContain('FORCED');
    expect(badgeTexts).not.toContain('DEFAULT');
    // The only flag the subtitle wire carries is hearing_impaired → an "HI" badge.
    expect(badgeTexts).toContain('HI');
  });

  it('shows the empty-state message when no tracks', () => {
    const tree = render(baseProps({ tracks: [] }));
    const texts = findAll(tree, (el) => el.props.children === 'No subtitle tracks available');
    expect(texts).toHaveLength(1);
  });

  it('Off row selects null; a track row selects its wire id and closes', () => {
    const props = baseProps();
    const tree = render(props);
    // Off row → onSelect(null) + onClose.
    const offRow = findAll(tree, (el) => el.props.accessibilityLabel === 'Subtitles off')[0];
    (offRow.props.onPress as () => void)();
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    // First track row → onSelect('ss-1').
    const props2 = baseProps();
    const tree2 = render(props2);
    const trackRow = findAll(
      tree2,
      (el) => el.props.accessibilityLabel === 'eng hearing impaired',
    )[0];
    (trackRow.props.onPress as () => void)();
    expect(props2.onSelect).toHaveBeenLastCalledWith('ss-1');
  });

  it('marks exactly the selected row via accessibilityState.selected', () => {
    const tree = render(baseProps({ selected: 'ss-2' }));
    const rowStates = findAll(tree, (el) => 'accessibilityState' in el.props).map(
      (el) => (el.props.accessibilityState as { selected?: boolean }).selected,
    );
    // Off + 2 track rows: only ss-2 selected.
    expect(rowStates).toEqual([false, false, true]);
  });
});
