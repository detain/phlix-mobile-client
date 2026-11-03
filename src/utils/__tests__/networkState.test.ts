/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/networkState.test.ts
// M3 (deferred lane): the data-plan classifier is the single trusted parse
// point for BOTH gates (download hold, player notice) — its edges are law.
import NetInfo from '@react-native-community/netinfo';
import { isCellularConnection, isCellularNow, onNetworkChange } from '../networkState';

// The jest.setup.js stand-in exposes the control surface under double-underscore.
const netinfo = NetInfo as unknown as {
  __setNetwork: (patch: Record<string, unknown>) => void;
  __resetNetwork: () => void;
  fetch: jest.Mock;
  addEventListener: jest.Mock;
};

const state = (over: Record<string, unknown>) =>
  ({ isConnected: true, isInternetReachable: true, type: 'wifi', ...over }) as never;

beforeEach(() => {
  netinfo.__resetNetwork();
  jest.clearAllMocks();
});

describe('isCellularConnection (pure classifier)', () => {
  it('reads a plain Wi-Fi connection as non-cellular', () => {
    expect(isCellularConnection(state({ type: 'wifi' }))).toBe(false);
  });

  it('reads type cellular as cellular', () => {
    expect(isCellularConnection(state({ type: 'cellular' }))).toBe(true);
  });

  it('reads legacy generation strings (cell_4g) as cellular', () => {
    expect(isCellularConnection(state({ type: 'cell_4g' }))).toBe(true);
    expect(isCellularConnection(state({ type: 'cell_2g' }))).toBe(true);
  });

  it('disconnected is never cellular (nothing to meter)', () => {
    expect(isCellularConnection(state({ type: 'cellular', isConnected: false }))).toBe(false);
    expect(isCellularConnection(state({ type: 'none', isConnected: false }))).toBe(false);
  });

  it('null/undefined probes are NOT cellular — fail-open by law', () => {
    expect(isCellularConnection(null)).toBe(false);
    expect(isCellularConnection(undefined)).toBe(false);
  });

  it('ethernet/vpn/bluetooth/other/unknown are not cellular', () => {
    for (const type of ['ethernet', 'vpn', 'bluetooth', 'other', 'unknown']) {
      expect(isCellularConnection(state({ type }))).toBe(false);
    }
  });
});

describe('isCellularNow (one-shot probe)', () => {
  it('resolves the current reading', async () => {
    netinfo.__setNetwork({ type: 'cellular' });
    await expect(isCellularNow()).resolves.toBe(true);
  });

  it('a throwing probe reads NON-cellular (must never strand downloads)', async () => {
    netinfo.fetch.mockRejectedValueOnce(new Error('bridge exploded'));
    await expect(isCellularNow()).resolves.toBe(false);
  });
});

describe('onNetworkChange (subscription seam)', () => {
  it('delivers changes and stops after unsubscribe', () => {
    const seen: string[] = [];
    const unsub = onNetworkChange((s) => seen.push(String(s.type)));
    netinfo.__setNetwork({ type: 'cellular' });
    expect(seen).toEqual(['wifi', 'cellular']); // immediate current-state on subscribe
    unsub();
    netinfo.__setNetwork({ type: 'wifi' });
    expect(seen).toEqual(['wifi', 'cellular']); // no delivery after unsub
  });

  it('a throwing register degrades to a no-op unsubscriber', () => {
    const original = netinfo.addEventListener;
    netinfo.addEventListener = jest.fn(() => {
      throw new Error('native module missing');
    });
    const unsub = onNetworkChange(() => undefined);
    expect(() => unsub()).not.toThrow();
    netinfo.addEventListener = original;
  });
});
