#!/usr/bin/env node
/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
/**
 * scripts/audit-gate.mjs — the npm-audit gate (review w07L4 DD #3; MW-100).
 *
 * WHAT THIS IS (read this before touching anything below)
 * -------------------------------------------------------
 * `npm audit` has no allowlist, so the ONLY way to keep a KNOWN, REVIEWED,
 * UNFIXABLE-WITHIN-RANGE advisory from redding CI forever is to filter by
 * ADVISORY ID. This file carries the entire filter, as data:
 * `ALLOWED_ADVISORIES` maps each allowed GHSA id -> its review record.
 *
 * THE LAW, in code: every advisory npm reports must be a member of that Map.
 * Report clean                       -> exit 0.
 * Report advisories, all allowed      -> exit 0 (each one PRINTED with its
 *                                        package + reason, so the green run
 *                                        stays honest in the CI log).
 * Report ANY id not in the Map        -> exit 1 (fail loud, listing
 *                                        unknown ids, packages, severities,
 *                                        and the broken chain paths).
 * npm audit itself broken (exit >= 2, unparseable report, or a NONZERO-but-
 * LESS-THAN-2 exit that reports ZERO advisories — the one shape where a naive
 * filter could green-on-broken) -> exit 2 (structural error, distinct code,
 * never conflated with a policy violation).
 *
 * WHY NOT just `npm audit --audit-level=high`? (the step this gate replaced)
 * -------------------------------------------------------------------------
 * The severity filter is not a decision record: it hides EVERY future
 * moderate-or-below advisory (the whole 7-low + 28-moderate parent census
 * ran silently under it at b029b694), it greens on a broken audit, and it
 * makes the actual accepted-risk set invisible. This gate inverts that: the
 * accepted set is EXPLICIT, COUNTED, and ID-PINNED; everything else — ANY
 * severity — is a red build until consciously adjudicated.
 *
 * HOW TO CLEAR AN ENTRY (the removal ritual — the list is NEVER a graveyard)
 * --------------------------------------------------------------------------
 * Run `npm update` (the whole dev chain resolves in-range; package.json
 * ranges untouched) and `node scripts/audit-gate.mjs` at the moment you
 * expect the fix to have landed. If the gate reports the advisory CLEARED,
 * delete its Map entry IN THAT SAME commit — the matching fixture in
 * src/__tests__/fixtures/audit-gate/ and the exact-set census in
 * src/__tests__/workflowInstalls.gate.test.ts rotate together with it (the
 * census test reddens on any silent add OR drop — that is the point).
 * The re-verify-by date in each entry is a HARD CI-adjacent duty: when it
 * passes, re-run the probe ritual whether or not you expect movement.
 *
 * HISTORY (each date = a decision, not a status)
 * -----------------------------------------------
 * 2026-11-08  Opened (fix lane w12 L10, MW-100) with three entries, each
 *             MEASURED on this repo's tree at b029b694 — the mobile port of
 *             the windows-client gate design (same subset law, same exit
 *             taxonomy, same anti-neutering law, same mirror-fixture law).
 *             The in-range clear was EXECUTED, not assumed: `npm update
 *             --legacy-peer-deps` (a bare resolve ERESOLVEs — the repo's
 *             own react-native-reanimated range ^4.5.0 admits 4.7.1, whose
 *             peer floor is react-native 0.86-0.88 against this repo's
 *             0.85.3) on a probe clone left EXACTLY these three ids
 *             flagged; the 6 highs + every other moderate/low cleared
 *             in-range (body-parser 2.4.0, follow-redirects 1.16.2,
 *             joi 17.13.9, launch-editor 2.14.2, qs 6.17.1, zod 4.6.7,
 *             image-size via the metro-family 0.84.4 -> 0.84.6 bump);
 *             the committed package-lock.json IS that cleared re-resolve,
 *             with reanimated re-pinned to 4.5.1 INSIDE its declared range
 *             so the strict-peer `npm ci --allow-git=all` CI runs (no legacy
 *             flag) resolves clean — verified by a strict ci dry-run; every
 *             package.json dependency RANGE is byte-identical to the
 *             reviewed parent (this wave's only package.json edit is the
 *             audit:gate script line), the @phlix tag pins unmoved, and the
 *             battery passed 128 suites/1829 passed + 1 skip EXACT on the
 *             updated probe tree (jest, runInBand); the final-tree battery
 *             with this wave's new suites is recorded in CHANGELOG.
 *             The same three ids then required the allowlist because their
 *             patched lines sit BEYOND the declared parent ranges.
 *
 * ADDING AN ENTRY (only on an owner-adjudicated decision, never to un-redden
 * a build casually) — ALL mandatory:
 *   1. the advisory must be UNFIXABLE without a major version change (dev
 *      chain: the parent's declared range cannot reach the patched version;
 *      production: no fixed release exists at all — attach the registry
 *      evidence in the justification),
 *   2. justification naming the vulnerable package, the dependency path, the
 *      exposure class, and why the risk is accepted,
 *   3. the re-verify-by duty date (within ~3 months),
 *   4. the removal plan (what upstream event clears it, and HOW it will be
 *      verified — the bump ritual above),
 *   5. the matching fixture in src/__tests__/fixtures/audit-gate/ (mirror
 *      law: one entry, one fixture — the workflow-gate census test asserts
 *      the exact allowed-id set, so a new entry without it reddens CI),
 *   6. an entry row in CHANGELOG.md.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Exit codes. Keep them distinct: a broken audit must never masquerade as a policy verdict. */
