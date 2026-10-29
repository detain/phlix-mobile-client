/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/wsEndpoint.test.ts
/**
 * Endpoint-builder law (audit H1/M7, carrier flip phlix-server 424c14d0):
 *
 * - direct lane  → `ws(s)://{host}:8097/...` location + `['bearer', <JWT>]`
 *   subprotocol (dual-carrier TARGET carrier — NEVER a query token; estate
 *   policy WEBSOCKET_URL_QUERY_REFUSED; port overridable via
 *   PHLIX_SYNCPLAY_WS_PORT);
 * - relay lane   → `ws(s)://{hubHost}:8804/syncplay/{server_id}` with the
 *   `['bearer', <relayToken>]` subprotocol and NEVER a query token (S237);
 * - no lane without its credential — the builders refuse, they do not dial
 *   tokenless sockets that both listeners reject pre-101 anyway;
 * - the direct lane never presents the SERVER JWT to a host the hub merely
 *   suggested — it dials only the host the token was MINTED for (vault-pinned
 *   at every issuance), and a mismatch/unpinned vault throws a typed refusal
 *   the service surfaces to the viewer (review mobile__exploiter M2).
 */

import Config from 'react-native-config';
import {
  buildDirectSyncPlayWsUrl,
  resolveSyncPlayWsEndpoint,
  syncPlayWsPort,
  SYNCPLAY_WS_DEFAULT_PORT,
  SyncPlayHostPinError,
  __resetRelayTokenProvidersForTests,
  type SyncPlayWsSource,
} from '../../syncplay/wsEndpoint';
import { secureStorage } from '../../services/SecureStorage';
import { createHubRelayTokenProvider } from '../../hub/RelayTokenProvider';
import {
  SYNCPLAY_HOST_MISMATCH_CODE,
  SYNCPLAY_HOST_MISMATCH_MESSAGE,
  SYNCPLAY_HOST_UNPINNED_CODE,
  SYNCPLAY_HOST_UNPINNED_MESSAGE,
} from '../../syncplay/syncplayErrors';

jest.mock('../../services/SecureStorage', () => ({
  __esModule: true,
  default: { getAccessToken: jest.fn(), getIssuedHost: jest.fn() },
  secureStorage: { getAccessToken: jest.fn(), getIssuedHost: jest.fn() },
}));
jest.mock('../../hub/RelayTokenProvider', () => ({
  __esModule: true,
  createHubRelayTokenProvider: jest.fn(),
}));

const mockSecureStorage = secureStorage as jest.MockedObject<typeof secureStorage>;
const mockCreateProvider = createHubRelayTokenProvider as jest.Mock;

const directSource = (overrides: Partial<SyncPlayWsSource> = {}): SyncPlayWsSource => ({
  connectionMode: 'direct',
  effectiveServerUrl: 'https://192.168.1.100:32400',
  hubUrl: null,
  activeServerId: null,
  getHubAccessToken: () => null,
  ...overrides,
});

const relaySource = (overrides: Partial<SyncPlayWsSource> = {}): SyncPlayWsSource => ({
  connectionMode: 'relay',
  effectiveServerUrl: 'https://192.168.1.100:32400',
  hubUrl: 'https://hub.example.com',
  activeServerId: 'srv-9',
  getHubAccessToken: () => 'hub-jwt',
  ...overrides,
});

