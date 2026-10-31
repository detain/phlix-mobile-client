/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/androidReleaseNotes.gate.test.ts
/**
 * fs-gate precedent: androidPermissions.gate.test.ts / iosInfoPlist.gate.test.ts.
 * Review mobile__devops MAJ-1 (MAJORS): the rolling `latest` prerelease is a
 * DEBUG-key-signed artifact (deliberate — an unsigned APK can't be
 * sideloaded), but the release notes promised it plain without saying so,
 * and the Gradle comment described release-signing machinery that does not
 * exist (no workflow triggers on tags; no keystore secret anywhere — both
 * greps zero). These pins keep the three docs that make the claim — the
 * publish body, the Gradle comment, the README Deployment section — TRUE in
 * the same breath: debug-signed, sideload-only, and runner keystores are
 * per-machine, so consecutive builds may need uninstall + reinstall.
 */
import fs from 'fs';
import path from 'path';

const workflow = fs.readFileSync(
  path.resolve(__dirname, '../../.github/workflows/build-android.yml'),
  'utf8'
);
const gradle = fs.readFileSync(
  path.resolve(__dirname, '../../android/app/build.gradle'),
  'utf8'
);
const readme = fs.readFileSync(
  path.resolve(__dirname, '../../README.md'),
  'utf8'
);

describe('Android release-chain truth pins (review mobile__devops MAJ-1)', () => {
  it('the published release notes disclose debug signing and the identity churn', () => {
    expect(workflow).toContain('debug-signed');
    expect(workflow).toContain('INSTALL_FAILED_UPDATE_INCOMPATIBLE');
    // The rolling-asset law itself: the body must still promise the RAW apk.
    expect(workflow).toContain('download + install');
  });

  it('the Gradle comment tells the truth about release signing', () => {
    // The fiction this lane removed: secret-fed tag builds do not exist.
    expect(gradle).not.toContain('via CI secrets on a version tag');
    expect(gradle).toContain('NO release-signing machinery');
    // NB: comment-wrapped phrases must be pinned within a single line — the
    // leading "no" of this clause sits on the previous comment line.
    expect(gradle).toContain('keystore secret is read anywhere');
  });

  it('README keeps its honest store story (regression guard)', () => {
    expect(readme).toContain('**debug-signed**');
    expect(readme).toContain('not for a store');
  });
});
