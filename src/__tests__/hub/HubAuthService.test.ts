/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

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
          user: { id: 'user-123' },
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
          user: { id: 'user-123' },
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
          user: { id: 'user-123' },
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

    // M4 — identity resolution law. The hub's createAuthResponse() nests the
    // row as `user: { id, ... }`; these pins guard the parse order and the
    // fail-loud arm (the old code read a top-level `user_id` that was never on
    // the wire and silently stored `undefined`, blanking SettingsScreen).
    it('falls back to claims.sub when the response carries no user object', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 60,
          claims: { sub: 'claim-sub-9' },
        },
      });

      const result = await service.signIn('https://hub.example.com', 'u', 'p');

      expect(result.userId).toBe('claim-sub-9');
    });

    it('accepts the legacy top-level user_id as last resort', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 60,
          user_id: 'legacy-1',
        },
      });

      const result = await service.signIn('https://hub.example.com', 'u', 'p');

      expect(result.userId).toBe('legacy-1');
    });

    it('fails loud when the response carries no identity at all', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r', expires_in: 60 },
      });

      await expect(
        service.signIn('https://hub.example.com', 'u', 'p')
      ).rejects.toThrow('Hub sign-in response carried no user identity');
    });

    // MW-022 (review mobile__exploiter #6) — token boundary law. The hub's
    // `createAuthResponse()` ALWAYS answers `{access_token, refresh_token,
    // token_type, expires_in, user, claims}` (phlix-hub AuthController
    // loginJson/refreshJson at 30012378), but a non-conforming body used to
    // destructure straight into the session: `accessToken: undefined` got
    // persisted and every later call carried `Bearer undefined`. Parse, then
    // fail loud — a clear sign-in error beats a poisoned vault.
    it('fails loud when access_token is missing', async () => {
      mockPost.mockResolvedValueOnce({
        data: { refresh_token: 'r', expires_in: 60, user: { id: 'u1' } },
      });

      await expect(
        service.signIn('https://hub.example.com', 'u', 'p')
      ).rejects.toThrow(/access_token/);
    });

    it('fails loud when a token arrives as a non-string', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 42, refresh_token: 'r', expires_in: 60, user: { id: 'u1' } },
      });

      await expect(
        service.signIn('https://hub.example.com', 'u', 'p')
      ).rejects.toThrow(/access_token/);
    });

    it('fails loud when expires_in is not a finite number', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } },
      });

      await expect(
        service.signIn('https://hub.example.com', 'u', 'p')
      ).rejects.toThrow(/expires_in/);
    });
  });

  describe('refresh', () => {
    it('should return a new HubSession on successful refresh', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          user: { id: 'user-123' },
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

    // MW-022 — the refresh leg answers with the SAME envelope (hub
    // refreshJson → createAuthResponse), so it carries the SAME boundary law.
    it('fails loud when the refresh envelope carries no usable refresh_token', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'a', expires_in: 60, claims: { sub: 's1' } },
      });

      await expect(
        service.refresh('https://hub.example.com', 'old')
      ).rejects.toThrow(/refresh_token/);
    });
  });

  describe('listServers', () => {
    // MW-022 (review mobile__exploiter #5 + the S181-style body-shape pin the
    // campaign demands): `GET /api/v1/me/servers` answers with
    // `{servers: ServerInfoDto::toPayload()[]}` — CAMEL CASE keys, and the
    // address family on the wire is `hostnameCandidates` (list of full
    // scheme://host:port URLs minted by the server's own HubClient), NOT the
    // snake_case `{server_id, server_name, hostname, relay_hostname,
    // capabilities}` this file used to fabricate. Provenance, all re-read on
    // disk at hub @30012378: ServerListController.php:46-61 (the envelope),
    // vendor/detain/phlix-shared/src/Hub/ServerInfoDto.php:139-153
    // (`toPayload()` — the body), and the hub's own best-direct law
    // "first non-empty candidate" (ServerManageController::bestDirectUrl).
    // The old fixture + mapping were bug-encoding tests: against a REAL hub
    // every field resolved `undefined` and direct-mode sign-in TypeErrored
    // inside resolveEffectiveUrl. Flipped to the wire law; the snake_case
    // spelling is dead — these pins fail loudly if it ever returns.
    const realWireRow = {
      serverId: 'srv-1',
      userId: 'user-123',
      serverName: 'My Server',
      version: '1.0.0',
      lastSeenAt: 1780000000,
      status: 'online',
      hostnameCandidates: ['https://192.168.1.100:32400', 'http://10.0.0.5:8096'],
      relayActive: true,
      libraryCount: 2,
      subdomain: 'my-server',
    };

    it('maps the REAL hub wire body (camelCase ServerInfoDto payload)', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({ data: { servers: [realWireRow] } });

      const result = await service.listServers('https://hub.example.com', mockSession);

      expect(result).toEqual([
        {
          serverId: 'srv-1',
          serverName: 'My Server',
          version: '1.0.0',
          status: 'online',
          hostname: 'https://192.168.1.100:32400',
        },
      ]);
      expect(mockGet).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/me/servers',
        {
          headers: { Authorization: 'Bearer valid-token' },
        }
      );
    });

    it('collapses every non-online hub status convention to offline', async () => {
      // ServerInfoDto documents STATUS_* (online|offline|claiming|disabled)
      // as "conventions NOT gates" — the mobile surface is a two-state union,
      // so the parse maps 'online' through and everything else to 'offline'
      // rather than lying to the type system about an unchecked cast.
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({
        data: {
          servers: [
            { ...realWireRow, serverId: 'srv-claiming', status: 'claiming' },
            { ...realWireRow, serverId: 'srv-disabled', status: 'disabled' },
          ],
        },
      });

      const result = await service.listServers('https://hub.example.com', mockSession);

      expect(result.map((s) => s.status)).toEqual(['offline', 'offline']);
    });

    it('degrades hostname to the empty string when candidates are missing or junk', async () => {
      // No usable candidate => the M-MOBILE-49 scheme gate in
      // resolveEffectiveUrl already owns the ''-means-no-direct-lane law;
      // the parse must hand it '' (a STRING), never undefined.
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({
        data: {
          servers: [
            { ...realWireRow, serverId: 'srv-none', hostnameCandidates: [] },
            { ...realWireRow, serverId: 'srv-junk', hostnameCandidates: null },
          ],
        },
      });

      const result = await service.listServers('https://hub.example.com', mockSession);

      expect(result.map((s) => s.hostname)).toEqual(['', '']);
    });

    it('fails loud when the body carries no servers array', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({ data: {} });

      await expect(
        service.listServers('https://hub.example.com', mockSession)
      ).rejects.toThrow(/servers.*array|array.*servers/i);
    });

    it('fails loud on a row without a usable serverId', async () => {
      const mockSession = {
        accessToken: 'valid-token',
        refreshToken: 'refresh',
        expiresAt: Date.now() / 1000 + 3600,
        userId: 'user-123',
      };

      mockGet.mockResolvedValueOnce({
        data: { servers: [{ ...realWireRow, serverId: undefined }] },
      });

      await expect(
        service.listServers('https://hub.example.com', mockSession)
      ).rejects.toThrow(/serverId/);
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
    // M-MOBILE-53d replaced the literal no-op: sign-out must fire the hub's
    // JSON revocation leg (204; cuts the refresh-token lineage) while
    // swallowing every failure so the caller's local wipe always proceeds.
    const session = {
      accessToken: 'hub-access',
      refreshToken: 'hub-refresh',
      expiresAt: 1234567890,
      userId: 'user-123',
    };

    it('POSTs /api/v1/auth/logout with the refresh token and bearer', async () => {
      mockPost.mockResolvedValueOnce({ status: 204 });

      await expect(
        service.signOut('https://hub.example.com', session)
      ).resolves.toBeUndefined();

      expect(mockPost).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/logout',
        { refresh_token: 'hub-refresh' },
        { headers: { Authorization: 'Bearer hub-access' } }
      );
    });

    it('swallows a failing revoke leg (offline hub must not block sign-out)', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.signOut('https://hub.example.com', session)
      ).resolves.toBeUndefined();
    });
  });
});

