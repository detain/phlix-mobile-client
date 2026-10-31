/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/homeFailurePolicy.test.ts
//
// M-MOBILE-02 (review mobile__casualgamer #2, majors): the pure blackout
// decision behind Home's connection-error state. No renderer — the screen
// mounts `ErrorView` when this says blackout (pair law: the source pins at
// the bottom must keep matching the screen's wiring).

import fs from 'fs';
import path from 'path';

import {
  homeServerBlackout,
  HOME_SERVER_BLACKOUT_MESSAGE,
} from '../homeFailurePolicy';

const homeScreen = fs.readFileSync(
  path.resolve(__dirname, '../HomeScreen.tsx'),
  'utf8'
);

describe('homeServerBlackout (M-MOBILE-02)', () => {
  it('blackout when every rail a signed-in home attempted failed', () => {
    expect(
      homeServerBlackout(
        { recentlyAdded: true, continueWatching: true, libraries: true },
        true
      )
    ).toBe(true);
  });

  it('signed-out home counts only the two rails it actually asks for', () => {
    // Guest path: continue-watching is never fetched, so its (impossible)
    // failure flag must not tilt the decision — in either direction.
    expect(
      homeServerBlackout(
        { recentlyAdded: true, continueWatching: false, libraries: true },
        false
      )
    ).toBe(true);
    expect(
      homeServerBlackout(
        { recentlyAdded: true, continueWatching: true, libraries: false },
        false
      )
    ).toBe(false);
  });

  it('partial failure stays graceful: one surviving rail is not a blackout', () => {
    expect(
      homeServerBlackout(
        { recentlyAdded: false, continueWatching: true, libraries: true },
        true
      )
    ).toBe(false);
    expect(
      homeServerBlackout(
        { recentlyAdded: true, continueWatching: false, libraries: true },
        true
      )
    ).toBe(false);
    expect(
      homeServerBlackout(
        { recentlyAdded: false, continueWatching: false, libraries: false },
        true
      )
    ).toBe(false);
  });

  it('the blackout copy is app-owned and names the recovery path', () => {
    expect(HOME_SERVER_BLACKOUT_MESSAGE).toContain("Can't reach your Phlix server");
    // The Settings server card is display-only; the honest recovery is the
    // sign-out → sign-in-with-new-address flow (M-10 teardown made it clean).
    expect(HOME_SERVER_BLACKOUT_MESSAGE).toContain('sign out');
  });

  it('pair law: HomeScreen routes rail failures through the policy and keeps no bare swallows', () => {
    expect(homeScreen).toContain('homeServerBlackout(');
    expect(homeScreen).toContain('HOME_SERVER_BLACKOUT_MESSAGE');
    // The defect shape itself: silently-empty rails are gone from the file.
    expect(homeScreen).not.toContain('.catch(() => [])');
  });
});
