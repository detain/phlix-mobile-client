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
  user_id: string;
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

    const { access_token, refresh_token, expires_in, user_id } = response.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + expires_in,
      userId: user_id,
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

    const { access_token, refresh_token, expires_in, user_id } = response.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + expires_in,
      userId: user_id,
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
