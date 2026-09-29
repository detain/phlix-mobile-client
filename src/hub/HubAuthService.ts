/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/hub/HubAuthService.ts
import axios, { AxiosInstance } from 'axios';

export interface HubSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export interface HubServer {
  serverId: string;
  serverName: string;
  version: string;
  status: 'online' | 'offline';
  hostname: string;
  relayHostname?: string;
  capabilities: string[];
}

interface SignInResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /**
   * The hub's `createAuthResponse()` returns the identity as a nested
   * `user: { id, username, email, ... }` object — NOT a top-level `user_id`.
   * The old code destructured a `user_id` that was never on the wire, so
   * `HubSession.userId` was always `undefined` (audit M4) and SettingsScreen
   * rendered "Signed in as {undefined}". `user` is optional only for
   * type-safety against older hubs; {@link resolveUserId} fails loud when a
   * sign-in truly yields no identity.
   */
  user?: { id?: string } & Record<string, unknown>;
  claims?: { sub?: string } & Record<string, unknown>;
  /** Legacy spelling some early hub builds carried; read only as a fallback. */
  user_id?: string;
}

interface ListServersResponse {
  servers: Array<{
    server_id: string;
    server_name: string;
    version: string;
    status: 'online' | 'offline';
    hostname: string;
    relay_hostname?: string;
    capabilities: string[];
  }>;
}

export class HubAuthService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Pull the caller's identity out of a hub auth response at the boundary.
   *
   * The current hub (`AuthController::loginJson`/`refreshJson` →
   * `createAuthResponse`) nests it as `user.id`; `claims.sub` (the JWT subject)
   * is the equivalent authority, and `user_id` is a legacy top-level spelling.
   * Parse in that order and fail loud when none is present: a session with no
   * id silently renders "Signed in as {undefined}" downstream (audit M4),
   * which is worse than an explicit error at sign-in.
   */
  private resolveUserId(data: SignInResponse): string {
    const userId =
      (typeof data.user?.id === 'string' && data.user.id !== '' ? data.user.id : undefined) ??
      (typeof data.claims?.sub === 'string' && data.claims.sub !== '' ? data.claims.sub : undefined) ??
      (typeof data.user_id === 'string' && data.user_id !== '' ? data.user_id : undefined);
    if (userId === undefined) {
      throw new Error('Hub sign-in response carried no user identity');
    }
    return userId;
  }

  /**
   * Sign in to the hub with username/password.
   * Returns a HubSession with access/refresh tokens.
   */
  async signIn(
    hubUrl: string,
    username: string,
    password: string
  ): Promise<HubSession> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.post<SignInResponse>(
      `${normalizedUrl}/api/v1/auth/login`,
      {
        username,
        password,
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + expires_in,
      userId: this.resolveUserId(response.data),
    };
  }

  /**
   * Refresh the hub JWT using the refresh token.
   */
  async refresh(hubUrl: string, refreshToken: string): Promise<HubSession> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.post<SignInResponse>(
      `${normalizedUrl}/api/v1/auth/refresh`,
      {
        refresh_token: refreshToken,
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + expires_in,
      userId: this.resolveUserId(response.data),
    };
  }

  /**
   * Get the list of servers claimed by the user.
   */
  async listServers(hubUrl: string, session: HubSession): Promise<HubServer[]> {
    const normalizedUrl = this.normalizeHubUrl(hubUrl);

    const response = await this.client.get<ListServersResponse>(
      `${normalizedUrl}/api/v1/me/servers`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    return response.data.servers.map((server) => ({
      serverId: server.server_id,
      serverName: server.server_name,
      version: server.version,
      status: server.status,
      hostname: server.hostname,
      relayHostname: server.relay_hostname,
      capabilities: server.capabilities,
    }));
  }

  /**
   * Sign out - clears the local session reference.
   * (Actual invalidation happens server-side via refresh token expiry)
   */
  signOut(): void {
    // No-op: local state cleared by the store
  }

  /**
   * Normalize hub URL - strip trailing slashes, ensure https.
   */
  private normalizeHubUrl(hubUrl: string): string {
    let url = hubUrl.replace(/\/+$/, '');
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = `https://${url}`;
    }
    return url;
  }
}

export const hubAuthService = new HubAuthService();
export default hubAuthService;