export const EXIT_OK = 0;
export const EXIT_VIOLATION = 1;
export const EXIT_STRUCTURE_ERROR = 2;

/**
 * The allowlist. Every advisory `npm audit` reports must appear here — a bare
 * id would be meaningless, so each entry carries its review record (the
 * adjudicated decision, not a status). See the header for how entries are
 * born (owner adjudication) and die (bump + verify, same commit as the
 * fixture + census rotation).
 * @type {Map<string, {package: string, justification: string}>}
 */
export const ALLOWED_ADVISORIES = new Map([
  [
    // MEASURED 2026-11-08 (w12 L10, review w07L4 DD #3 / MW-100):
    // GHSA-3g3m-2fjr-6pw4 — glob '>=9.0.0 <=14.0.1' (MODERATE, CWE-400):
    // post-timeout filesystem traversal when a glob run is cancelled via an
    // AbortSignal that fires after the timeout. FLAGGED COPY: hoisted
    // glob@13.0.7, dev=true — EVERY glob node in the resolved tree is a dev
    // node (jest/test-exclude/@react-native-community/cli chain); nothing
    // ships in the app bundle. The 13.x line is held by THIS REPO'S OWN
    // package.json override "glob": "^13.0.6" — a load-bearing CI choice:
    // jest.config.js documents why the glob line and the v8 coverage
    // provider must move together (test-exclude@6's promisify(require('glob'))
    // shape; glob >= 9 exports an object, not a callable), so bumping across
    // a major is a battery-verification project, not an in-range clear —
    // and npm's own fixAvailable for this advisory is a react-native@0.88.1
    // MAJOR (rejected lineage: estate precedent — no major cascades for
    // dev-chain advisories).
    // UNFIXABLE-WITHIN-RANGE MEASURED: `npm update --legacy-peer-deps` on a
    // probe clone at b029b694 reproduced this exact residual (the override
    // cannot move within ^13.0.6; 14.0.2+ lives above it); patched 14.0.4
    // EXISTS on the registry — this entry is a range-coupling allow, not a
    // no-patch allow, and the removal plan is a bump ritual.
    // DEV-CHAIN-ONLY EXPOSURE: test/glob tooling; the advisory's trigger is a
    // cancelled glob run on the developer/CI filesystem — the shapes globbed
    // here are repo-authored test patterns, no attacker input surface.
    // REMOVAL PLAN: deliberately test-bump the override to ^14.0.3+ with the
    // FULL jest battery + the v8-provider comment law in its own commit
    // (the CJS-require era is exactly what justified the 13.x pin — never
    // move it silently); when green, drop this entry + its fixture + the
    // census row together.
    // RE-VERIFY BY: 2027-02-04 (the bump ritual above).
    'GHSA-3g3m-2fjr-6pw4',
    {
      package: 'glob',
      justification:
        'dev-chain only (hoisted glob@13.0.7, every glob node dev=true; test/glob tooling, ships nothing in the app bundle); held on this repo\'s own override "glob": "^13.0.6" (jest.config.js documents the coupled v8-provider/require-shape reason) — patched 14.0.2+ exists but crossing that major untested is NOT an in-range clear (npm update MEASURED to reproduce this residual); npm fixAvailable is a react-native@0.88.1 major (rejected lineage); removal = dedicated override-bump commit with the full battery green',
    },
  ],
  [
    // MEASURED 2026-11-08 (w12 L10, review w07L4 DD #3 / MW-100):
    // GHSA-g3hv-75wg-m249 — minimatch '>=7.0.0 <11.0.1' (MODERATE, CWE-405):
    // resource-consumption DoS via crafted brace-heavy patterns amplified
    // across repeated expansion (minimatch 9/10 lack the optimisation added
    // in 11.0.1). FLAGGED COPY: hoisted minimatch@10.2.6, dev=true — the
    // LEGACY 3.1.x line is NOT in the advisory range, so the flagged copies
    // are precisely the 10.x+ materialisations (declared parents:
    // @typescript-eslint/typescript-estree "^10.2.2" and glob@13 "^10.2.2").
    // UNFIXABLE-WITHIN-RANGE MEASURED: patched 11.0.1 sits ABOVE every
    // declaring parent's range; npm update reproduced this exact residual.
    // Coupling law: patched glob@14.0.4 itself declares minimatch ^11 — so
    // the 3g3m bump above clears glob's copy of the advisory set, but
    // typescript-estree's ^10.2.2 declaration would still materialise a
    // nested flagged 10.x until ITS range admits >=11.0.1; both parents must
    // move. npm's fixAvailable is again a react-native@0.88.1 major (rejected
    // lineage).
    // DEV-CHAIN-ONLY EXPOSURE: lint/typecheck/test tooling matching
    // repo-authored patterns; no production surface, no attacker input.
    // REMOVAL PLAN: when BOTH declaring parents admit minimatch >=11.0.1
    // (typescript-estree range bump — follow @typescript-eslint releases —
    // and the glob override bump above lands), re-run the gate; it reports
    // CLEARED; drop this entry IN THAT COMMIT together with its fixture and
    // the census row — the 3g3m bump alone is NOT sufficient while
    // typescript-estree caps below 11.
    // RE-VERIFY BY: 2027-02-04 (the parent-range probe above).
    'GHSA-g3hv-75wg-m249',
    {
      package: 'minimatch',
      justification:
        'dev-chain only (hoisted minimatch@10.2.6, dev=true; lint/typecheck tooling matches repo-authored patterns — the 3.1.x legacy copies are outside the advisory range); patched 11.0.1 above EVERY declaring parent (@typescript-eslint/typescript-estree ^10.2.2 + glob@13 ^10.2.2); in-range clear MEASURED impossible (npm update reproduces the residual); fixAvailable is a react-native@0.88.1 major (rejected lineage); removal requires BOTH parents to admit >=11.0.1 — same-advisory family the windows gate adjudicated 2026-11-06',
    },
  ],
  [
    // MEASURED 2026-11-08 (w12 L10, review w07L4 DD #3 / MW-100):
    // GHSA-gcqx-w48m-w2h4 — deepmerge '>=4.2.0 <=4.3.1' (LOW, CWE-1321):
    // prototype poisoning via crafted merge input. FLAGGED COPY: hoisted
    // deepmerge@4.3.1, dev=true (declaring parents: @react-native-community
    // cli/-config/-doctor "^4.3.0" + jest-config "^4.2.2").
    // TRUE NO-PATCH ADVISORY (the hp3w-class precedent): 4.3.1 is the LAST
    // version deepmerge has EVER published (registry version list ends
    // ...4.3.0, 4.3.1 — upstream dormant since 2023); the advisory names no
    // patched version; npm fixAvailable is a @react-native-community/cli
    // 11.4.1 DOWNGRADE-major (rejected lineage — no dev-chain major swaps
    // for a LOW advisory, per this same estate analysis).
    // DEV-CHAIN-ONLY EXPOSURE: config-merge paths (jest config, RN CLI
    // config merge); merged objects are repo-authored config files with no
    // attacker input surface; dev=true — nothing ships in the app bundle.
    // REMOVAL PLAN: none is possible while upstream ships nothing newer —
    // re-verify whether deepmerge (or its fork) publishes 4.3.2+; when it
    // does, the gate reports CLEARED and the entry + fixture + census row
    // drop together in that commit.
    // RE-VERIFY BY: 2027-02-04 (registry probe ritual above).
    'GHSA-gcqx-w48m-w2h4',
    {
      package: 'deepmerge',
      justification:
        'LOW; dev-chain only (hoisted deepmerge@4.3.1, dev=true; jest/RN-CLI config merging of repo-authored config, no attacker input, ships nothing in the app bundle); 4.3.1 is the LAST version published EVER — true no-patch advisory, upstream dormant; fixAvailable = @react-native-community/cli 11.4.1 downgrade-major (rejected lineage); removal only when upstream publishes a patched release',
    },
  ],
]);

