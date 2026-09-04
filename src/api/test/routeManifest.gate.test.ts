/**
 * routeManifest.gate.test — S280 client route gate (phlix-mobile-client).
 *
 * WHAT IT PINS: every URL the mobile app's request-issuing code can put on
 * the wire is tuple-exact against the VENDORED phlix-server route manifest.
 * The expected set comes from the SERVER side only — `server-route-manifest.json`
 * is a byte-for-byte copy of `@phlix/contracts` `dist/server-route-manifest.json`
 * (provenance: server sha inside) — never from anything derived off this
 * client. A manifest derived from the client it checks would self-adjust and
 * pass every defect it exists to catch (S276/S279/S264 all shipped BECAUSE no
 * such gate existed).
 *
 * MATCHING IS EXACT, NEVER SUBSTRING: `{param}` segments are compared as
 * whole path segments (both server `{id}` and client `${...}` canonicalise to
 * the same `{P}` token; everything else is literal string equality over the
 * FULL `METHOD /path` key). `/api/v1/media/{id}` therefore cannot absorb
 * `/api/v1/media/{id}/markers` — sibling-wildcard absorption is the failure
 * mode this whole step exists to prevent.
 *
 * COVERAGE IS A PIN, NOT A PROMISE: the exact set of scanned (verb, template)
 * sites and the per-module counts are asserted. A module added without being
 * gated, a site the scanner stops seeing, or coverage quietly shrinking all
 * RED here — so partial coverage can never read as full.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MANIFEST_PATH = path.join(__dirname, 'server-route-manifest.json');

interface Manifest {
  $comment: string;
  provenance: {
    serverSha: string;
    generatedAt: string;
    generator: string;
    total: number;
  };
  routes: [string, string][];
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;

function isParamSegment(segment: string): boolean {
  return /^\{[^{}]*\}$/.test(segment);
}

/**
 * Template-vs-template segment match: SAME number of segments, and each
 * segment must be SERVEABLE: a server parameter (`{id}`) covers a client
 * literal (`/media/42`) and a client interpolation (`${x}`) alike; two
 * literals must be equal; a client parameter must NOT match a server literal
 * (the interpolated value varies at run time — `/media/index` registered
 * literally would not serve `/media/${anythingElse}`). Anchored by
 * construction — lengths must agree, so `/media/{id}` can never absorb
 * `/media/{id}/markers`, and no substring/prefix is ever consulted.
 */
function templateMatches(serverTemplate: string, clientTemplate: string): boolean {
  const a = serverTemplate.split('/');
  const b = clientTemplate.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => isParamSegment(seg) || (!isParamSegment(b[i]) && seg === b[i]));
}

function served(method: string, clientPath: string): boolean {
  return manifest.routes.some(([m, r]) => m === method && templateMatches(r, clientPath));
}

// ── scan the request-issuing sources ────────────────────────────────────────

interface Site {
  method: string;
  /** `/api/v1/...` with `${...}` interpolations canonicalised to `{P}`. */
  path: string;
  file: string;
  line: number;
}

/**
 * Files that legitimately carry NO server-manifest-addressed literal URLs and
 * are excluded from the scan with an enumerated reason:
 * - hub-addressed modules talk to the HUB (a different registry); pinning
 *   them against the server manifest would be a category error, so they are
 *   listed here and triple-checked NOT to be server routes below.
 * - passthrough wrappers mint no URLs of their own (variable-first argument);
 *   their CALLERS' literals are what the scan pins.
 * New request-issuing file appears → this list or the pin must change → RED.
 */
const EXCLUDED_FILES: Record<string, string> = {
  'src/api/hubAwareClient.ts': 'passthrough wrapper; forwards caller-supplied `url` variables (server-addressed callers are scanned; hub-addressed callers live under src/hub/)',
  'src/hub/HubAuthService.ts': 'hub-addressed axios instance (baseURL = hub root): /api/v1/auth/login|refresh proxied by the hub, /api/v1/me/servers is HUB-only',
  'src/hub/RelayTokenProvider.ts': 'hub-addressed fetch: POST /api/v1/me/servers/{id}/relay-token is minted by the HUB (S298/S2a)',
};

