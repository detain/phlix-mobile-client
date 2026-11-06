/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/loginScreen.gate.test.ts
//
// M-MOBILE-02 (review mobile__casualgamer #2, majors), fs-gate precedent:
// androidPermissions.gate.test.ts. The scheme-less → https default is
// DELIBERATE law (audit M6: a missed prefix must never silently downgrade a
// remote connection to cleartext; mirrors the hub's normalizeHubUrl). The
// finding's complaint is that the law was SILENT — the field's own
// placeholder advertised `http://…` while typing a bare address dialed
// https, so the most natural LAN input aimed at a failing handshake. The
// cure is copy, not law: the screen must SAY what a prefix-less address
// does — and the law line itself must stay.

import fs from 'fs';
import path from 'path';

const loginScreen = fs.readFileSync(
  path.resolve(__dirname, '../LoginScreen.tsx'),
  'utf8'
);

describe('LoginScreen server-address honesty (M-MOBILE-02)', () => {
  it('states the prefix-less → https behavior where the user types it', () => {
    expect(loginScreen).toContain('No prefix connects over https');
  });

  it('keeps the audit-M6 https-default law untouched', () => {
    expect(loginScreen).toContain('return `https://${url}`;');
  });
});

// MW-024 (review mobile__casualgamer #3): a brand-new viewer had nothing to
// type — the field seeds empty (useSettingsStore default), and both submit
// handlers refused a blank Server URL outright while the README promises the
// app "defaults to https://api.phlix.app" (client.ts tier 3). The server field
// is now OPTIONAL: blank means "no override — dial the app's built-in default"
// (and clears any previously saved address, so the field is WYSIWYG), and the
// label states plainly where a real address comes from. The audit-M6 law for
// TYPED input is untouched (pinned above).
describe('LoginScreen server field is optional with honest guidance (MW-024)', () => {
  it('no handler refuses a blank Server URL at the gate any more', () => {
    expect(loginScreen).not.toMatch(/!serverUrl\.trim\(\)/);
  });

  it('username and password remain required for every submit arm', () => {
    // Sign-in + signup gates both check the two identity fields.
    const gates = loginScreen.match(/!username\.trim\(\)[\s\S]{0,40}!password\.trim\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  it('a blank field clears the saved override (the field is what connects)', () => {
    expect(loginScreen).toMatch(/setServerUrl\(''\)/);
  });

  it('says where the address comes from and what blank means', () => {
    expect(loginScreen).toMatch(/your own\s+Phlix server/);
    expect(loginScreen).toMatch(/Leave the\s+field blank/);
  });
});
