// src/__tests__/hub/HubAwareClient.test.ts
import { hubAwareClient } from '../../api/hubAwareClient';
import { useHubStore } from '../../store/hubStore';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HubAwareClient', () => {
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
      relayHostname: 'https://relay.phlex.app/server-1',
      capabilities: ['direct-play'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  describe('direct mode', () => {
    it('should use server hostname as base URL', async () => {
      mockedAxios.get.mockResolvedValue({ data: { libraries: [] } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct',
        effectiveServerUrl: 'https://192.168.1.100:32400',
      });

      await hubAwareClient.get('/api/v1/libraries');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://192.168.1.100:32400/api/v1/libraries',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
            'X-Server-Id': expect.any(String),
          }),
        })
      );
    });

    it('should not inject authorization header in direct mode', async () => {
      mockedAxios.get.mockResolvedValue({ data: { libraries: [] } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct',
        effectiveServerUrl: 'https://192.168.1.100:32400',
      });

      await hubAwareClient.get('/api/v1/libraries');

      const callArgs = mockedAxios.get.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      expect(config.headers).not.toHaveProperty('Authorization');
      expect(config.headers).not.toHaveProperty('X-Server-Id');
    });
  });

  describe('relay mode', () => {
    it('should use hub relay URL as base URL', async () => {
      mockedAxios.get.mockResolvedValue({ data: { libraries: [] } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.get('/api/v1/libraries');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/relay/server-1/api/v1/libraries',
        expect.any(Object)
      );
    });

    it('should inject Authorization header with hub session JWT', async () => {
      mockedAxios.get.mockResolvedValue({ data: { libraries: [] } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.get('/api/v1/libraries');

      const callArgs = mockedAxios.get.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      expect(config.headers).toHaveProperty(
        'Authorization',
        'Bearer hub-access-token'
      );
    });

    it('should inject X-Server-Id header for relay routing', async () => {
      mockedAxios.get.mockResolvedValue({ data: { libraries: [] } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.get('/api/v1/libraries');

      const callArgs = mockedAxios.get.mock.calls[0];
      const config = callArgs[1] as Record<string, unknown>;
      expect(config.headers).toHaveProperty('X-Server-Id', 'server-1');
    });
  });

  describe('post', () => {
    it('should work in direct mode', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct',
        effectiveServerUrl: 'https://192.168.1.100:32400',
      });

      await hubAwareClient.post('/api/v1/playback', { itemId: '123' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://192.168.1.100:32400/api/v1/playback',
        { itemId: '123' },
        expect.any(Object)
      );
    });

    it('should work in relay mode', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.post('/api/v1/playback', { itemId: '123' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/relay/server-1/api/v1/playback',
        { itemId: '123' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer hub-access-token',
            'X-Server-Id': 'server-1',
          }),
        })
      );
    });
  });

  describe('put', () => {
    it('should work in relay mode', async () => {
      mockedAxios.put.mockResolvedValue({ data: { success: true } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.put('/api/v1/user/settings', { theme: 'dark' });

      expect(mockedAxios.put).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/relay/server-1/api/v1/user/settings',
        { theme: 'dark' },
        expect.any(Object)
      );
    });
  });

  describe('delete', () => {
    it('should work in relay mode', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.delete('/api/v1/session/current');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/relay/server-1/api/v1/session/current',
        expect.any(Object)
      );
    });
  });

  describe('isHubModeActive', () => {
    it('should return true when hub is fully configured', () => {
      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct',
        effectiveServerUrl: 'https://192.168.1.100:32400',
      });

      expect(hubAwareClient.isHubModeActive()).toBe(true);
    });

    it('should return false when not signed in', () => {
      useHubStore.setState({
        hubUrl: null,
        session: null,
        servers: [],
        activeServerId: null,
        connectionMode: 'direct',
        effectiveServerUrl: '',
      });

      expect(hubAwareClient.isHubModeActive()).toBe(false);
    });

    it('should return false when missing activeServerId', () => {
      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: null,
        connectionMode: 'direct',
        effectiveServerUrl: '',
      });

      expect(hubAwareClient.isHubModeActive()).toBe(false);
    });
  });

  describe('getConnectionMode', () => {
    it('should return current connection mode', () => {
      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      expect(hubAwareClient.getConnectionMode()).toBe('relay');
    });
  });

  describe('URL building', () => {
    it('should handle paths without leading slash', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct',
        effectiveServerUrl: 'https://192.168.1.100:32400',
      });

      await hubAwareClient.get('api/v1/libraries');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://192.168.1.100:32400/api/v1/libraries',
        expect.any(Object)
      );
    });

    it('should handle hub URLs with trailing slashes', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      useHubStore.setState({
        hubUrl: 'https://hub.example.com///',
        session: mockSession,
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay',
        effectiveServerUrl: 'https://relay.phlex.app/server-1',
      });

      await hubAwareClient.get('/api/v1/libraries');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/relay/server-1/api/v1/libraries',
        expect.any(Object)
      );
    });
  });
});