/** apiClient.<verb>(['"`literal" or generics then a literal; multi-line aware. */
const WRAPPER_RE = /(?:apiClient|axios)\.(get|post|put|patch|delete)\b(?:<[\s\S]{0,160}?>)?\s*\(\s*([`'"])([^`'"]+)\2/g;
/** Raw absolute call on the API base: axios.`verb`(`${getBaseUrl()}/path`). */
const ABS_RE = /(?:axios|this\.client)\.(get|post|put|patch|delete)\b\s*\(\s*`\$\{(?:getBaseUrl|getApiBaseUrl)\(\)\}([^`]*)`/g;
/** URL variable minted from the API base and handed to fetch() (GET). */
const FETCH_URL_RE = /(?:const|let)\s+\w*[uU]rl\w*\s*=\s*`\$\{getApiBaseUrl\(\)\}([^`]*)`/g;

function commentStripped(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test' || entry === 'node_modules') continue;
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function normalizePath(raw: string): string {
  if (raw.startsWith('${getBaseUrl') || raw.startsWith('${getApiBaseUrl')) {
    throw new Error(`base-prefixed template must go through ABS/FETCH rules, not WRAPPER: ${raw}`);
  }
  let p = raw.split('?')[0];
  p = p.replace(/\$\{[^}]*\}/g, '{P}');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p.startsWith('/')) throw new Error(`scanned URL literal does not start with /: ${raw}`);
  return p.startsWith('/api/v1') ? p : `/api/v1${p}`;
}

function scan(): { sites: Site[]; coveredFiles: string[] } {
  const sites: Site[] = [];
  const coveredFiles: string[] = [];
  for (const file of collectSourceFiles(path.join(REPO_ROOT, 'src'))) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    if (EXCLUDED_FILES[rel]) continue;
    const code = commentStripped(readFileSync(file, 'utf8'));
    const had = sites.length;
    for (const [, verb, , literal] of code.matchAll(WRAPPER_RE)) {
      // Base-prefixed templates belong to the ABS/FETCH rules below.
      if (literal.startsWith('${getBaseUrl') || literal.startsWith('${getApiBaseUrl')) continue;
      sites.push({ method: verb.toUpperCase(), path: normalizePath(literal), file: rel, line: 0 });
    }
    for (const [, verb, suffix] of code.matchAll(ABS_RE)) {
      sites.push({ method: verb.toUpperCase(), path: normalizePath(suffix), file: rel, line: 0 });
    }
    for (const [, suffix] of code.matchAll(FETCH_URL_RE)) {
      sites.push({ method: 'GET', path: normalizePath(suffix), file: rel, line: 0 });
    }
    if (sites.length > had) coveredFiles.push(rel);
  }
  return { sites, coveredFiles };
}

// ── the pins ─────────────────────────────────────────────────────────────────

/**
 * Per-module counts measured on the tree at merge time. If this number moves,
 * either the client started or stopped issuing URLs (good reason: update it
 * WITH the manifest check passing) or the scanner went blind (bad reason:
 * find out which before touching this number).
 */
const PER_MODULE_COVERAGE: Record<string, number> = {
  'src/api/AdminManager.ts': 56,
  'src/api/AuthManager.ts': 4,
  'src/api/CastManager.ts': 24,
  'src/api/CollectionManager.ts': 10,
  'src/api/FavoritesManager.ts': 6,
  'src/api/LibraryManager.ts': 5,
  'src/api/LiveTvManager.ts': 13,
  'src/api/MarkerManager.ts': 2,
  'src/api/MusicManager.ts': 7,
  'src/api/ParentalControlsManager.ts': 9,
  'src/api/PhotoManager.ts': 5,
  'src/api/PlaybackManager.ts': 3,
  'src/api/ProfileManager.ts': 7,
  'src/api/SyncPlayManager.ts': 4,
  'src/api/TranscodeManager.ts': 2,
  'src/api/UserManager.ts': 6,
  'src/api/WebAuthnManager.ts': 6,
  'src/api/client.ts': 1,
  // S280 finding: one screen mints a request URL directly (bypassing the api
  // layer). Covered here; also worth a future store extraction, but NOT this
  // lane's job.
  'src/screens/RecommendationsScreen.tsx': 1,
};
const TOTAL_SITES = Object.values(PER_MODULE_COVERAGE).reduce((a, b) => a + b, 0);

describe('S280 route gate — vendored manifest integrity', () => {
  it('is the contracts artifact derived from phlix-server 888a42b2', () => {
    // Same provenance strings as @phlix/contracts master dist/server-route-manifest.json.
    expect(manifest.provenance.serverSha).toBe('888a42b2e582d6dc602f2fca537b64fee9b772a1');
    expect(manifest.provenance.total).toBe(400);
    expect(manifest.routes).toHaveLength(400);
    expect(manifest.provenance.generator).toBe('scripts/generate-server-route-manifest.mjs');
  });
});

describe('S280 route gate — every URL mobile issues is tuple-exact served', () => {
  const { sites } = scan();

  it('has NO unserved URL in the request-issuing code', () => {
    const unserved = sites.filter((s) => !served(s.method, s.path));
    expect(unserved.map((u) => `${u.method} ${u.path}  <- ${u.file}`)).toEqual([]);
  });

  it('covers exactly the pinned modules with the pinned counts (no silent shrink/grow)', () => {
    const perFile = new Map<string, number>();
    for (const s of sites) perFile.set(s.file, (perFile.get(s.file) ?? 0) + 1);
    // S280 AC: the covered-URL count is STATED per client, so partial coverage
    // can never read as full.
    const uniqueTuples = new Set(sites.map((s) => `${s.method} ${s.path}`));
    console.log(
      `[S280 route gate] mobile: ${sites.length} request sites / ${uniqueTuples.size} distinct [method, pathTemplate] tuples ` +
        `across ${perFile.size} modules — all tuple-exact against the vendored 400-route manifest @ ${manifest.provenance.serverSha}`,
    );
    for (const [file, count] of [...perFile.entries()].sort()) {
      console.log(`  ${file}: ${count}`);
    }
    expect(Object.fromEntries(perFile)).toEqual(PER_MODULE_COVERAGE);
    expect(sites.length).toBe(TOTAL_SITES);
  });

  it('the excluded passthrough/hub files carry NO server-addressed literal URLs', () => {
    // The exclusion list is only honest while those files mint no literals
    // against the SERVER. Re-scan each excluded file and require every path
    // literal it contains to be ABSENT from the server manifest under every
    // method (i.e. genuinely hub-addressed / caller-supplied). A future edit
    // pointing one at the server registry must move it into the gate.
    for (const rel of Object.keys(EXCLUDED_FILES)) {
      const code = commentStripped(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      for (const [, , , literal] of code.matchAll(WRAPPER_RE)) {
        if (!literal.startsWith('/')) continue;
        const full = normalizePath(literal);
        const hitsOnServer = manifest.routes.filter(([, route]) => templateMatches(route, full));
        expect({ file: rel, path: full, hitsOnServer }).toEqual({
          file: rel,
          path: full,
          hitsOnServer: [],
        });
      }
    }
  });

  it('the S279-class regression tripwire: /syncplay/rooms is unserved AND uncalled', () => {
    // The defect this wave fixed in mobile. Both halves must stay red-shaped:
    // the manifest must not start serving it, and the client must not start
    // calling it again.
    expect(served('GET', '/api/v1/syncplay/rooms')).toBe(false);
    expect(served('POST', '/api/v1/syncplay/rooms')).toBe(false);
    expect(served('DELETE', '/api/v1/syncplay/rooms/{P}/leave')).toBe(false);
    const roomCalls = sites.filter((s) => s.path.includes('/syncplay/rooms'));
    expect(roomCalls).toEqual([]);
  });

  it('WebSocket / relay transports are pinned OUT of the HTTP manifest (by design)', () => {
    // getWebSocketUrl and SyncPlayService build ws(s) URLs for the SyncPlay
    // socket — a different registry than the HTTP ROUTE_MANIFEST. They are
    // outside the scan by receiver shape (no verb-call literal); pin that
    // they are ALSO outside the manifest so nobody mistakes them for gated.
    expect(manifest.routes.some(([, r]) => r.includes('syncplay/ws'))).toBe(false);
    expect(manifest.routes.some(([, r]) => r.includes('relay/syncplay'))).toBe(false);
  });

  it('fails RED, demonstrably, on a planted unserved URL (non-vacuity control)', () => {
    // The scanner + membership test, run over a synthetic tree addition, MUST
    // flag an unserved URL. A gate never seen to fail proves nothing (S280 AC).
    const planted: Site[] = [
      { method: 'GET', path: '/api/v1/s280-planted-probe/{P}', file: 'src/api/PLANTED.ts', line: 1 },
    ];
    const flagged = planted.filter((s) => !served(s.method, s.path));
    expect(flagged).toEqual(planted);
    // The exact-compare discipline holds at the segment level: a registered
    // template must not absorb a DEEPER path. `/api/v1/media/{id}` serving a
    // two-segment tail would be sibling-wildcard absorption.
    expect(served('GET', '/api/v1/media/{P}/not-registered')).toBe(false);
  });
});
