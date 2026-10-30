/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/homeEmptyState.test.ts
//
// M-MOBILE-37 (review mobile__gameux): the pure emptiness decision behind
// the Home day-one guidance tile. No renderer — the screen mounts the
// existing `EmptyState` component when this says true (pair law: the
// slice(0, 3) mirror must match the render window).

import { homeShowsEmptyState } from '../homeEmptyState';

const lib = (id: string) => ({ id });

describe('homeShowsEmptyState (M-MOBILE-37)', () => {
  it('is true for the day-one void: no history, no recently-added, no libraries', () => {
    expect(homeShowsEmptyState([], [], [], {})).toBe(true);
  });

  it('is true when libraries exist but every RENDERED row is empty', () => {
    expect(
      homeShowsEmptyState([], [], [lib('a'), lib('b')], {
        a: [],
        b: [],
      })
    ).toBe(true);
    // Absent (still-loading) rows count as empty — the predicate runs on
    // the same render inputs the ScrollView consumes.
    expect(homeShowsEmptyState([], [], [lib('a')], {})).toBe(true);
  });

  it('mirrors the render window: a 4th library with items does not suppress guidance', () => {
    const libraries = [lib('a'), lib('b'), lib('c'), lib('d')];
    const items = { a: [], b: [], c: [], d: [{ id: 'x' } as never] };
    expect(homeShowsEmptyState([], [], libraries, items)).toBe(true);
    // The moment a VISIBLE row has data, guidance steps aside.
    expect(
      homeShowsEmptyState([], [], libraries, { ...items, b: [{ id: 'y' } as never] })
    ).toBe(false);
  });

  it('is false whenever any rail has content', () => {
    expect(homeShowsEmptyState([{ id: 'cw' }], [], [], {})).toBe(false);
    expect(homeShowsEmptyState([], [{ id: 'ra' }], [], {})).toBe(false);
  });
});
