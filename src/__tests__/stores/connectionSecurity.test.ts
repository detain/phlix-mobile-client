/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/stores/connectionSecurity.test.ts
//
// M-MOBILE-51 (review mobile__secnet m3): cleartext lanes were reachable and
// silent. The store is the single predicate + per-lane ledger; the seams
// REPORT and one banner listens. These tests pin the predicate, the write
// gating (interceptors mark per request — no-verify-change must not notify),
// the selector, the logout reset, and — fs pins per repo doctrine — that all
// three dial seams and the banner mount actually exist.

import * as fs from 'fs';
import * as path from 'path';

import {
  useConnectionSecurityStore,
  selectAnyCleartext,
  isCleartextUrl,
} from '../../stores/useConnectionSecurityStore';

beforeEach(() => {
  useConnectionSecurityStore.setState({ cleartext: {} });
});

describe('isCleartextUrl — the ONE predicate', () => {
  test.each([
    ['http://192.168.1.100:8096', true],
    ['ws://192.168.1.100:8097/api/v1/syncplay/ws', true],
    ['https://phlix.example.com', false],
    ['wss://hub.example.com:8804/syncplay/s1', false],
  ])('%s → %s', (url, expected) => {
    expect(isCleartextUrl(url)).toBe(expected);
  });
});

describe('mark / selector ledger', () => {
  test('absent lanes are NOT insecure (never resolved = nothing to warn about)', () => {
    expect(selectAnyCleartext(useConnectionSecurityStore.getState())).toBe(
      false
    );
  });

  test('a cleartext lane raises the verdict; a secure sibling does not lower it', () => {
    const { mark } = useConnectionSecurityStore.getState();
    mark('rest', 'https://phlix.example.com');
    expect(selectAnyCleartext(useConnectionSecurityStore.getState())).toBe(false);
    mark('syncplayWs', 'ws://100.64.0.5:8097/api/v1/syncplay/ws');
    expect(selectAnyCleartext(useConnectionSecurityStore.getState())).toBe(true);
    mark('hubRelay', 'wss://hub.example.com:8804/syncplay/s1');
    expect(selectAnyCleartext(useConnectionSecurityStore.getState())).toBe(true);
  });

  test('a lane going secure clears ITS OWN verdict only', () => {
    const { mark } = useConnectionSecurityStore.getState();
    mark('rest', 'http://lan-box:8096');
    mark('hubRelay', 'http://hub.lan');
    mark('rest', 'https://phlix.example.com');
    const state = useConnectionSecurityStore.getState();
    expect(state.cleartext.rest).toBe(false);
    expect(state.cleartext.hubRelay).toBe(true);
    expect(selectAnyCleartext(state)).toBe(true);
  });

  test('write gating: re-marking the same verdict does not notify (per-request seam)', () => {
    const listener = jest.fn();
    const unsubscribe = useConnectionSecurityStore.subscribe(listener);
    const { mark } = useConnectionSecurityStore.getState();
    mark('rest', 'http://lan-box:8096');
    const notificationsAfterFirst = listener.mock.calls.length;
    mark('rest', 'http://other-lan-box:8097');
    mark('rest', 'http://lan-box:8096');
    expect(listener.mock.calls.length).toBe(notificationsAfterFirst);
    unsubscribe();
  });

  test('resetLanes drops every verdict (logout: fresh session resolves fresh truth)', () => {
    useConnectionSecurityStore.getState().mark('rest', 'http://lan-box:8096');
    useConnectionSecurityStore.getState().resetLanes();
    const state = useConnectionSecurityStore.getState();
    expect(state.cleartext).toEqual({});
    expect(selectAnyCleartext(state)).toBe(false);
  });
});

describe('dial seams + mount (fs pins — removing any reddens this law)', () => {
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

  test('REST lane reports from the server-root resolver', () => {
    expect(read('src/api/client.ts')).toMatch(
      /useConnectionSecurityStore\.getState\(\)\.mark\('rest', root\)/
    );
  });

  test('SyncPlay WS lane reports on BOTH dial branches (direct + relay)', () => {
    const seam = read('src/syncplay/wsEndpoint.ts');
    expect(seam.match(/mark\('syncplayWs'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('hub relay lane reports before the socket is constructed', () => {
    expect(read('src/syncplay/hubRelay.ts')).toMatch(
      /mark\('hubRelay', url\)/
    );
  });

  test('logout resets the ledger', () => {
    expect(read('src/stores/useAuthStore.ts')).toMatch(
      /useConnectionSecurityStore\.getState\(\)\.resetLanes\(\)/
    );
  });

  test('the banner is mounted at the root and nulls out while secure', () => {
    const nav = read('src/navigation/RootNavigator.tsx');
    expect(nav).toMatch(/<InsecureConnectionBanner \/>/);
    expect(read('src/components/ui/InsecureConnectionBanner.tsx')).toMatch(
      /if \(!anyCleartext\) \{\s*return null;/
    );
  });
});
