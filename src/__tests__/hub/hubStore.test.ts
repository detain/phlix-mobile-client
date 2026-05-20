// src/__tests__/hub/hubStore.test.ts
import { useHubStore } from '../../store/hubStore';
import * as HubAuthService from '../../hub/HubAuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../hub/HubAuthService');
const mockedHubAuthService = HubAuthService as jest.Mocked<typeof HubAuthService>;

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
});
