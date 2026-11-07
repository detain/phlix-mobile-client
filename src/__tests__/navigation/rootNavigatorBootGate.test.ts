/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/navigation/rootNavigatorBootGate.test.ts
//
// MW-033 (review mobile__gameux #9) — source-read pin on the w04L4StructuralPins
// precedent: this repo carries no React renderer in its test deps, and the
// law here is the SHAPE of the cold-boot gate's render, so it is pinned
// against the real source. The auth-hydrate gate used to print a bare
// 'Loading…' Text while every other loading surface in the app speaks
// through LoadingSpinner / ContentSkeleton. The pin locks the gate to the
// shared component and retires the hand-rolled text — with the dead
// style family that came with it.

import fs from 'fs';
import path from 'path';

const read = (...parts: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');

describe('MW-033 — cold-boot gate renders the shared LoadingSpinner', () => {
  const nav = read('navigation', 'RootNavigator.tsx');

  it('the isLoading gate mounts <LoadingSpinner fullScreen />', () => {
    expect(nav).toMatch(
      /if \(isLoading\) \{\s*return <LoadingSpinner fullScreen \/>;\s*\}/
    );
  });

  it('the bare Loading… string is retired from the boot gate', () => {
    expect(nav).not.toMatch(/Loading…/);
  });

  it('the old boot-gate style family is gone with it (no dead styles)', () => {
    expect(nav).not.toMatch(/loadingContainer|loadingText/);
  });
});
