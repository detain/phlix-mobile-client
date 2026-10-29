/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/components/player/SeekBar.test.tsx
//
// M-MOBILE-13 (review mobile__gameux): the seek bar was decorative UI over a
// real control surface — `onSeek` was destructured as `_onSeek` and the bar
// carried no responders, so dragging did NOTHING. These tests pin the cure:
//
//   1. the track captures the RN responder once measurable + seekable,
//   2. a drag PREVIEWS the drag position and seeks ZERO times until release,
//   3. the ticker (currentTime prop) cannot repaint the bar mid-drag,
//   4. release commits EXACTLY ONE seek with the final SECONDS value,
//   5. terminate (system takeover) abandons WITHOUT committing,
//   6. canSeek=false renders a live, non-capturing display (grouped member),
//   7. the touch→seconds mapping is exact and clamped (pure helper).
//
// The repo has NO React renderer in test deps (see SkipButton.test.tsx and
// PlayerScreen.test.tsx for the doctrine). SeekBar uses two useState slots, so
// a tiny slot-backed hook host stands in for the dispatcher: re-invoking the
// component reads back the (mutated) slots — the renderer-free re-render.

import type { ReactElement } from 'react';

// ── slot-backed hook host (useState only — SeekBar uses nothing else) ──────
class SlotHost {
  private slots: Array<{ value: unknown }> = [];
  private cursor = 0;

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

  render<R>(fn: () => R): R {
    this.cursor = 0;
    mockHost.current = this;
    try {
      return fn();
    } finally {
      mockHost.current = null;
    }
  }
}

const mockHost: { current: SlotHost | null } = { current: null };

// `mock`-prefixed so the jest.mock factory below may reference it (jest rule).
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (init: unknown) => mockHost.current!.useState(init as never),
  };
});

// Import AFTER the hook mock is registered (jest hoists the mock call).
import { SeekBar, scrubSecondsFromLocation } from '../../../components/player/SeekBar';

// ── element-tree helpers (renderer-free: props are invoked directly) ───────
type El = ReactElement<Record<string, any>>;

function findEl(node: unknown, pred: (el: El) => boolean): El | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findEl(child, pred);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object' && 'props' in (node as El)) {
    const el = node as El;
    if (pred(el)) return el;
    return findEl(el.props.children, pred);
  }
  return null;
}

const findTrack = (tree: unknown): El | null =>
  findEl(tree, (el) => el.props.testID === 'seek-track');

/** All rendered <Text> string children, in tree order (the two time labels). */
function textLabels(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) textLabels(child, acc);
    return acc;
  }
  if (node && typeof node === 'object' && 'props' in (node as El)) {
    const el = node as El;
    if (typeof el.props.children === 'string') acc.push(el.props.children);
    textLabels(el.props.children, acc);
  }
  return acc;
}

const responderEvent = (locationX: number) => ({
  nativeEvent: { locationX, locationY: 15 },
});

const layoutEvent = (width: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height: 30 } },
});

