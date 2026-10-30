/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/hub/hubStore.test.ts
import { useHubStore } from '../../store/hubStore';
import * as HubAuthService from '../../hub/HubAuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../../services/SecureStorage';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../hub/HubAuthService');
// The M-MOBILE-18 cascade is observed at THIS seam (hubStore → serverScope);
// what the cascade actually clears is pinned by the cascade's own law test
// (src/store/__tests__/serverScope.test.ts). Mocking keeps the hub auth
// surface (11 stores + the download queue) out of these unit tests.
jest.mock('../../store/serverScope', () => ({
  resetServerScopedState: jest.fn(),
}));
// Hoisting-safe seam handle: jest.mock above is moved before imports by
// babel-jest, so requireMock already returns the factory object.
const mockResetServerScopedState = jest.requireMock('../../store/serverScope')
  .resetServerScopedState as jest.Mock;

// The auto-mocked singleton: its async methods are jest.fn() at runtime, but the
// static type still describes them as plain methods. Re-type the instance so the
// mock helpers (mockResolvedValue/mockRejectedValue) are visible to the compiler.
const mockedHubAuthService = {
  hubAuthService: HubAuthService.hubAuthService as jest.Mocked<
    typeof HubAuthService.hubAuthService
  >,
};

describe('hubStore', () => {
  const mockSession = {
    accessToken: 'hub-access-token',
    refreshToken: 'hub-refresh-token',
    expiresAt: Date.now() / 1000 + 3600,
    userId: 'user-123',
  };

  const mockServers = [
    {
      serverId: 'server-1',
      serverName: 'My Server',
      version: '1.0.0',
      status: 'online' as const,
      hostname: 'https://192.168.1.100:32400',
      relayHostname: 'https://relay.phlix.app/server-1',
      capabilities: ['direct-play'],
    },
    {
      serverId: 'server-2',
      serverName: 'Other Server',
      version: '0.9.0',
      status: 'offline' as const,
      hostname: 'https://192.168.1.101:32400',
      relayHostname: 'https://relay.phlix.app/server-2',
      capabilities: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useHubStore.setState({
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      connectionMode: 'direct',
      effectiveServerUrl: '',
      serverGeneration: 0,
      isLoading: false,
      error: null,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('signInToHub', () => {
    it('should set session and fetch servers on successful sign in', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const state = useHubStore.getState();
      expect(state.hubUrl).toBe('https://hub.example.com');
      expect(state.session).toEqual(mockSession);
      expect(state.servers).toEqual(mockServers);
      expect(state.activeServerId).toBe('server-1'); // First server auto-selected
      expect(state.effectiveServerUrl).toBe('https://192.168.1.100:32400');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set activeServerId to null when no servers available', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue([]);

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const state = useHubStore.getState();
      expect(state.activeServerId).toBeNull();
      expect(state.effectiveServerUrl).toBe('');
    });

    it('should set error and isLoading=false on sign in failure', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockRejectedValue(
        new Error('Invalid credentials')
      );

      await expect(
        useHubStore.getState().signInToHub(
          'https://hub.example.com',
          'baduser',
          'badpass'
        )
      ).rejects.toThrow('Invalid credentials');

      const state = useHubStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signOutOfHub', () => {
    it('should clear all hub state', async () => {
      // First sign in
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      // Then sign out
      await useHubStore.getState().signOutOfHub();

      const state = useHubStore.getState();
      expect(state.hubUrl).toBeNull();
      expect(state.session).toBeNull();
      expect(state.servers).toEqual([]);
      expect(state.activeServerId).toBeNull();
      expect(state.effectiveServerUrl).toBe('');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('phlix_hub_session');
    });
  });

  describe('setActiveServer', () => {
    it('should update activeServerId and effectiveServerUrl', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      useHubStore.getState().setActiveServer('server-2');

      const state = useHubStore.getState();
      expect(state.activeServerId).toBe('server-2');
      expect(state.effectiveServerUrl).toBe('https://192.168.1.101:32400');
    });

    it('should switch to relay URL when in relay mode', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      useHubStore.getState().setConnectionMode('relay');
      useHubStore.getState().setActiveServer('server-1');

      const state = useHubStore.getState();
      expect(state.connectionMode).toBe('relay');
      expect(state.effectiveServerUrl).toBe('https://relay.phlix.app/server-1');
    });

    it('should not update if serverId not found', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const initialUrl = useHubStore.getState().effectiveServerUrl;
      useHubStore.getState().setActiveServer('nonexistent');

      expect(useHubStore.getState().effectiveServerUrl).toBe(initialUrl);
    });
  });

  describe('setConnectionMode', () => {
    it('should toggle from direct to relay', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      expect(useHubStore.getState().connectionMode).toBe('direct');
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://192.168.1.100:32400'
      );

      useHubStore.getState().setConnectionMode('relay');

      expect(useHubStore.getState().connectionMode).toBe('relay');
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://relay.phlix.app/server-1'
      );
    });

    it('should toggle from relay to direct', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );
      useHubStore.getState().setConnectionMode('relay');

      useHubStore.getState().setConnectionMode('direct');

      expect(useHubStore.getState().connectionMode).toBe('direct');
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://192.168.1.100:32400'
      );
    });
  });

  describe('fetchServers', () => {
    it('should update servers list', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const newServers = [
        ...mockServers,
        {
          serverId: 'server-3',
          serverName: 'New Server',
          version: '1.1.0',
          status: 'online' as const,
          hostname: 'https://192.168.1.102:32400',
          capabilities: ['direct-play'],
        },
      ];
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(newServers);

      await useHubStore.getState().fetchServers();

      expect(useHubStore.getState().servers).toHaveLength(3);
      expect(mockedHubAuthService.hubAuthService.listServers).toHaveBeenCalledTimes(
        2
      );
    });

    it('should throw when not signed in', async () => {
      await expect(useHubStore.getState().fetchServers()).rejects.toThrow(
        'Not signed in to hub'
      );
    });
  });

  describe('refreshHubSession', () => {
    it('should update session with new tokens', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const newSession = {
        ...mockSession,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      mockedHubAuthService.hubAuthService.refresh.mockResolvedValue(newSession);

      await useHubStore.getState().refreshHubSession();

      expect(useHubStore.getState().session?.accessToken).toBe('new-access-token');
      expect(mockedHubAuthService.hubAuthService.refresh).toHaveBeenCalledWith(
        'https://hub.example.com',
        mockSession.refreshToken
      );
    });

    it('should sign out on refresh failure', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      mockedHubAuthService.hubAuthService.refresh.mockRejectedValue(
        new Error('Token expired')
      );

      await expect(useHubStore.getState().refreshHubSession()).rejects.toThrow(
        'Token expired'
      );

      // Should have signed out
      expect(useHubStore.getState().session).toBeNull();
    });
  });

  describe('loadPersistedState', () => {
    it('should restore persisted session and servers', async () => {
      const persistedData = {
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        activeServerId: 'server-2',
        connectionMode: 'relay' as const,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(persistedData)
      );
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().loadPersistedState();

      const state = useHubStore.getState();
      expect(state.hubUrl).toBe('https://hub.example.com');
      expect(state.session).toEqual(mockSession);
      expect(state.activeServerId).toBe('server-2');
      expect(state.connectionMode).toBe('relay');
      expect(state.effectiveServerUrl).toBe('https://relay.phlix.app/server-2');
    });

    it('should handle missing persisted data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(useHubStore.getState().loadPersistedState()).resolves.toBeUndefined();
    });

    // M-MOBILE-31 — the old gate was truthiness-only: a non-object blob, a
    // non-string hubUrl, or a session without typed expiresAt/userId used to
    // flow straight into fetch()/HubSession hydration. All refused at the
    // boundary now, leaving state untouched.
    it.each([
      ['a scalar blob', JSON.stringify('pwned')],
      ['an array blob', JSON.stringify([{ pwn: true }])],
      ['a non-string hubUrl', JSON.stringify({ hubUrl: { proto: 'http' }, session: mockSession, activeServerId: 'server-2' })],
      ['a session without typed fields', JSON.stringify({ hubUrl: 'https://hub.example.com', session: { expiresAt: 'never' }, activeServerId: 'server-2' })],
    ])('refuses %s without touching state', async (_label, blob) => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(blob);
      mockedHubAuthService.hubAuthService.listServers.mockClear();

      await useHubStore.getState().loadPersistedState();

      expect(mockedHubAuthService.hubAuthService.listServers).not.toHaveBeenCalled();
      expect(useHubStore.getState().hubUrl).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockRejectedValue(
        new Error('Some error')
      );

      try {
        await useHubStore.getState().signInToHub(
          'https://hub.example.com',
          'bad',
          'creds'
        );
      } catch {
        // Expected
      }

      expect(useHubStore.getState().error).toBe('Some error');
      useHubStore.getState().clearError();
      expect(useHubStore.getState().error).toBeNull();
    });
  });

  describe('refreshHubSession edge cases', () => {
    it('should throw when not signed in', async () => {
      await expect(useHubStore.getState().refreshHubSession()).rejects.toThrow(
        'Not signed in to hub'
      );
    });
  });

  describe('fetchServers error handling', () => {
    it('should set error and throw when fetch fails', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      mockedHubAuthService.hubAuthService.listServers.mockRejectedValue(
        new Error('Network error')
      );

      await expect(useHubStore.getState().fetchServers()).rejects.toThrow(
        'Network error'
      );

      const state = useHubStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // M-MOBILE-05 (review mobile__crossfe.md M2): the SecureStorage law (audit
  // M1) originally covered only the SERVER JWT pair — `persistSession` used to
  // serialize the whole hub session (both hub JWTs included) into the
  // plaintext AsyncStorage blob under `phlix_hub_session`. The hub lane now
  // routes through dedicated keychain slots mirroring ACCESS/REFRESH
  // (`com.phlix.mobile.hub.access` / `.hub.refresh`, src/services/
  // SecureStorage.ts); the blob keeps only non-secret session envelope +
  // connection metadata. Pre-vault blobs migrate on first read,
  // secure-write-before-sanitize (never orphan, same order law as the
  // vault's migrateSlot). The keychain stand-in is jest.setup.js's in-memory
  // mock; per-slot values are observed through the vault API itself.
  // ---------------------------------------------------------------------------
  describe('hub token vault law (M-MOBILE-05)', () => {
    const keychainMock = jest.requireMock('react-native-keychain') as {
      __resetKeychainMock: () => void;
      setGenericPassword: jest.Mock;
    };

    const sanitizedEnvelope = (hubUrl = 'https://hub.example.com') =>
      JSON.stringify({
        hubUrl,
        session: { expiresAt: mockSession.expiresAt, userId: mockSession.userId },
        activeServerId: 'server-2',
        connectionMode: 'relay',
      });

    beforeEach(() => {
      keychainMock.__resetKeychainMock();
    });

    it('sign-in routes BOTH hub JWTs into dedicated hub vault slots', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      expect(await secureStorage.getHubAccessToken()).toBe('hub-access-token');
      expect(await secureStorage.getHubRefreshToken()).toBe('hub-refresh-token');

      // Slot names mirror the server pair under the .hub namespace.
      const services = keychainMock.setGenericPassword.mock.calls.map(
        (call) => (call[2] as { service: string }).service
      );
      expect(services).toEqual(
        expect.arrayContaining([
          'com.phlix.mobile.hub.access',
          'com.phlix.mobile.hub.refresh',
        ])
      );
    });

    it('the AsyncStorage blob never carries JWT material', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const writes = (AsyncStorage.setItem as jest.Mock).mock.calls;
      expect(writes.length).toBeGreaterThan(0);
      const [, payload] = writes[writes.length - 1];
      const parsed = JSON.parse(payload);
      expect(parsed.session.accessToken).toBeUndefined();
      expect(parsed.session.refreshToken).toBeUndefined();
      // Whole-payload negative pin: neither secret appears ANYWHERE in the
      // blob (mutation-toothed: reverting persistSession to `session` full
      // serialization reddens here, not just on the two key checks).
      expect(payload).not.toContain('hub-access-token');
      expect(payload).not.toContain('hub-refresh-token');
      // Envelope metadata survives — this is a move, not a loss.
      expect(parsed.session.userId).toBe('user-123');
    });

    it('hub slots never shadow the server vault (lane isolation)', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      // Signing in to the hub must not populate (or clobber) the server pair.
      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
    });

    it('pre-vault plaintext blob migrates on first read: secure-write then sanitize', async () => {
      // Old-shape blob: whole session (tokens inlined) — the era the review
      // caught. Keychain starts empty (beforeEach reset).
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          hubUrl: 'https://hub.example.com',
          session: mockSession,
          activeServerId: 'server-2',
          connectionMode: 'relay',
        })
      );
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);

      await useHubStore.getState().loadPersistedState();

      // Vault holds both JWTs…
      expect(await secureStorage.getHubAccessToken()).toBe('hub-access-token');
      expect(await secureStorage.getHubRefreshToken()).toBe('hub-refresh-token');
      // …the blob was rewritten WITHOUT them (write-before-delete order:
      // the sanitizing setItem is only reached once storeHubTokens settled)…
      const writes = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const [, sanitized] = writes[writes.length - 1];
      expect(sanitized).not.toContain('hub-access-token');
      expect(sanitized).not.toContain('hub-refresh-token');
      // …and the session hydrated fully (never orphaned).
      expect(useHubStore.getState().session).toEqual(mockSession);
    });

    it('vault-hydrated round trip: sanitized blob + slots restore the full session', async () => {
      // Relay mode chosen BEFORE sign-in so it lands in the persisted blob.
      useHubStore.setState({ connectionMode: 'relay' });
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      // Simulate app restart: wipe in-memory state, replay the persisted
      // (sanitized) blob + the vault.
      const writes = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const persistedBlob = writes[writes.length - 1][1];
      useHubStore.setState({
        hubUrl: null,
        session: null,
        servers: [],
        activeServerId: null,
        connectionMode: 'direct',
        effectiveServerUrl: '',
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(persistedBlob);

      await useHubStore.getState().loadPersistedState();

      expect(useHubStore.getState().session).toEqual(mockSession);
      expect(useHubStore.getState().connectionMode).toBe('relay');
      // signIn auto-selects the first server — server-1, relayed.
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://relay.phlix.app/server-1'
      );
    });

    it('sign-out wipes the hub vault slots along with the blob', async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      await useHubStore.getState().signOutOfHub();

      expect(await secureStorage.getHubAccessToken()).toBeNull();
      expect(await secureStorage.getHubRefreshToken()).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('phlix_hub_session');
    });

    it('unsalvageable session (sanitized blob, empty vault) is swept, not hydrated', async () => {
      // OS-level keychain wipe under a v2 blob: no credentials anywhere.
      // Law (wsEndpoint): never open a socket without a credential.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(sanitizedEnvelope());

      await useHubStore.getState().loadPersistedState();

      expect(useHubStore.getState().session).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('phlix_hub_session');
      expect(
        mockedHubAuthService.hubAuthService.listServers
      ).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // M-MOBILE-12 (review mobile__exploiter): the queue entry claimed the hub
  // pair still sat plaintext in AsyncStorage. Re-verified at HEAD: that era
  // ended at d72dc0c — `persistSession` sanitizes and `loadPersistedState`
  // migrates — and a sweep of EVERY AsyncStorage write site found no other
  // credential material in the plaintext store (settings carries no
  // password/token fields, download tasks carry media metadata + local
  // paths, the `user` envelope is profile data, device id / active profile /
  // the minted-host pin are identifiers the vault docblock already judges
  // configuration). What stayed unpinned is the SHAPE of the law the tests
  // above cannot see: (a) every end-state assertion passes even if the
  // vault-write and the blob-write swap order — a swapped pair is an orphan
  // window whenever the second call fails, so the ORDER is the contract;
  // (b) pre-vault platform failure must degrade honestly — session usable,
  // plaintext row retained for a retry, never a silent token-loss loop.
  // These tests pin both, and they are the mutation teeth the brief demands:
  // reverting vault-first ordering reddens (1)/(2); dropping the legacy
  // sweep reddens (2) alongside the M-MOBILE-05 migration pin.
  // ---------------------------------------------------------------------------
  describe('hub token vault ordering & failure law (M-MOBILE-12)', () => {
    const keychainMock = jest.requireMock('react-native-keychain') as {
      __resetKeychainMock: () => void;
      getGenericPassword: jest.Mock;
      setGenericPassword: jest.Mock;
    };
    const HUB_ACCESS_SERVICE = 'com.phlix.mobile.hub.access';
    const BLOB_KEY = 'phlix_hub_session';

    // The factory implementation, captured before any test swaps it, so an
    // assertion failure mid-swap cannot poison later cases.
    const innerKeychainWrite = keychainMock.setGenericPassword.getMockImplementation();

    const legacyBlob = JSON.stringify({
      hubUrl: 'https://hub.example.com',
      session: mockSession,
      activeServerId: 'server-2',
      connectionMode: 'relay',
    });

    interface ObservedWrite {
      key: string;
      value: string;
      vaultHeldPairAtWrite: boolean;
    }

    /**
     * Replace setItem with an instrumented pass-through: at the moment every
     * AsyncStorage write fires, it snapshots whether the hub vault slot
     * ALREADY holds the access JWT. End-state is not enough — the order is.
     */
    function observeWrites(): ObservedWrite[] {
      const writes: ObservedWrite[] = [];
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
          const credential = await keychainMock.getGenericPassword({
            service: HUB_ACCESS_SERVICE,
          });
          writes.push({
            key,
            value,
            vaultHeldPairAtWrite:
              credential !== false && credential.password === mockSession.accessToken,
          });
        }
      );
      return writes;
    }

    /** Make the native keychain refuse hub writes; other services pass through. */
    function failHubVaultWrites(): void {
      keychainMock.setGenericPassword.mockImplementation(
        async (username: string, password: string, options?: { service?: string }) => {
          if (options?.service === HUB_ACCESS_SERVICE) {
            throw new Error('keychain unavailable');
          }
          return innerKeychainWrite!(username, password, options);
        }
      );
    }

    beforeEach(() => {
      keychainMock.__resetKeychainMock();
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
    });

    afterEach(() => {
      keychainMock.setGenericPassword.mockImplementation(innerKeychainWrite!);
    });

    it('(1) sign-in persists vault-before-blob, and NO AsyncStorage write carries token material', async () => {
      const writes = observeWrites();

      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      const blobWrites = writes.filter((w) => w.key === BLOB_KEY);
      expect(blobWrites).toHaveLength(1);
      // Mutation tooth: hoisting the blob setItem above storeHubTokens in
      // persistSession lands vaultHeldPairAtWrite=false here, red.
      expect(blobWrites[0].vaultHeldPairAtWrite).toBe(true);

      // Hostile dump: after a full sign-in, no payload written anywhere in
      // AsyncStorage contains either JWT — the vault is the only carrier.
      for (const write of writes) {
        expect(write.value).not.toContain(mockSession.accessToken);
        expect(write.value).not.toContain(mockSession.refreshToken);
      }
    });

    it('(2) legacy plaintext migration rewrites the sanitized blob only AFTER the vault holds the pair', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(legacyBlob);
      const writes = observeWrites();

      await useHubStore.getState().loadPersistedState();

      const blobWrites = writes.filter((w) => w.key === BLOB_KEY);
      expect(blobWrites).toHaveLength(1);
      // Mutation teeth: swapping the storeHubTokens/setItem pair in
      // loadPersistedState reddens vaultHeldPairAtWrite (orphan window);
      // deleting the sanitizing write reddens the length pin (M-MOBILE-05's
      // migration test reddens the same move from the end-state side).
      expect(blobWrites[0].vaultHeldPairAtWrite).toBe(true);
      expect(blobWrites[0].value).not.toContain(mockSession.accessToken);
      expect(blobWrites[0].value).not.toContain(mockSession.refreshToken);
    });

    it('(3) vault failure at sign-in fails loud: sign-in rejects and no plaintext blob is ever written', async () => {
      failHubVaultWrites();

      await expect(
        useHubStore.getState().signInToHub(
          'https://hub.example.com',
          'testuser',
          'testpass'
        )
      ).rejects.toThrow('keychain unavailable');

      // The honest degradation at issuance is a REPORTED failure — persist
      // has no fallback path that trades the vault for plaintext.
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(useHubStore.getState().error).toBe('keychain unavailable');
    });

    it('(4) vault failure mid-migration degrades honestly: session stays usable, plaintext stays for the retry, recovery completes the move', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(legacyBlob);
      failHubVaultWrites();

      await useHubStore.getState().loadPersistedState();

      // Never orphan: the in-memory session hydrates from the plaintext pair…
      expect(useHubStore.getState().session).toEqual(mockSession);
      expect(
        mockedHubAuthService.hubAuthService.listServers
      ).toHaveBeenCalledWith('https://hub.example.com', mockSession);
      // …and the row survives untouched — no sanitize rewrite, no sweep of a
      // recoverable session. Deleting the try/catch in loadPersistedState so
      // the throw falls through to the unsalvageable sweep reddens this pair
      // (silent token-loss loop).
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

      // Platform recovers: the next read completes what this one deferred.
      keychainMock.setGenericPassword.mockImplementation(innerKeychainWrite!);
      (AsyncStorage.setItem as jest.Mock).mockClear();

      await useHubStore.getState().loadPersistedState();

      expect(await secureStorage.getHubAccessToken()).toBe(mockSession.accessToken);
      expect(await secureStorage.getHubRefreshToken()).toBe(mockSession.refreshToken);
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sanitized = calls[calls.length - 1][1] as string;
      expect(sanitized).not.toContain(mockSession.accessToken);
      expect(sanitized).not.toContain(mockSession.refreshToken);
    });
  });

  // ---------------------------------------------------------------------------
  // M-MOBILE-20 (review mobile__secnet M1, the queue's hub lane of audit-M1's
  // plaintext class): d72dc0c moved the hub pair into the vault and migrates
  // pre-vault blobs — but ONE state was left unswept: the crash residue of the
  // migration itself. If the process died (or setItem threw) AFTER
  // storeHubTokens settled and BEFORE the sanitizing rewrite, both copies
  // exist, and the old read path took the vault branch and NEVER rewrote the
  // blob — plaintext JWTs living on until some unrelated write happened to
  // replace them. The server precedent (SecureStorage.migrateSlot) has no such
  // window: once the secure side is settled the legacy copy is removed
  // UNCONDITIONALLY ("redundant either way"). The sweep below closes the
  // window; these tests pin it, vault-wins semantics included.
  // ---------------------------------------------------------------------------
  describe('hub vault crash-residue sweep (M-MOBILE-20)', () => {
    const keychainMock = jest.requireMock('react-native-keychain') as {
      __resetKeychainMock: () => void;
    };

    const residueBlob = JSON.stringify({
      hubUrl: 'https://hub.example.com',
      // STALE plaintext pair — deliberately different values from the vault
      // so "vault wins" is observable in the hydrated session, not assumed.
      session: { ...mockSession, accessToken: 'stale-plain-access', refreshToken: 'stale-plain-refresh' },
      activeServerId: 'server-2',
      connectionMode: 'relay',
    });

    beforeEach(() => {
      keychainMock.__resetKeychainMock();
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
    });

    it('both copies present: vault pair hydrates and the plaintext blob is rewritten token-free', async () => {
      await secureStorage.storeHubTokens('vault-access', 'vault-refresh');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(residueBlob);

      await useHubStore.getState().loadPersistedState();

      // Vault wins over the older plaintext pair.
      const hydrated = {
        accessToken: 'vault-access',
        refreshToken: 'vault-refresh',
        expiresAt: mockSession.expiresAt,
        userId: mockSession.userId,
      };
      expect(useHubStore.getState().session).toEqual(hydrated);
      expect(mockedHubAuthService.hubAuthService.listServers).toHaveBeenCalledWith(
        'https://hub.example.com',
        hydrated
      );

      // Plaintext gone: exactly one sanitizing rewrite, neither stale secret
      // survives in it, and the metadata rides along (a sweep, not a loss).
      const blobWrites = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
        ([key]) => key === 'phlix_hub_session'
      );
      expect(blobWrites).toHaveLength(1);
      expect(blobWrites[0][1]).not.toContain('stale-plain-access');
      expect(blobWrites[0][1]).not.toContain('stale-plain-refresh');
      expect(blobWrites[0][1]).not.toContain('vault-access');
      const parsed = JSON.parse(blobWrites[0][1]);
      expect(parsed.activeServerId).toBe('server-2');
      expect(parsed.connectionMode).toBe('relay');
      expect(parsed.session).toEqual({
        expiresAt: mockSession.expiresAt,
        userId: mockSession.userId,
      });
      // Mutation tooth: deleting the residue branch lands blobWrites at
      // length 0 here — the exact window this item exists to close.
    });

    it('healthy v2 state (sanitized blob + vault) is NOT rewritten — the sweep is idempotent', async () => {
      await secureStorage.storeHubTokens('vault-access', 'vault-refresh');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          hubUrl: 'https://hub.example.com',
          session: { expiresAt: mockSession.expiresAt, userId: mockSession.userId },
          activeServerId: 'server-2',
          connectionMode: 'relay',
        })
      );

      await useHubStore.getState().loadPersistedState();

      expect(useHubStore.getState().session?.accessToken).toBe('vault-access');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('a throwing sweep is fail-soft: session still hydrates from the vault, next load retries', async () => {
      await secureStorage.storeHubTokens('vault-access', 'vault-refresh');
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(residueBlob);
      // Whole-test implementation swap (not mockRejectedValueOnce): the outer
      // beforeEach's mockResolvedValue overrides it next case, so an
      // unconsumed rejection can never poison later suites under mutation.
      (AsyncStorage.setItem as jest.Mock).mockImplementation(async () => {
        throw new Error('async storage busy');
      });

      await expect(
        useHubStore.getState().loadPersistedState()
      ).resolves.toBeUndefined();

      // The sweep ran and failed exactly once — no crash path around it.
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      // The sweep is hygiene, never the credential source: hydration and the
      // server fetch proceed on the vault pair despite the failed rewrite…
      expect(useHubStore.getState().session?.accessToken).toBe('vault-access');
      expect(mockedHubAuthService.hubAuthService.listServers).toHaveBeenCalled();
      // …and nothing was removed — the unswept blob stays for the retry.
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('phlix_hub_session');
    });
  });

  // ── M-MOBILE-18 (review mobile__gameux M-G) ──────────────────────────────
  // The switch law at the hubStore seam: server identity MOVES → caches are
  // dropped (cascade called through the serverScope seam) and `serverGeneration`
  // bumps — mounted screens subscribe to that number; re-selecting the CURRENT
  // server must stay a true no-op (a wake-up stampede for identical rows is
  // not a cure). Identity-to/from-null (sign-in landing the first server,
  // sign-out leaving none) is itself a MOVE.
  describe('server-switch law (M-MOBILE-18)', () => {
    const signIn = async () => {
      mockedHubAuthService.hubAuthService.signIn.mockResolvedValue(mockSession);
      mockedHubAuthService.hubAuthService.listServers.mockResolvedValue(mockServers);
      await useHubStore.getState().signInToHub(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );
    };

    it('setActiveServer to another server drops the caches and bumps the generation', async () => {
      await signIn(); // null → server-1 is itself a move: 1 cascade, gen 1
      expect(mockResetServerScopedState).toHaveBeenCalledTimes(1);
      expect(useHubStore.getState().serverGeneration).toBe(1);

      mockResetServerScopedState.mockClear();
      useHubStore.getState().setActiveServer('server-2');

      expect(mockResetServerScopedState).toHaveBeenCalledTimes(1);
      expect(useHubStore.getState().serverGeneration).toBe(2);
      expect(useHubStore.getState().activeServerId).toBe('server-2');
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://192.168.1.101:32400'
      );
    });

    it('re-selecting the ACTIVE server is a true no-op — no cascade, no bump, no persist churn', async () => {
      await signIn();
      mockResetServerScopedState.mockClear();
      (AsyncStorage.setItem as jest.Mock).mockClear();

      useHubStore.getState().setActiveServer('server-1'); // already active

      expect(mockResetServerScopedState).not.toHaveBeenCalled();
      expect(useHubStore.getState().serverGeneration).toBe(1); // unchanged
      expect(useHubStore.getState().activeServerId).toBe('server-1');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('an unknown serverId never wakes the law (not-found guard precedes it)', async () => {
      await signIn();
      mockResetServerScopedState.mockClear();

      useHubStore.getState().setActiveServer('nonexistent');

      expect(mockResetServerScopedState).not.toHaveBeenCalled();
      expect(useHubStore.getState().serverGeneration).toBe(1);
    });

    it('sign-out moves the identity to NONE — caches drop once, a repeat sign-out is inert', async () => {
      await signIn();
      mockResetServerScopedState.mockClear();

      await useHubStore.getState().signOutOfHub();

      expect(mockResetServerScopedState).toHaveBeenCalledTimes(1);
      expect(useHubStore.getState().serverGeneration).toBe(2);

      mockResetServerScopedState.mockClear();
      await useHubStore.getState().signOutOfHub(); // already out

      expect(mockResetServerScopedState).not.toHaveBeenCalled();
      expect(useHubStore.getState().serverGeneration).toBe(2);
    });

    it('connection-mode toggles never wake the law (same server = same ids)', async () => {
      await signIn();
      mockResetServerScopedState.mockClear();

      useHubStore.getState().setConnectionMode('relay');
      useHubStore.getState().setConnectionMode('direct');

      expect(mockResetServerScopedState).not.toHaveBeenCalled();
      expect(useHubStore.getState().serverGeneration).toBe(1);
      expect(useHubStore.getState().effectiveServerUrl).toBe(
        'https://192.168.1.100:32400'
      );
    });

    it('lazy hydration of a DIFFERENT persisted server wakes the law; same-id replay stays inert', async () => {
      // Warm caches already on server-1, then the Settings screen hydrates a
      // persisted row pointing at server-2 — identity moves under the caches.
      await signIn();
      mockResetServerScopedState.mockClear();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          hubUrl: 'https://hub.example.com',
          session: mockSession,
          activeServerId: 'server-2',
          connectionMode: 'direct',
        })
      );
      await useHubStore.getState().loadPersistedState();

      expect(mockResetServerScopedState).toHaveBeenCalledTimes(1);
      expect(useHubStore.getState().serverGeneration).toBe(2);
      expect(useHubStore.getState().activeServerId).toBe('server-2');

      // Same persisted id replayed: nothing moved — no cascade, no bump.
      mockResetServerScopedState.mockClear();
      await useHubStore.getState().loadPersistedState();

      expect(mockResetServerScopedState).not.toHaveBeenCalled();
      expect(useHubStore.getState().serverGeneration).toBe(2);
    });
  });
});
