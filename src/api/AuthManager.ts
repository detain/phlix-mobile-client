// src/api/AuthManager.ts
import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from './deviceIdentity';

export interface User {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  is_admin?: boolean;
}

/**
 * Token envelope returned by `/api/v1/auth/login|register|refresh`.
 * There is NO `server` field — the connection target (serverUrl) is an INPUT,
 * stored separately in settings/auth state, never read from the response.
 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

/** `/api/v1/auth/register` may return the token envelope OR a pending status. */
export interface RegisterPending {
  status: 'pending';
  message: string;
}

export type RegisterResponse = LoginResponse | RegisterPending;

class AuthManager {
  // Server discovery is not yet implemented (would need a native UDP module).
  async discoverServers(): Promise<never[]> {
    return [];
  }

  // Login with username/password → POST /api/v1/auth/login
  // serverUrl is the connection target; the caller persists it in settings.
  async login(_serverUrl: string, username: string, password: string): Promise<LoginResponse> {
    const deviceId = await getDeviceId();
    const response = await apiClient.post<LoginResponse>(
      '/auth/login',
      { username, password },
      { headers: { 'X-Device-Id': deviceId } }
    );

    await this.saveCredentials(response);
    return response;
  }

  // Register a new account → POST /api/v1/auth/register
  async register(
    _serverUrl: string,
    username: string,
    email: string,
    password: string
  ): Promise<RegisterResponse> {
    const deviceId = await getDeviceId();
    const response = await apiClient.post<RegisterResponse>(
      '/auth/register',
      { username, email, password },
      { headers: { 'X-Device-Id': deviceId } }
    );

    if (this.isTokenResponse(response)) {
      await this.saveCredentials(response);
    }
    return response;
  }

  // Persist a passwordless (passkey) login envelope through the SAME credential
  // store path password login uses (E10e). The WebAuthn login/verify endpoint
  // returns { access_token, refresh_token, user } (no token_type/expires_in),
  // which is the subset saveCredentials persists — so a passkey login leaves the
  // app in the identical authenticated state. Returns the User for the caller to
  // hand to the auth store.
  async savePasskeyLogin(result: {
    access_token: string;
    refresh_token: string;
    user: User;
  }): Promise<User> {
    await this.saveCredentials(result as LoginResponse);
    return result.user;
  }

  // Refresh access token → POST /api/v1/auth/refresh
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    await this.saveCredentials(response);
    return response;
  }

  // Current user → GET /api/v1/auth/me → { user }
  async getMe(): Promise<User> {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    await AsyncStorage.setItem('user', JSON.stringify(res.user));
    return res.user;
  }

  private isTokenResponse(res: RegisterResponse): res is LoginResponse {
    return (res as LoginResponse).access_token !== undefined;
  }

  private async saveCredentials(data: LoginResponse): Promise<void> {
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
  }

  // Logout: the REST API has no required logout (legacy /auth/logout is the
  // browser cookie flow). Just clear local credentials.
  async logout(): Promise<void> {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('access_token');
    return !!token;
  }

  // Get current user from local cache
  async getCurrentUser(): Promise<User | null> {
    const userData = await AsyncStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }
}

export const authManager = new AuthManager();
export default authManager;
