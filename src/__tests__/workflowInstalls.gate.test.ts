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
