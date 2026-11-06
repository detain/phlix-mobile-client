/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/mw025HubIdentity.test.ts
//
// MW-025 (review mobile__casualgamer #4) — source-level pins (house idiom:
// wmin61UiPins.test.ts): the hub signed-in row must show the friendly
// identity when the hub carries one, and a plain label when it does not —
// never the raw 36-char account UUID.

import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../../screens/SettingsScreen.tsx'),
  'utf8'
);

describe('SettingsScreen hub identity row (MW-025)', () => {
  it('never prints the raw account id any more', () => {
    expect(source).not.toMatch(/Signed in as \{session\.userId\}/);
  });

  it('prints the hub display name when the session carries one', () => {
    expect(source).toMatch(/session\.displayName/);
  });

  it('falls back to a friendly label, not the id, when the name is absent', () => {
    // Quoted literal only — the parent era carried the phrase in a JSX
    // comment, which is why a bare phrase-match is not the law.
    expect(source).toMatch(/['`]Signed in to Hub['`]/);
  });
});
