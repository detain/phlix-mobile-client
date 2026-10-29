/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/autoplayNextEpisode.ts
//
// M-MOBILE-15 (review mobile__gameux): the resolution engine behind the
// PlayerScreen "Auto-play next episode" cure. The toggle persisted from
// SettingsScreen since its birth but NO component ever read it — pure
// settings theater. This module gives it a reader: when an episode reaches
// 'ended', resolve the positionally-next episode using the EXISTING wire
// contract only (GET /api/v1/media/{id} detail + GET /api/v1/media?parentId=
// children browse) and hand PlayerScreen the id to continue into. Zero new
// endpoints, zero new wire codes (contracts law).
//
// The ordering law mirrors the server's Next-Up selector
// (phlix-server src/Media/Library/NextUpSelector.php):
//  - seasons participate only when NUMBERED (`season_number` finite and
//    >= 1) — Specials are never a "next season" candidate
//    (NextUpSelector::orderForPlayback, season filter);
//  - within a season, episodes sort by `episode_number` asc with
//    UNNUMBERED episodes sorting last, tie-breaking on the episode title
//    (`episode_title` when non-empty, else `name`) — the server's
//    PHP_INT_MAX-last + strcmp-tiebreak arm;
//  - no wraparound: end of season walks to the FIRST episode of the next
//    numbered season; end of the last numbered season yields nothing
//    (finale stop, mirroring pickNext returning null at the tail).
//
// Deliberate divergence from the server RAIL: pickNext() is state-aware —
// it walks forward to the first episode that is neither watched nor
// in-progress. Autoplay CONTINUATION is positional instead: finishing S1E3
// advances into S1E4 even if S1E4 was watched before (what every shipping
// autoplay does, and what the user's toggle means). State-aware discovery
// is the Next-Up rail's job (GET /users/me/next-up — a whole-user,
// per-series rail, unfit for a per-item end-of-episode decision).
//
// Pagination is mandatory, not optional: the server clamps every /media
// page to MAX=100 rows with DEFAULT=50 (phlix-server
// src/Server/Http/Request.php, queryPageSize + PageLimit constants) and
// libraryManager.getEpisodes/getSeasons page NOT AT ALL (no limit param →
// the 50-row default silently truncates any bigger list). The page loop
// below is the only reason a season of 30 anime episodes resolves its true
// successor instead of a wrong "finale".

import { libraryManager } from '../api/LibraryManager';
import type { MediaItem } from '../types/media';

