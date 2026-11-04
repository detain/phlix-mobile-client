/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/androidPlayerLifecycle.gate.test.ts
//
// Review Minor 1 (2026-11-03 adversarial review of fdc82f4..201a39d), pinned
// repo-style (source-shape gate, like the S407 bridge pins): the native
// player's LifecycleEventListener holds a reference to the view, so the
// file's own law (onDetachedFromWindow comment: "remove it or the
// ReactContext outlives every discarded player") demands removal on EVERY
// terminal path. The convicted hole: a view dropped WITHOUT ever attaching
// (screen closed mid-mount — RN order is detach-then-drop, this is the
// narrow path around it) skipped onDetachedFromWindow, leaking the whole
// view — playerView, handler — for the app lifetime.
//
// Cure mirrored removeLifecycleEventListener(lifecycleListener) into
// onDropViewInstance too (RN removes by reference — safe no-op when detach
// already ran). This pin measures RED against the pre-cure source.

import { readFileSync } from 'fs';
import * as path from 'path';

const ANDROID_VIEW = path.join(
  __dirname,
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'phlixmobile',
  'player',
  'PhlixPlayerView.kt',
);

function read(): string {
  try {
    return readFileSync(ANDROID_VIEW, 'utf8');
  } catch {
    throw new Error(
      'android-player-lifecycle pin cannot be measured: PhlixPlayerView.kt is missing — FAIL LOUD.',
    );
  }
}

describe('PhlixPlayerView.kt — lifecycle listener removed on every terminal path (review Minor 1)', () => {
  const REMOVAL = /removeLifecycleEventListener\(lifecycleListener\)/;

  it('onDropViewInstance removes the listener (the drop-without-detach leak is closed)', () => {
    const src = read();
    const start = src.indexOf('fun onDropViewInstance()');
    expect(start).toBeGreaterThan(-1); // the hook must exist at all (manager wires it)
    // Anchor on the DECLARATION, not the bare name: the cure's own docblock
    // mentions onDetachedFromWindow, and a comment must never be able to
    // truncate this window.
    const dropBody = src.slice(start, src.indexOf('override fun onDetachedFromWindow', start));
    expect(dropBody).toMatch(REMOVAL);
  });

  it('onDetachedFromWindow STILL removes it (the original law is untouched, not moved)', () => {
    const src = read();
    const detach = src.slice(src.indexOf('override fun onDetachedFromWindow()'));
    expect(detach).toMatch(REMOVAL);
  });

  it('the listener is added exactly once (attach side) — the removals are symmetric bookkeeping', () => {
    const src = read();
    const adds = (src.match(/addLifecycleEventListener\(lifecycleListener\)/g) ?? []).length;
    const removes = (src.match(new RegExp(REMOVAL.source, 'g')) ?? []).length;
    expect(adds).toBe(1);
    expect(removes).toBe(2); // detach + drop — a third would mean an unbalanced new path
  });
});
