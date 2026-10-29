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
});
