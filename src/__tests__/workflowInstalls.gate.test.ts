/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/workflowInstalls.gate.test.ts
/**
 * fs-gate precedent: androidPermissions / iosInfoPlist / androidReleaseNotes.
 * Review mobile__devops MAJ-2 (MAJORS): package-lock.json is tracked
 * (lockfileVersion 3), yet every CI install leg ran `npm install` — which
 * re-resolves any unsatisfiable range and SILENTLY REWRITES the committed
 * lock mid-CI (this repo's CHANGELOG records 152 devOptional->dev marker
 * churn from exactly that, 2026-10-01). The cure is the tizen-proven form:
 * `npm ci --allow-git=all` on every leg. npm ci fails loud on lock drift —
 * it IS the drift gate; a separate `git diff --exit-code package-lock.json`
 * assertion would be redundant belt-on-brakes.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const WORKFLOWS = ['test.yml', 'build-android.yml', 'build-ios.yml'] as const;

const read = (file: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../../.github/workflows', file), 'utf8');

describe('CI installs honor the tracked lockfile (review mobile__devops MAJ-2)', () => {
  it('no leg runs the lock-mutating `npm install`', () => {
    for (const file of WORKFLOWS) {
      expect(read(file)).not.toContain('run: npm install');
    }
  });

  it('exactly five legs run the lock-verbatim `npm ci --allow-git=all`', () => {
    // 1 (test) + 2 (android debug/release) + 2 (ios debug/release). A NEW
    // workflow file must add its leg lawfully — update the expected count
    // deliberately when jobs are born, never silently.
    const legs = WORKFLOWS.reduce(
      (sum, file) => sum + (read(file).match(/run: npm ci --allow-git=all/g) ?? []).length,
      0
    );
    expect(legs).toBe(5);
  });

  it('the lock the legs honor is real and present', () => {
    const lock = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package-lock.json'), 'utf8')
    ) as { lockfileVersion?: number };
    expect(lock.lockfileVersion).toBe(3);
  });
});

/**
 * MW-100 (review w07L4 DD #3): the audit leg + gate + its allowlist, pinned.
 *
 * Two families:
 *  (a) WORKFLOW/SCRIPT SOURCE PINS — the leg must exist, must be named, must
 *      run the gate script, and must carry NO neutering (`|| true`,
 *      `continue-on-error`). A leg that exists but cannot fail is how audit
 *      gates die quietly. The GHSA-id census pins the exact reviewed set:
 *      adding OR removing an allowlist entry must rotate this test.
 *  (b) GATE BEHAVIOR — the gate runs against committed npm-audit report
 *      FIXTURES via the `PHLIX_AUDIT_GATE_INPUT` seam (testability hatch:
 *      jest cannot import .mjs through the babel/CJS chain, so the pins
 *      SPAWN `node scripts/audit-gate.mjs` and assert the process exit code;
 *      the seam substitutes the npm spawn and derives its exit from the
 *      report). clean -> 0; all-allowed -> 0; any unknown id -> 1;
 *      structurally broken report -> 2 — including the high-severity case,
 *      which is the whole point (the severity floor this replaced greened
 *      on exactly such reports).
 */
const GATE = path.resolve(__dirname, '../../scripts/audit-gate.mjs');
const FIXTURES = path.resolve(__dirname, 'fixtures/audit-gate');

/** Run the gate over one fixture; returns the process exit code. */
function gateExit(fixtureName: string): number {
  try {
    execFileSync('node', [GATE], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, PHLIX_AUDIT_GATE_INPUT: path.join(FIXTURES, fixtureName) },
      stdio: 'pipe',
    });
    return 0;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (typeof status !== 'number') {
      throw e; // a node crash is itself a structural failure the pin must surface
    }
    return status;
  }
}

describe('CI audit gate honors the reviewed-allowlist design (MW-100)', () => {
  it('test.yml runs the gate as its own named leg', () => {
    const yml = read('test.yml');
    expect(yml).toContain('- name: Security audit');
    expect(yml).toContain('run: npm run audit:gate');
  });

  it('the audit leg carries NO neutering (no || true, no continue-on-error)', () => {
    const yml = read('test.yml');
    const legStart = yml.indexOf('- name: Security audit');
    expect(legStart).toBeGreaterThan(-1);
    const legEnd = yml.indexOf('- name:', legStart + 5);
    const leg = yml.slice(legStart, legEnd === -1 ? yml.length : legEnd);
    expect(leg).not.toMatch(/\|\|\s*true/);
    expect(leg).not.toMatch(/continue-on-error/);
    expect(leg).toMatch(/run: npm run audit:gate/);
  });

  it('package.json wires audit:gate to the committed gate script', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['audit:gate']).toBe('node scripts/audit-gate.mjs');
    expect(fs.existsSync(GATE)).toBe(true);
  });

  it('the allowlist carries EXACTLY the reviewed advisory set (rotate deliberately)', () => {
    // Measured residuals after the in-range clears landed (w12 L10, 2026-11-08):
    // the 6 highs + every other moderate cleared in-range; these three sit
    // beyond their declaring parents' ranges (glob/minimatch coupling +
    // deepmerge no-patch). The ids' justifications/removal plans live in the
    // gate header records — a silent add or silent drop both redden this pin.
    const gate = fs.readFileSync(GATE, 'utf8');
    const ids = Array.from(new Set(gate.match(/GHSA-[0-9a-z]+(-[0-9a-z]+){2,3}/g) ?? [])).sort();
    expect(ids).toEqual([
      'GHSA-3g3m-2fjr-6pw4', // glob  (moderate, dev-chain, override-coupled)
      'GHSA-g3hv-75wg-m249', // minimatch (moderate, dev-chain, parent-capped)
      'GHSA-gcqx-w48m-w2h4', // deepmerge (low, dev-chain, no-patch-ever)
    ]);
  });

  it('the gate itself refuses to run without the seam in CI (npm audit is real there)', () => {
    // Sanity on the seam's existence AND its non-hardness: the script must
    // read PHLIX_AUDIT_GATE_INPUT, defaulting to the live npm spawn.
    const gate = fs.readFileSync(GATE, 'utf8');
    expect(gate).toContain('PHLIX_AUDIT_GATE_INPUT');
    expect(gate).toContain("'audit', '--json'");
  });

  // ---- behavior: exit taxonomy against fixtures ------------------------
  it('clean report -> 0', () => {
    expect(gateExit('clean.json')).toBe(0);
  });

  it('report carrying exactly the allowlist -> 0', () => {
    expect(gateExit('allowed-mirror.json')).toBe(0);
  });

  it('subset of the allowlist -> 0 (subset law, not equality law)', () => {
    expect(gateExit('allowed-subset.json')).toBe(0);
  });

  it('one unknown id -> 1 (fail loud regardless of severity)', () => {
    expect(gateExit('unknown-id.json')).toBe(1);
  });

  it('a HIGH unknown id -> 1 — the severity floor this gate replaced would have passed it at 0', () => {
    expect(gateExit('high-unknown.json')).toBe(1);
  });

  it('structurally broken report -> 2, distinct from a policy violation', () => {
    expect(gateExit('broken-shape.json')).toBe(2);
    expect(gateExit('unparseable.json')).toBe(2);
  });

  it('missing fixture -> 2 (a seam that cannot read is a broken audit, not a clean one)', () => {
    expect(gateExit('does-not-exist.json')).toBe(2);
  });
});
