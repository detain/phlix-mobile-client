// src/api/hubAwareClient.ts
/**
 * Hub-Aware API Client
 *
 * Wraps the base API client to route requests through either:
 * - Direct mode: calls go directly to the server's hostname
 * - Relay mode: calls go through the hub relay endpoint
 *
 * Headers injected:
 * - Authorization: Bearer <hub-session-jwt> (on relay calls)
 * - X-Server-Id: <server-id> (on relay calls)
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useHubStore } from '../store/hubStore';

class HubAwareClient {
  private directClient: AxiosInstance;
  private relayClient: AxiosInstance;

  constructor() {
    // Client for direct-mode server calls
    this.directClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Client for relay-mode hub calls
    this.relayClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Determine the base URL for a request based on hub store state.
   */
  private getBaseUrl(): string {
    const { effectiveServerUrl, hubUrl, activeServerId, connectionMode } =
      useHubStore.getState();

    if (!effectiveServerUrl) {
      // Fall back to direct server URL from auth store or default
      return '';
    }

    if (connectionMode === 'relay' && hubUrl && activeServerId) {
      // Route through hub relay: https://hub.example.com/api/v1/relay/<server-id>/<path>
      return `${hubUrl.replace(/\/+$/, '')}/api/v1/relay/${activeServerId}`;
    }

    // Direct mode - use the server's hostname
    return effectiveServerUrl.replace(/\/+$/, '');
  }

  /**
   * Get headers for the current request based on connection mode.
   */
  private getHeaders(connectionMode: 'direct' | 'relay'): Record<string, string> {
    const { session, activeServerId } = useHubStore.getState();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (connectionMode === 'relay') {
      // Inject hub session JWT on relay calls
      if (session?.accessToken) {
        headers['Authorization'] = `Bearer ${session.accessToken}`;
      }
      // Inject server ID for relay routing
      if (activeServerId) {
        headers['X-Server-Id'] = activeServerId;
      }
    }

    return headers;
  }

  /**
   * Build the full URL for a request.
   */
  private buildUrl(path: string): string {
    const baseUrl = this.getBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  /**
   * Execute a GET request.
   */
  async get<T>(path: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
    const { connectionMode } = useHubStore.getState();
    const headers = this.getHeaders(connectionMode);
    const url = this.buildUrl(path);

    const response = await axios.get<T>(url, {
      ...config,
      params,
      headers: { ...headers, ...config?.headers },
    });

    return response.data;
  }

  /**
   * Execute a POST request.
   */
  async post<T>(path: string, data?: object, config?: AxiosRequestConfig): Promise<T> {
    const { connectionMode } = useHubStore.getState();
    const headers = this.getHeaders(connectionMode);
    const url = this.buildUrl(path);

    const response = await axios.post<T>(url, data, {
      ...config,
      headers: { ...headers, ...config?.headers },
    });

    return response.data;
  }

  /**
   * Execute a PUT request.
   */
  async put<T>(path: string, data?: object, config?: AxiosRequestConfig): Promise<T> {
    const { connectionMode } = useHubStore.getState();
    const headers = this.getHeaders(connectionMode);
    const url = this.buildUrl(path);

    const response = await axios.put<T>(url, data, {
      ...config,
      headers: { ...headers, ...config?.headers },
    });

    return response.data;
  }

  /**
   * Execute a DELETE request.
   */
  async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const { connectionMode } = useHubStore.getState();
    const headers = this.getHeaders(connectionMode);
    const url = this.buildUrl(path);

    const response = await axios.delete<T>(url, {
      ...config,
      headers: { ...headers, ...config?.headers },
    });

    return response.data;
  }

  /**
   * Check if hub mode is active (signed in to hub with an active server).
   */
  isHubModeActive(): boolean {
    const { hubUrl, session, activeServerId, effectiveServerUrl } =
      useHubStore.getState();
    return !!(hubUrl && session && activeServerId && effectiveServerUrl);
  }

  /**
   * Get the current connection mode.
   */
  getConnectionMode(): 'direct' | 'relay' {
    return useHubStore.getState().connectionMode;
  }
}

export const hubAwareClient = new HubAwareClient();
export default hubAwareClient;