describe('buildDirectSyncPlayWsUrl — direct transport law', () => {
  it('builds the :8097 listener location, dropping the API port', () => {
    expect(buildDirectSyncPlayWsUrl('https://home.lan:32400'))
      .toBe('wss://home.lan:8097/api/v1/syncplay/ws');
    expect(buildDirectSyncPlayWsUrl('http://192.168.1.7:8096'))
      .toBe('ws://192.168.1.7:8097/api/v1/syncplay/ws');
  });

  it('carries NO credential in the URL (bearer-subprotocol flip, 424c14d0)', () => {
    // The builder's signature no longer even accepts a token — the pin is
    // that nothing query-shaped survives in the output, so a regression that
    // re-introduces `?token=` (in any encoding) reddens here.
    const url = buildDirectSyncPlayWsUrl('https://home.lan');
    expect(url).toBe('wss://home.lan:8097/api/v1/syncplay/ws');
    expect(url).not.toContain('token=');
    expect(url).not.toContain('?');
  });

  it('honours PHLIX_SYNCPLAY_WS_PORT and rejects malformed overrides', () => {
    const config = Config as { PHLIX_SYNCPLAY_WS_PORT?: string | number };
    try {
      config.PHLIX_SYNCPLAY_WS_PORT = '9123';
      expect(syncPlayWsPort()).toBe(9123);
      expect(buildDirectSyncPlayWsUrl('https://home.lan'))
        .toBe('wss://home.lan:9123/api/v1/syncplay/ws');

      config.PHLIX_SYNCPLAY_WS_PORT = 'not-a-port';
      expect(syncPlayWsPort()).toBe(SYNCPLAY_WS_DEFAULT_PORT);
      config.PHLIX_SYNCPLAY_WS_PORT = 70000;
      expect(syncPlayWsPort()).toBe(SYNCPLAY_WS_DEFAULT_PORT);
      config.PHLIX_SYNCPLAY_WS_PORT = 0;
      expect(syncPlayWsPort()).toBe(SYNCPLAY_WS_DEFAULT_PORT);
    } finally {
      delete config.PHLIX_SYNCPLAY_WS_PORT;
    }
  });
});