describe('SeekBar — M-MOBILE-13 scrub wiring', () => {
  const TRACK = 300; // px
  const DURATION = 600; // s

  type Props = {
    currentTime: number;
    duration: number;
    onSeek: jest.Mock;
    canSeek: boolean;
  };

  function mount(props: Props) {
    const host = new SlotHost();
    const renderTree = () =>
      host.render(() => (SeekBar as unknown as (p: unknown) => unknown)(props));
    return { host, renderTree, track: () => findTrack(renderTree())! };
  }

  function mountMeasured(props: Props) {
    const h = mount(props);
    // Drive the first layout pass the way RN does it.
    (h.track().props.onLayout as (e: unknown) => void)(layoutEvent(TRACK));
    h.renderTree();
    return h;
  }

  const call = (el: El, prop: string, ...args: unknown[]): unknown =>
    (el.props[prop] as (...a: unknown[]) => unknown)(...args);

  it('captures the responder once measured and seekable', () => {
    const h = mountMeasured({ currentTime: 0, duration: DURATION, onSeek: jest.fn(), canSeek: true });
    expect(h.track().props.onStartShouldSetResponder()).toBe(true);
  });

  it('does NOT capture while the track is unmeasured or the duration unknown', () => {
    const unmeasured = mount({ currentTime: 0, duration: DURATION, onSeek: jest.fn(), canSeek: true });
    expect(unmeasured.track().props.onStartShouldSetResponder).toBeUndefined();

    const zeroDuration = mountMeasured({ currentTime: 0, duration: 0, onSeek: jest.fn(), canSeek: true });
    expect(zeroDuration.track().props.onStartShouldSetResponder).toBeUndefined();
  });

  it('a drag PREVIEWS the position and seeks zero times until release', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 60, duration: DURATION, onSeek, canSeek: true });

    call(h.track(), 'onResponderGrant', responderEvent(50));
    call(h.track(), 'onResponderMove', responderEvent(150));
    const tree = h.renderTree();

    // 150/300 of 600 s = 300 s → "5:00" on the left label…
    expect(textLabels(tree)).toContain('5:00');
    // …while ZERO native seeks left the bar (per-move seeking = thrash class).
    expect(onSeek).toHaveBeenCalledTimes(0);
  });

  it('the ticker cannot repaint the bar mid-drag (display paused, not state)', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 500, duration: DURATION, onSeek, canSeek: true });
    call(h.track(), 'onResponderGrant', responderEvent(150));

    // The native progress stream keeps ticking (currentTime=500 → "8:20")
    // WHILE the finger holds the thumb at 300 s — the bar stays on the drag.
    const during = textLabels(h.renderTree());
    expect(during).toContain('5:00');
    expect(during).not.toContain('8:20');

    call(h.track(), 'onResponderRelease', responderEvent(150));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(300);

    // After the commit the bar is released back to the live ticker.
    expect(textLabels(h.renderTree())).toContain('8:20');
  });

  it('release commits EXACTLY ONE seek with the FINAL SECONDS value', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 60, duration: DURATION, onSeek, canSeek: true });

    call(h.track(), 'onResponderGrant', responderEvent(100));
    call(h.track(), 'onResponderMove', responderEvent(150));
    call(h.track(), 'onResponderMove', responderEvent(200));
    call(h.track(), 'onResponderRelease', responderEvent(240));

    // 240/300 × 600 s = 480 s — ONE call, final value, seconds (not ms).
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(480);
  });

  it('a tap commits one seek at the tapped position', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 0, duration: DURATION, onSeek, canSeek: true });
    call(h.track(), 'onResponderGrant', responderEvent(150));
    call(h.track(), 'onResponderRelease', responderEvent(150));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(300);
  });

  it('terminate (system takeover) abandons WITHOUT committing', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 60, duration: DURATION, onSeek, canSeek: true });
    call(h.track(), 'onResponderGrant', responderEvent(150));
    call(h.track(), 'onResponderTerminate');
    expect(onSeek).toHaveBeenCalledTimes(0);
    // The bar returned to the ticker: display follows currentTime again.
    expect(textLabels(h.renderTree())).toContain('1:00');
  });

  it('canSeek=false is a LIVE, non-capturing display (grouped member)', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 300, duration: DURATION, onSeek, canSeek: false });
    expect(h.track().props.onStartShouldSetResponder).toBeUndefined();
    expect(h.track().props.onResponderGrant).toBeUndefined();
    // Still shows where the GROUP is — the member follows the host clock.
    expect(textLabels(h.renderTree())).toContain('5:00');
    expect(onSeek).toHaveBeenCalledTimes(0);
  });

  it('drags clamp into [0, duration]', () => {
    const onSeek = jest.fn();
    const h = mountMeasured({ currentTime: 60, duration: DURATION, onSeek, canSeek: true });
    call(h.track(), 'onResponderGrant', responderEvent(-80));
    call(h.track(), 'onResponderRelease', responderEvent(-80));
    call(h.track(), 'onResponderGrant', responderEvent(400));
    call(h.track(), 'onResponderRelease', responderEvent(400));
    expect(onSeek).toHaveBeenCalledTimes(2);
    expect(onSeek).toHaveBeenNthCalledWith(1, 0);
    expect(onSeek).toHaveBeenNthCalledWith(2, 600);
  });
});

describe('scrubSecondsFromLocation — touch→seconds math (pure)', () => {
  it('maps linearly and EXACTLY: half of a 600 s track is 300 s', () => {
    expect(scrubSecondsFromLocation(150, 300, 600)).toBe(300);
    expect(scrubSecondsFromLocation(240, 300, 600)).toBe(480);
  });

  it('clamps both ends into [0, duration]', () => {
    expect(scrubSecondsFromLocation(-10, 300, 600)).toBe(0);
    expect(scrubSecondsFromLocation(301, 300, 600)).toBe(600);
  });

  it('an unmeasured track or unknown duration yields 0, never NaN', () => {
    expect(scrubSecondsFromLocation(100, 0, 600)).toBe(0);
    expect(scrubSecondsFromLocation(100, 300, 0)).toBe(0);
  });
});
