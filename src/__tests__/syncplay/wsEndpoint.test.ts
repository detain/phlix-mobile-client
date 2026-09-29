/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/wsEndpoint.test.ts
/**
 * Endpoint-builder law (audit H1/M7):
 *
 * - direct lane  → `ws(s)://{host}:8097/...?token=<JWT>` (dedicated listener,
 *   query carrier, port overridable via PHLIX_SYNCPLAY_WS_PORT);
 * - relay lane   → `ws(s)://{hubHost}:8804/syncplay/{server_id}` with the
 *   `['bearer', <relayToken>]` subprotocol and NEVER a query token (S237);
 * - no lane without its credential — the builders refuse, they do not dial
 *   tokenless sockets that both listeners reject pre-101 anyway.
 */

import Config from 'react-native-config';
import {
  buildDirectSyncPlayWsUrl,
  resolveSyncPlayWsEndpoint,
  syncPlayWsPort,
  SYNCPLAY_WS_DEFAULT_PORT,
  __resetRelayTokenProvidersForTests,
  type SyncPlayWsSource,
} from '../../syncplay/wsEndpoint';
import { secureStorage } from '../../services/SecureStorage';
import { createHubRelayTokenProvider } from '../../hub/RelayTokenProvider';

jest.mock('../../services/SecureStorage', () => ({
  __esModule: true,
  default: { getAccessToken: jest.fn() },
  secureStorage: { getAccessToken: jest.fn() },
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
  it('dials the dedicated :8097 listener with the query token, dropping the API port', () => {
    expect(buildDirectSyncPlayWsUrl('https://home.lan:32400', 'jwt.abc'))
      .toBe('wss://home.lan:8097/api/v1/syncplay/ws?token=jwt.abc');
    expect(buildDirectSyncPlayWsUrl('http://192.168.1.7:8096', 'jwt.abc'))
      .toBe('ws://192.168.1.7:8097/api/v1/syncplay/ws?token=jwt.abc');
  });

  it('URI-encodes the credential (no assumption that JWTs are URL-safe)', () => {
    expect(buildDirectSyncPlayWsUrl('https://home.lan', 'a+b/c=d.e'))
      .toBe('wss://home.lan:8097/api/v1/syncplay/ws?token=a%2Bb%2Fc%3Dd.e');
  });

  it('honours PHLIX_SYNCPLAY_WS_PORT and rejects malformed overrides', () => {
    const config = Config as { PHLIX_SYNCPLAY_WS_PORT?: string | number };
    try {
      config.PHLIX_SYNCPLAY_WS_PORT = '9123';
      expect(syncPlayWsPort()).toBe(9123);
      expect(buildDirectSyncPlayWsUrl('https://home.lan', 't'))
        .toBe('wss://home.lan:9123/api/v1/syncplay/ws?token=t');

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
  beforeEach(() => {
    jest.clearAllMocks();
    __resetRelayTokenProvidersForTests();
  });

  it('direct: reads the server JWT from the vault and returns the :8097 URL', async () => {
    mockSecureStorage.getAccessToken.mockResolvedValue('vault-jwt');

    const endpoint = await resolveSyncPlayWsEndpoint(directSource());

    expect(endpoint).toEqual({
      url: 'wss://192.168.1.100:8097/api/v1/syncplay/ws?token=vault-jwt',
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