describe('resolveSyncPlayWsEndpoint', () => {
  // STATUS (reviewer follow-up #1, 2026-09-29): SyncPlayService currently
  // REFUSES the relay lane up front (hub bare-room dialect vs the client's
  // syncplay_* frames — see the interim guard in openSocket). The relay cases
  // below keep pinning the BUILDER law so it is proven-ready for the day hub
  // dialect bridging lands; the service-level refusal is pinned in
  // SyncPlayService.test.ts.
  beforeEach(() => {
    jest.clearAllMocks();
    __resetRelayTokenProvidersForTests();
  });

  it('direct: reads the server JWT from the vault and returns :8097 + bearer carrier', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('vault-jwt');
    // The hub-listed host equals the minted host — the pin passes and the
    // dial law is unchanged (same-host pass-through).
    mockSecureStorage.getIssuedHost.mockResolvedValue('192.168.1.100');

    const endpoint = await resolveSyncPlayWsEndpoint(directSource());

    // Dual-carrier TARGET law (phlix-server 424c14d0): exact two-entry offer,
    // credential out of the URL entirely.
    expect(endpoint).toEqual({
      url: 'wss://192.168.1.100:8097/api/v1/syncplay/ws',
      protocols: ['bearer', 'vault-jwt'],
    });
  });

  it('direct: refuses when the vault holds no token (no tokenless dial)', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue(null);

    await expect(resolveSyncPlayWsEndpoint(directSource())).resolves.toBeNull();
  });

  it('direct: refuses with no server root', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('vault-jwt');

    await expect(
      resolveSyncPlayWsEndpoint(directSource({ effectiveServerUrl: '' }))
    ).resolves.toBeNull();
  });

  // ── Minted-host pin (review mobile__exploiter M2) ───────────────────────
  // The direct lane must never ride the server JWT to a host the hub merely
  // SUGGESTED. `effectiveServerUrl` comes from the hub's /me/servers payload
  // (a discovery trust domain); the vault JWT belongs to the server-auth
  // domain. The dial is legal only when both agree on the host.

  it('direct: refuses to ride the JWT to a hub-suggested host (mismatch throws, never dials)', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('victim-jwt');
    mockSecureStorage.getIssuedHost.mockResolvedValue('home.lan');

    const attempt = resolveSyncPlayWsEndpoint(
      directSource({ effectiveServerUrl: 'https://attacker.example:32400' })
    );

    await expect(attempt).rejects.toBeInstanceOf(SyncPlayHostPinError);
    await expect(attempt).rejects.toMatchObject({
      refusalCode: SYNCPLAY_HOST_MISMATCH_CODE,
      message: SYNCPLAY_HOST_MISMATCH_MESSAGE,
    });
  });

  it('direct: refuses an unpinned vault session instead of trusting any host', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('legacy-jwt');
    mockSecureStorage.getIssuedHost.mockResolvedValue(null);

    await expect(resolveSyncPlayWsEndpoint(directSource())).rejects.toMatchObject({
      refusalCode: SYNCPLAY_HOST_UNPINNED_CODE,
      message: SYNCPLAY_HOST_UNPINNED_MESSAGE,
    });
  });

  it('direct: pins the host, not the port or case — same host on another port passes', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('vault-jwt');
    mockSecureStorage.getIssuedHost.mockResolvedValue('login.example');

    const endpoint = await resolveSyncPlayWsEndpoint(
      directSource({ effectiveServerUrl: 'https://Login.Example:32400' })
    );

    // The direct lane deliberately port-hops to :8097, so the anchor is the
    // hostname alone; case folds because BOTH sides normalize identically.
    expect(endpoint).toEqual({
      url: 'wss://login.example:8097/api/v1/syncplay/ws',
      protocols: ['bearer', 'vault-jwt'],
    });
  });

  it('direct: refuses before any endpoint value exists — the token never reaches a return path', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('vault-jwt');
    mockSecureStorage.getIssuedHost.mockResolvedValue('home.lan');

    await expect(
      resolveSyncPlayWsEndpoint(directSource({ effectiveServerUrl: 'http://evil.test:8096' }))
    ).rejects.toMatchObject({ refusalCode: SYNCPLAY_HOST_MISMATCH_CODE });
  });

  it('relay: the pin is a DIRECT-lane law — the hub channel rides the hub token untouched', async () => {
    // Deliberately mismatched minted host: relay mode dials the HUB with a
    // hub-minted relay token, so the server JWT's origin is irrelevant here.
    mockSecureStorage.getIssuedHost.mockResolvedValue('some.other.host');
    mockCreateProvider.mockImplementation(() => async () => 'relay-token-1');

    const endpoint = await resolveSyncPlayWsEndpoint(relaySource());

    expect(endpoint).toEqual({
      url: 'wss://hub.example.com:8804/syncplay/srv-9',
      protocols: ['bearer', 'relay-token-1'],
    });
  });

  it('relay: delegates URL to hubRelay.buildHubRelayUrl and carries the bearer subprotocol', async () => {
    mockCreateProvider.mockImplementation(
      () => async () => 'relay-token-1'
    );

    const endpoint = await resolveSyncPlayWsEndpoint(relaySource());

    expect(endpoint).toEqual({
      url: 'wss://hub.example.com:8804/syncplay/srv-9',
      protocols: ['bearer', 'relay-token-1'],
    });
    expect(endpoint!.url).not.toContain('token='); // S237: query refused by the relay
    expect(mockCreateProvider).toHaveBeenCalledWith({
      hubUrl: 'https://hub.example.com',
      getAccessToken: expect.any(Function),
      serverId: 'srv-9',
    });
  });

  it('relay: reuses ONE cached token provider per (hub, server) across resolves', async () => {
    mockCreateProvider.mockImplementation(() => async () => 'relay-token-1');

    await resolveSyncPlayWsEndpoint(relaySource());
    await resolveSyncPlayWsEndpoint(relaySource());

    expect(mockCreateProvider).toHaveBeenCalledTimes(1);
  });

  it('relay: refuses without hubUrl/serverId or a live hub session', async () => {
    mockCreateProvider.mockImplementation(() => async () => 'relay-token-1');

    await expect(
      resolveSyncPlayWsEndpoint(relaySource({ hubUrl: null }))
    ).resolves.toBeNull();
    await expect(
      resolveSyncPlayWsEndpoint(relaySource({ activeServerId: null }))
    ).resolves.toBeNull();
    await expect(
      resolveSyncPlayWsEndpoint(relaySource({ getHubAccessToken: () => null }))
    ).resolves.toBeNull();
    // Unsigned-out hub: the mint must not even be attempted.
    expect(mockCreateProvider).not.toHaveBeenCalled();
  });

  it('relay: refuses when the token mint itself returns null', async () => {
    mockCreateProvider.mockImplementation(() => async () => null);

    await expect(resolveSyncPlayWsEndpoint(relaySource())).resolves.toBeNull();
  });
});