/** The two wire reads the resolver needs; `libraryManager` satisfies it. */
export interface NextEpisodeWireDeps {
  getMediaItem(itemId: string): Promise<MediaItem | null>;
  browseMedia(params: {
    parentId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MediaItem[]; total?: number }>;
}

/** Server PageLimit MAX (`/media` refuses bigger pages anyway). */
const PAGE_LIMIT = 100;
/** Hard ceiling per parent listing — a runaway page loop is never worth it. */
const MAX_ROWS = 500;

/** JSON fields are `number?` by type; the wire is trusted, not verified. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The server's title surrogate: `episode_title ?: name` (NextUpSelector input). */
function episodeTitle(item: MediaItem): string {
  const t = item.episode_title;
  if (typeof t === 'string' && t !== '') {
    return t;
  }
  return typeof item.name === 'string' ? item.name : '';
}

/** UTF-16 code-unit compare — identical to the server's strcmp on the ASCII titles that tie. */
function compareTitles(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One season's playback order (the mirror of orderForPlayback at season
 * granularity): episode-typed rows only, unnumbered last, title tie-break.
 */
export function orderEpisodesForSeason(episodes: MediaItem[]): MediaItem[] {
  return episodes
    .filter((e) => e.type === 'episode')
    .sort((a, b) => {
      const ka = finiteNumber(a.episode_number) ?? Number.POSITIVE_INFINITY;
      const kb = finiteNumber(b.episode_number) ?? Number.POSITIVE_INFINITY;
      if (ka !== kb) {
        return ka < kb ? -1 : 1;
      }
      return compareTitles(episodeTitle(a), episodeTitle(b));
    });
}

/** Numbered season rows (>= 1, Specials excluded) ascending — the mirror filter. */
function numberedSeasons(seasons: MediaItem[]): MediaItem[] {
  return seasons
    .filter((s) => {
      const n = finiteNumber(s.season_number);
      return s.type === 'season' && n !== null && n >= 1;
    })
    .sort((a, b) => {
      const sa = finiteNumber(a.season_number) as number;
      const sb = finiteNumber(b.season_number) as number;
      if (sa !== sb) {
        return sa < sb ? -1 : 1;
      }
      return compareTitles(typeof a.name === 'string' ? a.name : '', typeof b.name === 'string' ? b.name : '');
    });
}

/**
 * Page through ALL children of one parent (`/media?parentId=`). Stops on an
 * empty page, on the server-reported `total`, on a short page when `total`
 * is absent, and at the MAX_ROWS ceiling.
 */
async function listAllChildren(parentId: string, deps: NextEpisodeWireDeps): Promise<MediaItem[]> {
  const collected: MediaItem[] = [];
  let offset = 0;
  for (;;) {
    const page = await deps.browseMedia({ parentId, limit: PAGE_LIMIT, offset });
    const items = Array.isArray(page.items) ? page.items : [];
    collected.push(...items);
    offset += items.length;
    if (items.length === 0 || collected.length >= MAX_ROWS) {
      break;
    }
    const total = finiteNumber(page.total);
    if (total === null) {
      if (items.length < PAGE_LIMIT) {
        break;
      }
    } else if (collected.length >= total) {
      break;
    }
  }
  return collected;
}

/**
 * Resolve the id to autoplay after `itemId` finishes, or null when the
 * correct behavior is the OLD stop (toggle gating lives in the caller;
 * this function answers only "what comes next").
 *
 * Throws propagate — the caller degrades any failure to the stop-behavior.
 */
export async function resolveNextEpisodeId(
  itemId: string,
  deps: NextEpisodeWireDeps = libraryManager
): Promise<string | null> {
  const current = await deps.getMediaItem(itemId);
  // Movies/tracks/photos/etc.: continuation is an episode concept — the
  // stop-behavior is unchanged for everything else.
  if (!current || current.type !== 'episode') {
    return null;
  }
  const seasonId = typeof current.parent_id === 'string' && current.parent_id !== '' ? current.parent_id : null;
  if (seasonId === null) {
    return null; // unanchored row: refuse to guess a neighbor
  }

  // One fetch up front so BOTH branches below can decide without re-reading.
  const seasonRow = await deps.getMediaItem(seasonId);

  // Positional next WITHIN the parent listing. (A flat show whose episodes
  // hang directly under the series is fully covered by this same walk —
  // there the listing IS the whole show.)
  const ordered = orderEpisodesForSeason(await listAllChildren(seasonId, deps));
  const idx = ordered.findIndex((e) => e.id === itemId);
  if (idx === -1) {
    return null; // current not in its own sibling listing — nothing to trust
  }
  const next = ordered[idx + 1];
  if (next && next.id !== itemId) {
    return next.id;
  }

  // Season exhausted → the first ordered episode of the NEXT numbered season.
  if (!seasonRow || seasonRow.type !== 'season') {
    return null; // flat/unknown parent shape: the walk above saw everything
  }
  const currentSeasonNumber = finiteNumber(seasonRow.season_number);
  const seriesId =
    typeof seasonRow.parent_id === 'string' && seasonRow.parent_id !== '' ? seasonRow.parent_id : null;
  if (currentSeasonNumber === null || seriesId === null) {
    return null; // an unnumbered season (Special) has no server-law successor to trust
  }
  const seasonRows = numberedSeasons(await listAllChildren(seriesId, deps));
  const nextSeason = seasonRows.find(
    (s) => (finiteNumber(s.season_number) as number) > currentSeasonNumber
  );
  if (!nextSeason) {
    return null; // series finale
  }
  const firstOfNext = orderEpisodesForSeason(await listAllChildren(nextSeason.id, deps))[0];
  return firstOfNext && firstOfNext.id !== itemId ? firstOfNext.id : null;
}