const AUDIT_ARGS = ['audit', '--json', '--audit-level=high'];
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * @param {unknown} value
 * @returns {string|null} the GHSA id embedded in an advisory URL, else null.
 */
function ghsaFromUrl(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/\/(GHSA-[0-9a-z]+(-[0-9a-z]+){2,3})$/i);
  return m ? m[1] : null;
}

/**
 * @param {unknown} viaEntry one element of a vulnerability's `via` array.
 * @returns {string} the advisory id it carries — or THROWS rather than
 *   inventing a stand-in for a shape the gate cannot identify: an unnamed
 *   advisory can never be matched against the allowlist, and letting it pass
 *   silently is precisely the green-on-broken failure this gate exists to
 *   prevent. The throw is converted to exit 2 by runAudit.
 */
function advisoryIdOf(viaEntry) {
  if (viaEntry && typeof viaEntry === 'object' && !Array.isArray(viaEntry)) {
    const fromUrl = ghsaFromUrl(viaEntry.url);
    if (fromUrl) return fromUrl;
    const direct = viaEntry.github_advisory_id;
    if (typeof direct === 'string' && direct.startsWith('GHSA-')) return direct;
  }
  throw new AuditGateError(
    `unidentifiable advisory entry in npm audit report (${JSON.stringify(viaEntry).slice(0, 120)}) — a via entry with neither a parseable GHSA url nor a github_advisory_id cannot be matched against the allowlist, and passing it silently would defeat the gate`,
  );
}

