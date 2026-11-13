import {
  classifyTap,
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
