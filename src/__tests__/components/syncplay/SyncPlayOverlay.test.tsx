/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/components/syncplay/SyncPlayOverlay.test.tsx
//
// MW-101 (review mobile__gameux Major): the SyncPlay liveness rails were
// WRITE-ONLY — the service mirrored connected/connecting into the store and
// emitted join/left/host events, and the overlay showed neither. The pill
// kept smiling a member count through a dead socket, and a party never saw
// who left. These pins drive the component function directly (renderer-free
// per the SeekBar/SkipButton doctrine) against a fake selector store.

import type { ReactElement, ReactNode } from 'react';

// ── selector-store fake: useSyncplayStore(sel) === sel(state) ──────────────
const fakeState: {
  currentGroup: unknown;
  timeSyncStable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
} = {
  currentGroup: null,
  timeSyncStable: true,
  isConnected: true,
  isConnecting: false,
};

jest.mock('../../../store/syncplayStore', () => ({
  useSyncplayStore: (selector: (state: unknown) => unknown) =>
    selector(fakeState),
}));

// Import AFTER the store mock is registered (jest hoists the mock call).
import SyncPlayOverlay from '../../../components/syncplay/SyncPlayOverlay';

type Props = React.ComponentProps<typeof SyncPlayOverlay>;

const render = (props: Partial<Props> = {}): ReactElement | null =>
  SyncPlayOverlay({
    onPress: jest.fn(),
    ...props,
  } as Props) as ReactElement | null;

// ── element-tree readers (no renderer: walk props.children) ────────────────
const collectStrings = (node: ReactNode, into: string[]): string[] => {
  if (node === null || node === undefined || node === false || node === true) {
    return into;
  }
  if (typeof node === 'string' || typeof node === 'number') {
    into.push(String(node));
    return into;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      collectStrings(child, into);
    }
    return into;
  }
  const el = node as ReactElement<{
    children?: ReactNode;
    accessibilityLabel?: string;
    style?: unknown;
  }>;
  if (typeof el.props.accessibilityLabel === 'string') {
    into.push(`[label]${el.props.accessibilityLabel}`);
  }
  collectStrings(el.props.children, into);
  return into;
};

const rendered = (el: ReactElement | null): string[] =>
  el === null ? [] : collectStrings(el, []);

const findLabeled = (node: ReactNode, label: string): ReactElement | null => {
  if (node === null || node === undefined || typeof node !== 'object') {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findLabeled(child, label);
      if (hit !== null) {
        return hit;
      }
    }
    return null;
  }
  const el = node as ReactElement<{
    children?: ReactNode;
    accessibilityLabel?: string;
  }>;
  if (el.props.accessibilityLabel === label) {
    return el;
  }
  return findLabeled(el.props.children, label);
};

const party = (memberCount: number) => ({
  id: 'group-1',
  name: 'Friday party',
  members: Array.from({ length: memberCount }, (_, i) => ({
    id: `user-${i + 1}`,
    name: `User ${i + 1}`,
    isHost: i === 0,
    joinedAt: 0,
  })),
  currentMediaId: 'media-1',
  playbackState: { playing: true, position: 10, pausedAt: null },
  hostId: 'user-1',
  hasPassword: false,
});

const arm = (over: Partial<typeof fakeState> = {}) => {
  fakeState.currentGroup = party(3);
  fakeState.timeSyncStable = true;
  fakeState.isConnected = true;
  fakeState.isConnecting = false;
  Object.assign(fakeState, over);
};

describe('SyncPlayOverlay liveness rail (MW-101)', () => {
  it('renders nothing outside a group (unchanged law)', () => {
    arm({ currentGroup: null });
    expect(render()).toBeNull();
  });

  it('connected + stable shows the member count and a stable dot', () => {
    arm();
    const texts = rendered(render());
    expect(texts).toContain('3 members');
    expect(texts).not.toContain('Disconnected');
    expect(texts).toContain('[label]Sync stable');
    expect(texts).toContain('[label]Open SyncPlay');
  });

  it('singular member count is preserved', () => {
    arm({ currentGroup: party(1) });
    expect(rendered(render())).toContain('1 member');
  });

  it('a dropped socket says DISCONNECTED and the dot goes offline-gray', () => {
    arm({ isConnected: false, isConnecting: false });
    const texts = rendered(render());
    expect(texts).toContain('Disconnected');
    expect(texts).not.toContain('3 members');
    expect(texts).toContain('[label]Sync offline');
    expect(texts).not.toContain('[label]Sync stable');
    const dot = findLabeled(render(), 'Sync offline');
    expect(dot).not.toBeNull();
    const styleList = (dot as ReactElement<{ style?: unknown }>).props.style as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(styleList)).toBe(true);
    expect(styleList.some((entry) => entry?.backgroundColor === '#555')).toBe(true);
  });

  it('a reconnect in flight says RECONNECTING…', () => {
    arm({ isConnected: false, isConnecting: true });
    const texts = rendered(render());
    expect(texts).toContain('Reconnecting…');
    expect(texts).not.toContain('Disconnected');
  });

  it('a membership notice outranks the count AND the rail', () => {
    arm();
    const texts = rendered(render({ notice: 'Bob left' }));
    expect(texts).toContain('Bob left');
    expect(texts).not.toContain('3 members');

    arm({ isConnected: false, isConnecting: false });
    const overRail = rendered(render({ notice: 'Carol joined' }));
    expect(overRail).toContain('Carol joined');
    expect(overRail).not.toContain('Disconnected');
    // The dot keeps telling the truth even while a notice owns the line.
    expect(overRail).toContain('[label]Sync offline');
  });

  it('notice=null restores the rail/count (the pill falls back, not blanks)', () => {
    arm();
    expect(rendered(render({ notice: null })).includes('3 members')).toBe(true);
    arm({ isConnected: false, isConnecting: true });
    expect(rendered(render({ notice: undefined })).includes('Reconnecting…')).toBe(true);
  });
});

// ── Honest fs source-read pins (precedent: keyboardAndSkeleton suite): ─────
// PlayerScreen's subscription wiring is an ORDER/IDENTITY law — named
// handlers, off-by-identity, timer cleanup — that no behavior call can
// reach without a full screen render harness this repo does not ship.
describe('PlayerScreen membership wiring (MW-101, source pins)', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const source = fs
    .readFileSync(path.resolve(__dirname, '../../../screens/PlayerScreen.tsx'), 'utf8')
    .toString();

  for (const event of ['onMemberJoined', 'onMemberLeft', 'onHostChanged']) {
    it(`subscribes ${event} with a named handler and unregisters the SAME identity`, () => {
      expect(source).toContain(`syncPlayService.on('${event}', handle`);
      expect(source).toContain(`syncPlayService.off('${event}', handle`);
    });
  }

  it('the notice prop is threaded to the overlay', () => {
    expect(source).toContain('notice={membershipNotice}');
  });

  it('unmount cancels the pending notice timer (no setState after unmount)', () => {
    const offAt = source.indexOf("syncPlayService.off('onMemberJoined'");
    const clearAt = source.indexOf(
      'clearTimeout(membershipNoticeTimerRef.current)',
      offAt
    );
    expect(offAt).toBeGreaterThan(-1);
    expect(clearAt).toBeGreaterThan(offAt);
    // …and the cleanup sits inside the effect teardown, before its close.
    const disconnectGuard = source.indexOf(
      'if (useSyncplayStore.getState().currentGroup === null)'
    );
    expect(clearAt).toBeLessThan(disconnectGuard);
  });
});
