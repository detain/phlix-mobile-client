// src/__tests__/hub/HubAuthService.test.ts
import { HubAuthService } from '../../hub/HubAuthService';

// Note: axios is mocked globally in jest.setup.js
// We use the mocked instance through direct module access
import axios from 'axios';

const mockPost = (axios as unknown as { post: jest.Mock }).post;
const mockGet = (axios as unknown as { get: jest.Mock }).get;

describe('HubAuthService', () => {
  let service: HubAuthService;

  beforeEach(() => {
    service = new HubAuthService();
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('should return a HubSession on successful sign in', async () => {
      const mockResponse = {
        data: {
          access_token: 'hub-access-token',
          refresh_token: 'hub-refresh-token',
          expires_in: 3600,
          user_id: 'user-123',
        },
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await service.signIn(
        'https://hub.example.com',
        'testuser',
        'testpass'
      );

      expect(result).toEqual({
        accessToken: 'hub-access-token',
        refreshToken: 'hub-refresh-token',
        expiresAt: expect.any(Number),
        userId: 'user-123',
      });
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(mockPost).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/login',
        { username: 'testuser', password: 'testpass' }
      );
    });

    it('should normalize hub URL by removing trailing slashes', async () => {
      const mockResponse = {
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          user_id: 'user-123',
        },
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      await service.signIn('https://hub.example.com///', 'user', 'pass');

      expect(mockPost).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/login',
        expect.any(Object)
      );
    });

    it('should add https:// prefix if missing', async () => {
      const mockResponse = {
        data: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          user_id: 'user-123',
        },
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      await service.signIn('hub.example.com', 'user', 'pass');

      expect(mockPost).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/login',
        expect.any(Object)
      );
    });

    it('should throw an error on sign in failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.signIn('https://hub.example.com', 'baduser', 'badpass')
      ).rejects.toThrow('Network error');
    });
  });

  describe('refresh', () => {
    it('should return a new HubSession on successful refresh', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          user_id: 'user-123',
        },
      };

      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await service.refresh(
        'https://hub.example.com',
        'old-refresh-token'
      );

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockPost).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/refresh',
        { refresh_token: 'old-refresh-token' }
      );
    });

    it('should throw an error on refresh failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Invalid refresh token'));

      await expect(
        service.refresh('https://hub.example.com', 'bad-token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('listServers', () => {
    it('should return a list of HubServers', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      const mockResponse = {
        data: {
          servers: [
            {
              server_id: 'server-1',
              server_name: 'My Server',
              version: '1.0.0',
              status: 'online',
              hostname: 'https://192.168.1.100:32400',
              relay_hostname: 'https://relay.phlex.app/server-1',
              capabilities: ['direct-play', 'transcode'],
            },
            {
              server_id: 'server-2',
              server_name: 'Offline Server',
              version: '0.9.0',
              status: 'offline',
              hostname: 'https://192.168.1.101:32400',
              capabilities: [],
            },
          ],
        },
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await service.listServers('https://hub.example.com', mockSession);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        serverId: 'server-1',
        serverName: 'My Server',
        version: '1.0.0',
        status: 'online',
        hostname: 'https://192.168.1.100:32400',
        relayHostname: 'https://relay.phlex.app/server-1',
        capabilities: ['direct-play', 'transcode'],
      });
      expect(result[1].relayHostname).toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/me/servers',
        {
          headers: { Authorization: 'Bearer valid-token' },
        }
      );
    });

    it('should return empty array when user has no servers', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({ data: { servers: [] } });

      const result = await service.listServers('https://hub.example.com', mockSession);

      expect(result).toEqual([]);
    });

    it('should throw an error when request fails', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(
        service.listServers('https://hub.example.com', mockSession)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('signOut', () => {
    it('should be a no-op function', () => {
      // signOut is a no-op since server-side invalidation happens via token expiry
      expect(() => service.signOut()).not.toThrow();
    });
  });
});
