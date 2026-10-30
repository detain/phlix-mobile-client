/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/versionSync.test.ts
//
// Version-stamping sync gate (reviews M-MOBILE-15 / M-MOBILE-25). The three
// version stores (package.json, android/app/build.gradle, ios/…/project.pbxproj)
// historically drifted (`1.0.0` / `1.0.0` / `1.0`, plus a frozen
// `versionCode 1` that made every rolling-`latest` re-publish indistinguishable
// for upgraders). The cure is a single source plus fail-loud enforcement:
//
//   * package.json "version" is THE source of truth — `npm version` bumps it.
//   * build.gradle DERIVES versionCode/versionName from that file at configure
//     time, so it cannot drift by construction.
//   * The pbxproj is literal (Xcode cannot read package.json), so THIS test is
//     what keeps it honest: it re-derives both expected values from
//     package.json and pins the four pbxproj settings lines.
//
// fs reads in a jest gate test follow the `src/api/test/routeManifest.gate.test.ts`
// precedent.

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const read = (rel: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/** package.json "version" — the single source of truth. */
const pkgVersion: string = JSON.parse(read('package.json')).version;

/**
 * SemVer → monotonic int: major*1_000_000 + minor*1_000 + patch. Prerelease
 * suffixes are ignored for the build code (the marketing version keeps them).
 * Mirrors the Groovy derivation in android/app/build.gradle.
 */
const deriveVersionCode = (version: string): number => {
  const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
};

describe('version stamping is single-sourced and in sync (M-MOBILE-15/25)', () => {
  it('package.json carries a plain X.Y.Z (optionally -prerelease) version', () => {
    expect(pkgVersion).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it('build.gradle derives versionCode/versionName from package.json instead of hardcoding', () => {
    const gradle = read('android/app/build.gradle');
    // The derivation exists…
    expect(gradle).toContain('new JsonSlurper().parse(new File(rootProject.projectDir.parentFile,');
    expect(gradle).toContain("'package.json')");
    // Regression pin: the wrong-depth spelling dies at Gradle evaluation
    // (android/package.json does not exist) — never let it back in.
    expect(gradle).not.toContain("new File(projectDir, '../package.json')");
    expect(gradle).toMatch(/versionCode\s+phlixVersionCode/);
    expect(gradle).toMatch(/versionName\s+phlixPackageJson\.version\.toString\(\)/);
    // …and the old frozen literals are gone from defaultConfig.
    expect(gradle).not.toMatch(/versionCode\s+1\s*$/m);
    expect(gradle).not.toMatch(/versionName\s+"1\.0\.0"/);
  });

  it('the gradle derivation and this test agree on one number (formula pinned)', () => {
    // The Groovy side is `tokens * 1000000/1000/1` — pin the JS mirror against
    // a literal so a one-sided formula edit reddens here, not in Play Store.
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('* 1000000');
    expect(gradle).toContain('* 1000');
    expect(deriveVersionCode('1.0.0')).toBe(1_000_000);
    expect(deriveVersionCode('1.2.3')).toBe(1_002_003);
    expect(deriveVersionCode('2.0.0-beta.1')).toBe(2_000_000);
  });

  it('pbxproj MARKETING_VERSION equals package.json version in every configuration', () => {
    const pbx = read('ios/PhlixMobile.xcodeproj/project.pbxproj');
    const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
    expect(marketing.length).toBeGreaterThanOrEqual(2); // app + test targets
    for (const value of marketing) {
      expect(value).toBe(pkgVersion);
    }
  });

  it('pbxproj CURRENT_PROJECT_VERSION equals the derived versionCode in every configuration', () => {
    const pbx = read('ios/PhlixMobile.xcodeproj/project.pbxproj');
    const build = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]);
    expect(build.length).toBeGreaterThanOrEqual(2);
    for (const value of build) {
      expect(value).toBe(String(deriveVersionCode(pkgVersion)));
    }
  });
});
