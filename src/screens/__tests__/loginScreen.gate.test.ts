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
