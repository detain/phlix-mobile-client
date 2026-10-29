/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/resumePositions.test.ts
//
// The resume/progress UNIT boundary (review mobile__gameux C-1): server rows
// speak 100ns TICKS, the player speaks SECONDS, the rail card speaks 0–100
// percent. These conversions feed Resume's `startPosition` — an off-by-10⁷
// here silently restarts every resume at the wrong spot (or the wrong side of
// the server's gates), so the math is pinned exactly.

import {
  TICKS_PER_SECOND,
  secondsToTicks,
  ticksToSeconds,
  buildResumeMap,
  continueWatchingProgressPercent,
} from '../resumePositions';
import type { MediaItem } from '../../types/media';

const row = (over: Partial<MediaItem>): MediaItem => ({
  id: 'm0',
  name: 'Row',
  type: 'movie',
  ...over,
});

describe('resumePositions — tick/second wire units', () => {
  it('the tick unit is 100ns: one second is 10_000_000 ticks', () => {
    expect(TICKS_PER_SECOND).toBe(10_000_000);
  });

  it('secondsToTicks multiplies by 10^7 and floors to integer ticks', () => {
    expect(secondsToTicks(120)).toBe(1_200_000_000);
    expect(secondsToTicks(120.45)).toBe(1_204_500_000);
    expect(secondsToTicks(0.99999999)).toBe(9_999_999); // floor, never round up
  });

  it('ticksToSeconds divides by 10^7 and floors (a resume never overshoots)', () => {
    expect(ticksToSeconds(1_200_000_000)).toBe(120);
    expect(ticksToSeconds(1_234_567_890)).toBe(123);
    expect(ticksToSeconds(0)).toBe(0);
  });

  it('a 1000× unit slip is DISTINGUISHABLE (mutation tripwire)', () => {
    // The S293 ms-law lineage: pick a value whose wrong-unit reading differs.
    expect(secondsToTicks(42.5)).toBe(425_000_000);
    expect(ticksToSeconds(425_000_000)).toBe(42);
    expect(secondsToTicks(42.5)).not.toBe(42_500); // not milliseconds
  });
});

describe('buildResumeMap — continue-watching rail indexing', () => {
  it('indexes the top-level position_ticks by media id', () => {
    const map = buildResumeMap([
      row({ id: 'm1', position_ticks: 420_000_000 }),
      row({ id: 'm2', position_ticks: 5_000_000 }),
    ]);

    expect(map).toEqual({ m1: 420_000_000, m2: 5_000_000 });
  });

  it('skips rows with no positive numeric position and rows without an id', () => {
    const map = buildResumeMap([
      row({ id: 'zero', position_ticks: 0 }),
      row({ id: 'missing' }),
      row({ id: '', position_ticks: 100 }),
    ]);

    expect(map).toEqual({});
  });

  it('reads ONLY position_ticks — the phantom user_data block carries no resume', () => {
    // The pre-C17 client fabricated `user_data.resume_position_ticks`; the
    // server never sends it. A row shaped like the OLD fiction must NOT yield
    // a resume point.
    const phantomish = row({ id: 'm9' });
    expect(buildResumeMap([phantomish])).toEqual({});
  });
});

describe('continueWatchingProgressPercent — rail bar from ticks', () => {
  it('derives the watched percent from the tick pair', () => {
    expect(
      continueWatchingProgressPercent(
        row({ id: 'm1', position_ticks: 3_000_000_000, duration_ticks: 6_000_000_000 }),
      ),
    ).toBe(50);
  });

  it('clamps to 0..100 and treats unknown duration or position as 0', () => {
    expect(
      continueWatchingProgressPercent(
        row({ id: 'm1', position_ticks: 7_000_000_000, duration_ticks: 6_000_000_000 }),
      ),
    ).toBe(100);
    expect(continueWatchingProgressPercent(row({ id: 'm1', position_ticks: 100 }))).toBe(0);
    expect(
      continueWatchingProgressPercent(row({ id: 'm1', duration_ticks: 6_000_000_000 })),
    ).toBe(0);
    expect(continueWatchingProgressPercent(row({ id: 'm1' }))).toBe(0);
  });
});