// MW-025 (review mobile__casualgamer #4): the Settings screen rendered
// "Signed in as {36-char account UUID}" because the session only ever kept
// `user.id`. The hub's createAuthResponse (phlix-hub AuthManager.php:673-688
// at 30012378) nests the CURRENT_USER row minus the password hash — `username`
// and `email` are ON this wire — so the boundary parse carries a friendly
// display name when the hub provides one, and NOTHING is invented when it
// does not (an absent identity stays absent; the UI picks a label).
describe('HubAuthService display identity (MW-025)', () => {
  const identityService = new HubAuthService();

  const authEnvelope = (user: Record<string, unknown>) => ({
    data: {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      user,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carries the hub username as the friendly display name', async () => {
    mockPost.mockResolvedValueOnce(
      authEnvelope({ id: 'user-123', username: 'ada', email: 'ada@example.com' })
    );

    const session = await identityService.signIn('https://hub.example.com', 'ada', 'pw');

    expect(session.displayName).toBe('ada');
    expect(session.userId).toBe('user-123');
  });

  it('falls back to the email when the row carries no username', async () => {
    mockPost.mockResolvedValueOnce(
      authEnvelope({ id: 'user-123', email: 'ada@example.com' })
    );

    const session = await identityService.signIn('https://hub.example.com', 'ada', 'pw');

    expect(session.displayName).toBe('ada@example.com');
  });

  it('invents nothing when the hub carries neither name nor email', async () => {
    mockPost.mockResolvedValueOnce(authEnvelope({ id: 'user-123' }));

    const session = await identityService.signIn('https://hub.example.com', 'ada', 'pw');

    expect(session.displayName).toBeUndefined();
  });

  it('the refresh envelope carries it too (same createAuthResponse leg)', async () => {
    mockPost.mockResolvedValueOnce(
      authEnvelope({ id: 'user-123', username: 'ada', email: 'ada@example.com' })
    );

    const session = await identityService.refresh('https://hub.example.com', 'r');

    expect(session.displayName).toBe('ada');
  });
});
