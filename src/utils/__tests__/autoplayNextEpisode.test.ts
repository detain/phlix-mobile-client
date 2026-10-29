/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/autoplayNextEpisode.test.ts
//
// M-MOBILE-15: pure-resolution law tests for the autoplay-next engine —
// the server-mirrored ordering (NextUpSelector season/episode law) and the
// paging loop that the 50-row wire default makes MANDATORY. The PlayerScreen
// wiring guards live in the screen suite; here we pin WHAT "next" means.

import {
  orderEpisodesForSeason,
  resolveNextEpisodeId,
  type NextEpisodeWireDeps,
} from '../autoplayNextEpisode';
import type { MediaItem } from '../../types/media';

const item = (over: Partial<MediaItem> & { id: string; type: string }): MediaItem =>
  ({ name: over.id, ...over }) as MediaItem;

const fakeDeps = (opts: {
  details?: Record<string, MediaItem | null>;
  listings?: Record<string, MediaItem[]>;
}): NextEpisodeWireDeps & { detailCalls: string[]; browseCalls: Array<{ parentId: string; offset: number }> } => {
  const detailCalls: string[] = [];
  const browseCalls: Array<{ parentId: string; offset: number }> = [];
  return {
    detailCalls,
    browseCalls,
    getMediaItem: async (id: string) => {
      detailCalls.push(id);
      const row = opts.details?.[id];
      if (row === undefined) {
        throw new Error(`unexpected detail read: ${id}`);
      }
      return row;
    },
    browseMedia: async ({ parentId, offset = 0 }: { parentId: string; limit?: number; offset?: number }) => {
      browseCalls.push({ parentId, offset });
      const all = opts.listings?.[parentId];
      if (all === undefined) {
        throw new Error(`unexpected browse: ${parentId}`);
      }
      const slice = all.slice(offset, offset + 100);
      return { items: slice, total: all.length };
    },
  };
};

describe('orderEpisodesForSeason — the mirrored season-ordering law', () => {
  it('keeps episode rows only', () => {
    const out = orderEpisodesForSeason([
      item({ id: 'a', type: 'episode', episode_number: 1 }),
      item({ id: 'x', type: 'movie' }),
      item({ id: 'b', type: 'video', episode_number: 2 }),
    ]);
    expect(out.map((e) => e.id)).toEqual(['a']);
  });

  it('sorts by episode_number ascending', () => {
    const out = orderEpisodesForSeason([
      item({ id: 'e3', type: 'episode', episode_number: 3 }),
      item({ id: 'e1', type: 'episode', episode_number: 1 }),
      item({ id: 'e2', type: 'episode', episode_number: 2 }),
    ]);
    expect(out.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('sorts UNNUMBERED episodes last, tie-breaking numbered ties on title', () => {
    const out = orderEpisodesForSeason([
      item({ id: 'odd', type: 'episode' }), // no number at all
      item({ id: 'e2b', type: 'episode', episode_number: 2, name: 'Zeta' }),
      item({ id: 'e2a', type: 'episode', episode_number: 2, name: 'Alpha' }),
      item({ id: 'e1', type: 'episode', episode_number: 1 }),
    ]);
    expect(out.map((e) => e.id)).toEqual(['e1', 'e2a', 'e2b', 'odd']);
  });

  it('uses episode_title over name for the tie-break (server surrogate)', () => {
    const out = orderEpisodesForSeason([
      item({ id: 'a', type: 'episode', episode_number: 1, name: 'zzz', episode_title: 'Bravo' }),
      item({ id: 'b', type: 'episode', episode_number: 1, name: 'aaa', episode_title: 'Alpha' }),
    ]);
    expect(out.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('treats STRING-typed numbers as unnumbered (parse, do not coerce)', () => {
    // The wire types these fields number|null; a '3' on the wire would be a
    // contract violation and must degrade to LAST, never silently sort as 3.
    const out = orderEpisodesForSeason([
      item({ id: 'str', type: 'episode', episode_number: '3' as unknown as number }),
      item({ id: 'real', type: 'episode', episode_number: 9 }),
    ]);
    expect(out.map((e) => e.id)).toEqual(['real', 'str']);
  });

  it('falls back to a plain stable pass on empty titles', () => {
    const a = item({ id: 'a', type: 'episode', episode_number: 1, name: '' });
    const b = item({ id: 'b', type: 'episode', episode_number: 1, name: '' });
    expect(orderEpisodesForSeason([a, b]).length).toBe(2);
  });
});

describe('resolveNextEpisodeId — positional continuation over the existing wire', () => {
  const ep = (id: string, season: string, n: number) =>
    item({ id, type: 'episode', parent_id: season, season_number: 1, episode_number: n });

  it('movies resolve to null and never touch the browse rail', async () => {
    const deps = fakeDeps({ details: { m: item({ id: 'm', type: 'movie' }) } });
    await expect(resolveNextEpisodeId('m', deps)).resolves.toBeNull();
    expect(deps.browseCalls).toEqual([]);
  });

  it('an unanchored episode (no parent_id) refuses to guess a neighbor', async () => {
    const deps = fakeDeps({ details: { e: item({ id: 'e', type: 'episode' }) } });
    await expect(resolveNextEpisodeId('e', deps)).resolves.toBeNull();
    expect(deps.detailCalls).toEqual(['e']); // ONE read, no parent walk
  });

  it('returns the positional next within the season', async () => {
    const deps = fakeDeps({
      details: {
        e1: ep('e1', 's1', 1),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: { s1: [ep('e1', 's1', 1), ep('e2', 's1', 2), ep('e3', 's1', 3)] },
    });
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBe('e2');
  });

  it('nulls when the current item is not in its own sibling listing (trust law)', async () => {
    const deps = fakeDeps({
      details: {
        eX: ep('eX', 's1', 5),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: { s1: [ep('e1', 's1', 1), ep('e2', 's1', 2)] },
    });
    await expect(resolveNextEpisodeId('eX', deps)).resolves.toBeNull();
  });

  it('no wraparound: finishing the LAST season never returns to the first (unsorted listing, sort arm pinned)', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 's2', 2),
        s2: item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
      },
      listings: {
        s2: [ep('e1', 's2', 1), ep('e2', 's2', 2)],
        tv: [
          item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
          item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
        ],
      },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBeNull();
  });

  it('season finale walks to the FIRST episode of the next NUMBERED season', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 's1', 2),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
        s2: item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
      },
      listings: {
        s1: [ep('e1', 's1', 1), ep('e2', 's1', 2)],
        tv: [
          item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
          item({ id: 'sp', type: 'season', parent_id: 'tv', season_number: 0 }), // Specials
          item({ id: 'sx', type: 'season', parent_id: 'tv' }), // unnumbered
          item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
        ],
        s2: [ep('n1', 's2', 1), ep('n2', 's2', 2)],
      },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBe('n1');
  });

  it('series finale (no higher numbered season) → null', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 's1', 2),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: {
        s1: [ep('e1', 's1', 1), ep('e2', 's1', 2)],
        tv: [item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 })],
      },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBeNull();
  });

  it('an UNNUMBERED current season has no trusted successor → null (no season browse)', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 'sp', 2),
        sp: item({ id: 'sp', type: 'season', parent_id: 'tv' }),
      },
      listings: { sp: [ep('e1', 'sp', 1), ep('e2', 'sp', 2)] },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBeNull();
    expect(deps.browseCalls.map((c) => c.parentId)).toEqual(['sp']); // never 'tv'
  });

  it('a non-season parent row (flat shape) exhausts at the listing → null', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 'tv', 2),
        tv: item({ id: 'tv', type: 'series' }), // parent is NOT a season row
      },
      listings: { tv: [ep('e1', 'tv', 1), ep('e2', 'tv', 2)] },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBeNull();
    expect(deps.browseCalls.map((c) => c.parentId)).toEqual(['tv']); // saw everything
  });

  it('the next season with an EMPTY listing → null', async () => {
    const deps = fakeDeps({
      details: {
        e2: ep('e2', 's1', 2),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
        s2: item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
      },
      listings: {
        s1: [ep('e2', 's1', 2)],
        tv: [
          item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
          item({ id: 's2', type: 'season', parent_id: 'tv', season_number: 2 }),
        ],
        s2: [],
      },
    });
    await expect(resolveNextEpisodeId('e2', deps)).resolves.toBeNull();
  });

  it('degenerate listing that lists the CURRENT episode as its own successor → null', async () => {
    const deps = fakeDeps({
      details: {
        e1: ep('e1', 's1', 1),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: {
        s1: [ep('e1', 's1', 1), ep('e1', 's1', 1)],
        // self-successor is rejected, so the walk reaches the season layer:
        // s1 is the ONLY numbered season → true finale-null, never a self-loop.
        tv: [item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 })],
      },
    });
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBeNull();
  });
});

