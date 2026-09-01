/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/__tests__/AudioTrackList.test.tsx
//
// S407 wire-shape component test for the audio picker — the same renderer-free
// direct-FC pattern as QualityMenu.test.tsx / SubtitleTrackList.test.tsx.
// Pins that rows render from the playback-info WIRE shape (`title ??
// language`, `channels`, ALWAYS-present-nullable `bitrate`, `codec`) and that
// the S407 named-refusal `note` reaches the sheet. Selection persistence and
// the native-surface absence are asserted in PlayerScreen.test.tsx +
// NativeAudioSelectionBoundary.test.ts.

import type { AudioTrack } from '../../../types/playback';
import { AudioTrackList } from '../AudioTrackList';

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
// (provenance server 01340633), audio case
// `stored-default-on-second-nullables-passthrough`: a titleless 5.1 row with a
// real bitrate and a titled stereo default.
const TRACKS: AudioTrack[] = [
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

const baseProps = () => ({
  visible: true,
  tracks: TRACKS,
  selected: null as string | null,
  onSelect: jest.fn(),
  note: undefined as string | undefined,
  onClose: jest.fn(),
});

const render = (props: Parameters<typeof AudioTrackList>[0]): unknown =>
  (AudioTrackList as unknown as (p: unknown) => unknown)(props);

const allStrings = (tree: unknown): string[] =>
  findAll(tree, (el) => typeof el.props.children === 'string').map(
    (el) => String(el.props.children),
  );

describe('AudioTrackList — S407 wire vocabulary + named-refusal note', () => {
  beforeEach(() => jest.clearAllMocks());

  it('labels rows `title ?? language` and carries codec/channels/bitrate meta', () => {
    const tree = render(baseProps());
    const labels = findAll(tree, (el) => 'accessibilityState' in el.props).map(
      (el) => String(el.props.accessibilityLabel),
    );
    // as-1 has title null → falls back to language; as-2 shows its title.
    expect(labels).toEqual([
      'en 6 ch 640 kbps',
      'Commentary Stereo 128 kbps',
    ]);
    const strings = allStrings(tree);
    expect(strings).toContain('eac3 • 6 ch • 640 kbps');
    expect(strings).toContain('aac • Stereo • 128 kbps');
  });

  it('renders the S407 named-refusal note when the caller passes one', () => {
    const props = { ...baseProps(), note: 'NO_NATIVE_AUDIO_TRACK_SWITCHING_S407_NOTE' };
    const tree = render(props);
    expect(allStrings(tree)).toContain('NO_NATIVE_AUDIO_TRACK_SWITCHING_S407_NOTE');
    // And it is absent when not passed (subtitle-style sheets stay clean).
    expect(allStrings(render(baseProps()))).not.toContain(
      'NO_NATIVE_AUDIO_TRACK_SWITCHING_S407_NOTE',
    );
  });

  it('pressing a row selects its wire id and closes', () => {
    const props = baseProps();
    const tree = render(props);
    const rows = findAll(
      tree,
      (el) => 'accessibilityState' in el.props,
    );
    expect(rows).toHaveLength(2);
    (rows[1].props.onPress as () => void)();
    expect(props.onSelect).toHaveBeenCalledWith('as-2');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('null bitrate rows omit the bitrate segment (ALWAYS-present-nullable wire)', () => {
    const props = {
      ...baseProps(),
      tracks: [{ ...TRACKS[0], bitrate: null }],
    };
    const tree = render(props);
    expect(allStrings(tree)).toContain('eac3 • 6 ch');
  });
});