class AuditGateError extends Error {}

/**
 * Extract every advisory id from a parsed npm audit report — v3 schema
 * (`vulnerabilities` map whose `via` arrays carry advisory objects), the
 * older `advisories` map, or AuditGateError on an unknown shape (fail LOUD,
 * never default to allow).
 * @param {any} report
 * @returns {Set<string>}
 */
export function collectAdvisoryIds(report) {
  const ids = new Set();
  if (report && typeof report === 'object' && report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const vuln of Object.values(report.vulnerabilities)) {
      const via = Array.isArray(vuln?.via) ? vuln.via : [];
      for (const entry of via) {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          if (entry.source !== undefined || entry.url !== undefined || entry.github_advisory_id !== undefined) {
            ids.add(advisoryIdOf(entry));
          }
        }
      }
    }
    return ids;
  }
  if (report && typeof report === 'object' && report.advisories && typeof report.advisories === 'object') {
    for (const adv of Object.values(report.advisories)) {
      const fromUrl = ghsaFromUrl(adv?.url);
      if (fromUrl) {
        ids.add(fromUrl);
      } else if (typeof adv?.github_advisory_id === 'string') {
        ids.add(adv.github_advisory_id);
      }
    }
    return ids;
  }
  throw new AuditGateError('unrecognised npm audit report shape (neither `vulnerabilities` nor `advisories`) — refusing to guess');
}

