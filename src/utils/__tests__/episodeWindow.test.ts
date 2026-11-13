import {
  EPISODE_CHUNK,
  effectiveEpisodeLimit,
  growEpisodeWindow,
  initialEpisodeWindow,
  remainingEpisodes,
  visibleEpisodes,
} from '../episodeWindow';

const eps = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));

describe('episodeWindow (MOB-20 / MOB-S18)', () => {
  it('caps the first render at one 40-row chunk', () => {
    expect(EPISODE_CHUNK).toBe(40);
    const limit = effectiveEpisodeLimit(initialEpisodeWindow, 's1');
    expect(visibleEpisodes(eps(100), limit)).toHaveLength(40);
    expect(remainingEpisodes(100, limit)).toBe(60);
  });

  it('shows everything (no remainder) for a short season', () => {
    const limit = effectiveEpisodeLimit(initialEpisodeWindow, 's1');
    expect(visibleEpisodes(eps(12), limit)).toHaveLength(12);
    expect(remainingEpisodes(12, limit)).toBe(0);
  });

  it('Show more grows by one chunk per tap until the list is exhausted', () => {
    let win = initialEpisodeWindow;
    win = growEpisodeWindow(win, 's1');
    expect(visibleEpisodes(eps(100), effectiveEpisodeLimit(win, 's1'))).toHaveLength(80);
    win = growEpisodeWindow(win, 's1');
    const limit = effectiveEpisodeLimit(win, 's1');
    expect(visibleEpisodes(eps(100), limit)).toHaveLength(100);
    expect(remainingEpisodes(100, limit)).toBe(0);
  });

  it('a season change resets the window to the first chunk', () => {
    let win = growEpisodeWindow(initialEpisodeWindow, 's1');
    win = growEpisodeWindow(win, 's1');
    expect(effectiveEpisodeLimit(win, 's1')).toBe(3 * EPISODE_CHUNK);
    expect(effectiveEpisodeLimit(win, 's2')).toBe(EPISODE_CHUNK);
    // Growing on the new season starts from one chunk, not the old window.
    expect(effectiveEpisodeLimit(growEpisodeWindow(win, 's2'), 's2')).toBe(2 * EPISODE_CHUNK);
    // Returning to the old season does not resurrect its grown window.
    const back = growEpisodeWindow(growEpisodeWindow(win, 's2'), 's1');
    expect(effectiveEpisodeLimit(back, 's1')).toBe(2 * EPISODE_CHUNK);
  });
});
