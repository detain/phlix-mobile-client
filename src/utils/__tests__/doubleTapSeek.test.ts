import {
  classifyTap,
  createTapController,
  tapZone,
  DOUBLE_TAP_WINDOW_MS,
} from '../doubleTapSeek';

describe('doubleTapSeek', () => {
  it('zones the surface', () => {
    expect(tapZone(10, 1000)).toBe('left');
    expect(tapZone(500, 1000)).toBe('center');
    expect(tapZone(950, 1000)).toBe('right');
    expect(tapZone(5, 0)).toBe('center');
  });

  it('centre tap toggles immediately', () => {
    expect(classifyTap(500, 1000, 0, null)).toEqual({ kind: 'toggle' });
  });

  it('first edge tap defers', () => {
    expect(classifyTap(50, 1000, 0, null)).toEqual({ kind: 'defer' });
  });

  it('double tap on edges seeks -/+10', () => {
    expect(classifyTap(50, 1000, 200, { zone: 'left', at: 0 })).toEqual({ kind: 'seek', delta: -10 });
    expect(classifyTap(950, 1000, 200, { zone: 'right', at: 0 })).toEqual({ kind: 'seek', delta: 10 });
  });

  it('slow second tap or opposite edge does not seek', () => {
    expect(classifyTap(50, 1000, DOUBLE_TAP_WINDOW_MS + 1, { zone: 'left', at: 0 })).toEqual({ kind: 'defer' });
    expect(classifyTap(950, 1000, 100, { zone: 'left', at: 0 })).toEqual({ kind: 'defer' });
  });
});

describe('createTapController (MOB-S25 gesture/timer behaviour)', () => {
  function harness(isLive = false) {
    let t = 0;
    let timerFn: (() => void) | null = null;
    let timerHandle = 0;
    const calls = { toggle: 0, seeks: [] as number[], cleared: 0 };
    const c = createTapController({
      getWidth: () => 1000,
      onToggle: () => { calls.toggle++; },
      onSeek: (d: number) => { calls.seeks.push(d); },
      isLive: () => isLive,
      now: () => t,
      setTimer: (fn: () => void) => { timerFn = fn; return ++timerHandle; },
      clearTimer: () => { calls.cleared++; timerFn = null; },
    });
    return { c, calls, advance: (ms: number) => { t += ms; }, fire: () => timerFn?.(), pending: () => timerFn !== null };
  }

  it('centre tap toggles at once with no timer', () => {
    const h = harness();
    h.c.handleTap(500);
    expect(h.calls.toggle).toBe(1);
    expect(h.pending()).toBe(false);
  });

  it('a lone edge tap defers, then toggles when the window elapses', () => {
    const h = harness();
    h.c.handleTap(50);
    expect(h.calls.toggle).toBe(0);
    expect(h.pending()).toBe(true);
    h.fire();
    expect(h.calls.toggle).toBe(1);
  });

  it('a second edge tap in-window seeks and cancels the pending toggle', () => {
    const h = harness();
    h.c.handleTap(50);
    h.advance(100);
    h.c.handleTap(60);
    expect(h.calls.seeks).toEqual([-10]);
    expect(h.pending()).toBe(false);
    h.fire();
    expect(h.calls.toggle).toBe(0);
  });

  it('opposite edges and late second taps never seek', () => {
    const h = harness();
    h.c.handleTap(50);
    h.advance(100);
    h.c.handleTap(950);
    expect(h.calls.seeks).toEqual([]);
    h.advance(DOUBLE_TAP_WINDOW_MS + 1);
    h.c.handleTap(950);
    expect(h.calls.seeks).toEqual([]);
  });

  it('a centre tap during the window cancels the deferred toggle (no double toggle)', () => {
    const h = harness();
    h.c.handleTap(50);
    h.c.handleTap(500);
    expect(h.calls.toggle).toBe(1);
    h.fire();
    expect(h.calls.toggle).toBe(1);
  });

  it('dispose cancels a pending deferred toggle', () => {
    const h = harness();
    h.c.handleTap(50);
    h.c.dispose();
    h.fire();
    expect(h.calls.toggle).toBe(0);
  });

  it('live streams: edge double-tap never seeks, every tap toggles immediately', () => {
    const h = harness(true);
    h.c.handleTap(50);
    h.c.handleTap(50);
    expect(h.calls.seeks).toEqual([]);
    expect(h.calls.toggle).toBe(2);
    expect(h.pending()).toBe(false);
  });
});