/**
 * The gate decision — PURE, no I/O, so the behavior tests drive it with
 * crafted fixtures instead of planted advisories.
 * @param {{exitCode: number|null, stdout: string, spawnError: unknown, allowList: {has: (id: string) => boolean}}} input
 * @returns {{code: number, clean: boolean, allowed: string[], unknown: string[], problems: string[]}}
 *   `code` — the process exit code for this verdict;
 *   `clean` — whether npm reported ZERO advisories;
 *   `allowed` — allowed ids the report flagged (printed for an honest log);
 *   `unknown` — ids NOT on the allowlist (these are what redden CI);
 *   `problems` — structural failures (broken audit, unparseable output).
 */
export function decide({ exitCode, stdout, spawnError, allowList }) {
  const problems = [];
  if (spawnError) {
    return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: [`npm audit could not be run: ${spawnError.message ?? spawnError}`] };
  }
  if (exitCode === null || exitCode === undefined) {
    return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: ['npm audit produced no exit code'] };
  }
  // Exit >= 2 means npm audit itself failed (bad config, registry unreachable
  // after retries, internal error) — never let that read as "clean".
  if (exitCode >= 2) {
    return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: [`npm audit exited ${exitCode} (structural failure — not a policy verdict)`] };
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (e) {
    return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: [`npm audit --json output is not parseable JSON: ${e.message}`] };
  }

  let ids;
  try {
    ids = collectAdvisoryIds(report);
  } catch (e) {
    return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: [e.message] };
  }

  // A NONZERO-but-not-structural exit (npm audit found advisories yet reports
  // zero advisory entries in the JSON) is a structural failure of the report,
  // not a clean result — the only way to reach "clean" is exit 0 WITH zero
  // advisories.
  if (ids.size === 0) {
    if (exitCode !== 0) {
      return { code: EXIT_STRUCTURE_ERROR, clean: false, allowed: [], unknown: [], problems: [`npm audit exited ${exitCode} but the report carries ZERO advisories — refusing to read a broken report as clean`] };
    }
    return { code: EXIT_OK, clean: true, allowed: [], unknown: [], problems: [] };
  }

  const allowed = [];
  const unknown = [];
  for (const id of ids) {
    if (allowList.has(id)) allowed.push(id);
    else unknown.push(id);
  }
  if (unknown.length > 0) {
    return { code: EXIT_VIOLATION, clean: false, allowed: allowed.sort(), unknown: unknown.sort(), problems: [] };
  }
  return { code: EXIT_OK, clean: false, allowed: allowed.sort(), unknown: [], problems: [] };
}

/**
 * Run `npm audit` (or read the report fixture named by
 * PHLIX_AUDIT_GATE_INPUT — a TESTABILITY SEAM for the jest venue: jest
 * cannot import this .mjs through the babel/CJS transform chain, so the
 * behavior pins spawn `node scripts/audit-gate.mjs` with the env var and
 * assert exit codes against committed fixtures. In seam mode the npm exit
 * code is DERIVED from the report (advisories present -> 1, none -> 0)
 * because the fixture has no process behind it; the real spawn path below
 * keeps the full exit taxonomy). Never returns a green verdict on a broken
 * audit — that is decide()'s contract.
 * @returns {{exitCode: number|null, stdout: string, spawnError: unknown}}
 */
