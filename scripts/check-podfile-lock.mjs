#!/usr/bin/env node
/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// scripts/check-podfile-lock.mjs
//
// M-MOBILE-09 lock law, review Major 1 (2026-11-03 adversarial review of
// fdc82f4..201a39d): the committed ios/Podfile.lock must NAME every native
// pod the current dependency set auto-links. The convicted drift: the
// deferred-items range added @react-native-community/netinfo and
// @react-native-vector-icons/material-icons (both native iOS modules with
// root podspecs) and the committed Podfile.lock gained ZERO entries — while
// build-ios.yml runs a BARE `pod install` (non-deployment) that silently
// re-resolves missing pods from node_modules, so CI can never see the hole
// and every install floats the caret ranges the lock exists to pin.
//
// SOURCE OF TRUTH: `react-native config` — the exact command
// `use_native_modules!` shells out to inside the Podfile. Its per-dependency
// `platforms.ios.podspecPath` set IS the auto-linked graph (verified against
// the `pod install` banner: same 13 packages). We read each linked podspec's
// declared name and require it as a top-level PODS entry in the lock.
//
// The check is host-agnostic on purpose: node only — no CocoaPods, no
// Xcode, no macOS. It asserts ENTRY PRESENCE (the shape of the convicted
// drift), not version equality (re-resolution of transitive versions is the
// lock's business). A missing entry fails loud with the regeneration
// command printed verbatim:
//
//     cd ios && pod install      # macOS dev box with Xcode
//
// then commit the regenerated ios/Podfile.lock.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Parse the PODS: section of a Podfile.lock into a Set of top-level names. */
function parseLockPodNames(lockText, lockPath) {
  const lines = lockText.split('\n');
  const start = lines.indexOf('PODS:');
  if (start === -1) {
    console.error(`PODFILE LOCK UNPARSEABLE: no 'PODS:' section in ${lockPath}`);
    process.exit(1);
  }
  const names = new Set();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 0 && !line.startsWith(' ')) break; // next top-level section
    const match = /^ {2}- ([^ (]+)/.exec(line); // top-level entries only (deeper indent = nested deps)
    if (match) names.add(match[1]);
  }
  return names;
}

/** The auto-linked iOS pods, as the Podfile itself will see them. */
function linkedIosPods() {
  let json;
  try {
    json = execFileSync(
      process.execPath,
      [join(repoRoot, 'node_modules', 'react-native', 'cli.js'), 'config'],
      { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    console.error(`SETUP ERROR: 'react-native config' failed to run (${error.message}).`);
    console.error('This check consumes the same command `use_native_modules!` uses — fix the environment (npm ci --allow-git=all).');
    process.exit(1);
  }
  let config;
  try {
    config = JSON.parse(json);
  } catch {
    console.error('SETUP ERROR: react-native config emitted non-JSON (a banner polluted stdout?).');
    process.exit(1);
  }
  const pods = [];
  for (const [dep, entry] of Object.entries(config.dependencies ?? {})) {
    const ios = entry?.platforms?.ios;
    if (!ios?.podspecPath) continue; // JS-only package — nothing to auto-link on iOS
    const text = readFileSync(ios.podspecPath, 'utf8');
    const match =
      /(?:\bspec\.name\s*=\s*|[^a-zA-Z]s\.name\s*=\s*|Pod::Package\.new\(\s*)['"]([^'"]+)['"]/.exec(text);
    if (!match) {
      console.error(`UNPARSEABLE PODSPEC: ${relative(repoRoot, ios.podspecPath)} declares no .name — extend this script's grammar.`);
      process.exit(1); // fail loud: a silent skip re-opens the exact hole this gate closes
    }
    pods.push({ dep, pod: match[1] });
  }
  return pods;
}

const lockPath = join(repoRoot, 'ios', 'Podfile.lock');
const lockNames = parseLockPodNames(readFileSync(lockPath, 'utf8'), lockPath);
const linked = linkedIosPods();
const missing = linked.filter(({ pod }) => !lockNames.has(pod));

if (missing.length > 0) {
  console.error(
    `PODFILE.LOCK DRIFT: ${missing.length} native pod(s) auto-linked by the current ` +
      'dependency set are MISSING from ios/Podfile.lock PODS:',
  );
  for (const { dep, pod } of missing) {
    console.error(`  - ${pod}  (from ${dep})`);
  }
  console.error(
    '\nThe committed lock no longer pins the native graph: every bare `pod install` (build-ios.yml)\n' +
      'silently re-resolves these from caret ranges — the review Major 1 defect.\n' +
      'Cure on a macOS box with Xcode:\n    cd ios && pod install\n' +
      'then commit the regenerated ios/Podfile.lock and re-run: npm run check:podfile-lock',
  );
  process.exit(1);
}

console.log(
  `Podfile.lock is in sync: all ${linked.length} auto-linked native pod(s) ` +
    `(${linked.map(({ pod }) => pod).join(', ')}) are present in PODS.`,
);