describe('listAllChildren paging (via resolveNextEpisodeId browse patterns)', () => {
  const buildBigSeason = (n: number) =>
    Array.from({ length: n }, (_, i) => ep(`e${i + 1}`, 's1', i + 1));
  const ep = (id: string, season: string, num: number) =>
    item({ id, type: 'episode', parent_id: season, season_number: 1, episode_number: num });

  it('pages 100 at a time until the reported total (250 rows → offsets 0/100/200)', async () => {
    const deps = fakeDeps({
      details: {
        e1: ep('e1', 's1', 1),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: { s1: buildBigSeason(250) },
    });
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBe('e2');
    expect(deps.browseCalls.filter((c) => c.parentId === 's1').map((c) => c.offset)).toEqual([0, 100, 200]);
  });

  it('caps at 500 rows even when the server reports more (runaway guard)', async () => {
    const deps = fakeDeps({
      details: {
        e1: ep('e1', 's1', 1),
        s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
      },
      listings: { s1: buildBigSeason(1000) },
    });
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBe('e2');
    expect(deps.browseCalls.filter((c) => c.parentId === 's1')).toHaveLength(5);
  });

  it('stops on a short page when total is absent (honest older envelope)', async () => {
    const details = {
      e1: ep('e1', 's1', 1),
      s1: item({ id: 's1', type: 'season', parent_id: 'tv', season_number: 1 }),
    };
    const rows = buildBigSeason(3);
    const calls: number[] = [];
    const deps: NextEpisodeWireDeps = {
      getMediaItem: async (id: string) => (details as Record<string, MediaItem>)[id] ?? null,
      browseMedia: async ({ offset = 0 }) => {
        calls.push(offset);
        return { items: rows.slice(offset, offset + 100) }; // no total key
      },
    };
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBe('e2');
    expect(calls).toEqual([0]); // one short page ends the walk
  });

  it('stops on an empty page without a total', async () => {
    const calls: number[] = [];
    const deps: NextEpisodeWireDeps = {
      getMediaItem: async (id: string) =>
        id === 'e1' ? ep('e1', 's1', 1) : item({ id, type: 'season', season_number: 1 }),
      browseMedia: async ({ offset = 0 }) => {
        calls.push(offset);
        return { items: offset === 0 ? [ep('e1', 's1', 1)] : [] }; // 1-row first page, then empty
      },
    };
    // First page is SHORT (1 < 100) and has no total → stop immediately.
    await expect(resolveNextEpisodeId('e1', deps)).resolves.toBeNull();
    expect(calls).toEqual([0]);
  });
});