export function runAudit() {
  const seam = process.env.PHLIX_AUDIT_GATE_INPUT;
  if (seam) {
    try {
      const stdout = readFileSync(seam, 'utf8');
      let advisories = 0;
      try {
        advisories = collectAdvisoryIds(JSON.parse(stdout)).size;
      } catch {
        return { exitCode: 1, stdout, spawnError: null }; // let decide() parse-fail loudly
      }
      return { exitCode: advisories > 0 ? 1 : 0, stdout, spawnError: null };
    } catch (e) {
      return { exitCode: null, stdout: '', spawnError: e };
    }
  }
  const isWin = process.platform === 'win32';
  const result = spawnSync(isWin ? 'npm.cmd' : 'npm', AUDIT_ARGS, {
    encoding: 'utf8',
    shell: isWin,
    maxBuffer: MAX_BUFFER,
  });
  if (result.error) {
    return { exitCode: null, stdout: result.stdout ?? '', spawnError: result.error };
  }
  return { exitCode: result.status, stdout: result.stdout ?? '', spawnError: null };
}

/** Print per-path dependency chains for the offending ids (stderr, violations only). */
function describeChains(report, ids) {
  const lines = [];
  for (const id of ids) {
    const paths = [];
    const vulns = report?.vulnerabilities ?? {};
    for (const [pkg, vuln] of Object.entries(vulns)) {
      const via = Array.isArray(vuln?.via) ? vuln.via : [];
      if (via.some((entry) => { try { return advisoryIdOf(entry) === id; } catch { return false; } })) {
        paths.push(pkg);
      }
    }
    lines.push(`  ${id} -> ${paths.length ? paths.join(', ') : '(package not resolvable from report)'}`);
  }
  return lines.join('\n');
}

/**
 * The gate body. Returns the process exit code.
 * @param {{has: (id: string) => boolean}} allowList
 * @param {(line?: string) => void} log
 * @param {(line?: string) => void} error
 */
export function main({ allowList = ALLOWED_ADVISORIES, log = console.log, error = console.error } = {}) {
  const { exitCode, stdout, spawnError } = runAudit();
  const verdict = decide({ exitCode, stdout, spawnError, allowList });

  if (verdict.problems.length > 0) {
    for (const p of verdict.problems) error(`AUDIT-GATE STRUCTURAL ERROR: ${p}`);
    error('AUDIT-GATE: cannot render a policy verdict on a broken audit — failing (exit 2, distinct from a policy violation).');
    return verdict.code;
  }

  if (verdict.clean) {
    log('AUDIT-GATE: npm audit reports no advisories — PASS (allowlist untouched).');
    return verdict.code;
  }

  for (const id of verdict.allowed) {
    const entry = allowList.get ? allowList.get(id) : undefined;
    log(`AUDIT-GATE: allowed advisory ${id}${entry ? ` (package: ${entry.package}) — ${entry.justification}` : ''}`);
  }
  log(`AUDIT-GATE: ${verdict.allowed.length} advisory(ies) found, all explicitly allowed (allowed advisories printed above with their review records).`);

  if (verdict.unknown.length > 0) {
    error(`AUDIT-GATE: ${verdict.unknown.length} advisory id(s) NOT on the reviewed allowlist: ${verdict.unknown.join(', ')}`);
    try {
      error(describeChains(JSON.parse(stdout), verdict.unknown));
    } catch {
      /* the parse already succeeded in decide(); no-op keeps the gate honest */
    }
    error('AUDIT-GATE: clear it via an in-range bump (the fix may live beyond the declared parent range — package.json stays untouched), or an owner-adjudicated ALLOWED_ADVISORIES entry with review record + re-verify duty + removal plan + the matching fixture, per the header law. Failing (exit 1).');
    return verdict.code;
  }

  return verdict.code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
