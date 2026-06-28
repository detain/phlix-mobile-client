// src/api/client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  buildPhlixHeaders,
  type DeviceType,
} from '../types/contracts';
import { getCachedDeviceId, getDeviceName } from './deviceIdentity';

// Build-time default from react-native-config env var
// Self-hosted users can set PHLIX_BASE_URL in their .env file
const BUILD_TIME_BASE_URL = Config.PHLIX_BASE_URL || 'https://api.phlix.app';

// Every API route lives under `/api/v1` on the server. We append it to the
// resolved root so managers call bare paths (`/libraries`, `/media`, ...). The
// signed `stream_url` is an ABSOLUTE URL and bypasses axios `baseURL` entirely.
const API_PREFIX = '/api/v1';

/**
 * Gets the effective server ROOT (no `/api/v1` suffix).
 * Priority:
 * 1. Runtime override from settings store (serverUrl)
 * 2. Build-time env var (PHLIX_BASE_URL from .env via react-native-config)
 * 3. Hardcoded default
 */
const getServerRoot = (): string => {
  const settingsUrl = useSettingsStore.getState().serverUrl;
  const root = settingsUrl && settingsUrl.trim() !== '' ? settingsUrl.trim() : BUILD_TIME_BASE_URL;
  // Normalize: strip trailing slash so prefix joins cleanly.
  return root.replace(/\/+$/, '');
};

/** Effective axios base URL including the `/api/v1` prefix. */
const getBaseUrl = (): string => `${getServerRoot()}${API_PREFIX}`;

/**
 * Public helpers for callers that must issue a RAW (non-axios) request — e.g.
 * the Live TV stream-redirect resolve in `LiveTvManager.getChannelStreamUrl`,
 * which needs `fetch(absoluteUrl, { redirect: 'manual' })` to read the
 * `location` header (axios silently follows redirects). These mirror the URL +
 * header construction the axios interceptor performs on every request.
 */

/** Absolute API base URL (server root + `/api/v1`). */
export const getApiBaseUrl = (): string => getBaseUrl();

/**
 * Build the same Phlix device + auth headers the axios interceptor attaches,
 * for a manual `fetch`. Reads the access token from AsyncStorage.
 */
export const buildRequestHeaders = async (): Promise<Record<string, string>> => {
  const token = await AsyncStorage.getItem('access_token');
  return buildPhlixHeaders({
    deviceId: getCachedDeviceId(),
    deviceName: getDeviceName(),
    deviceType: DEVICE_TYPE,
    sessionId: activeSessionId,
    token: token ?? undefined,
  });
};

// `X-Phlix-Device-Type` value — server maps android|ios → mobile-high profile.
const DEVICE_TYPE: DeviceType = Platform.OS === 'ios' ? 'ios' : 'android';

// Active session id (set after the player opens a session). Sent as
// `X-Phlix-Session-ID` for forward-compat; absence is fine.
let activeSessionId: string | undefined;

/** Set (or clear) the active session id used for the `X-Phlix-Session-ID` header. */
export const setActiveSessionId = (id: string | null | undefined): void => {
  activeSessionId = id ?? undefined;
};

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: getBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - keep baseURL in sync with settings + attach the
    // Phlix device headers and the bearer token on every request.
    this.client.interceptors.request.use(
      async (config) => {
        // Re-resolve base URL so a runtime server change takes effect.
        config.baseURL = getBaseUrl();

        const token = await AsyncStorage.getItem('access_token');
        const deviceHeaders = buildPhlixHeaders({
          deviceId: getCachedDeviceId(),
          deviceName: getDeviceName(),
          deviceType: DEVICE_TYPE,
          sessionId: activeSessionId,
          token: token ?? undefined,
        });
        // Merge device + auth headers without clobbering per-call headers
        // (e.g. Content-Type). buildPhlixHeaders sets Authorization when a token
        // is present, so we do not set it separately.
        config.headers.set(deviceHeaders);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as
          | (InternalAxiosRequestConfig & { _retry?: boolean })
          | undefined;

        // Refresh + replay ONCE per request: a persistent 401 on the replay must
        // not re-enter the interceptor and loop refreshing forever.
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Logout user
            await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Hit the real `/api/v1/auth/refresh` route (getBaseUrl includes /api/v1).
      const response = await axios.post(`${getBaseUrl()}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      await AsyncStorage.setItem('access_token', access_token);
      if (newRefreshToken) {
        await AsyncStorage.setItem('refresh_token', newRefreshToken);
      }

      return access_token;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  // Generic HTTP methods
  async get<T>(url: string, params?: object): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post<T>(
    url: string,
    data?: object,
    config?: { headers?: Record<string, string>; params?: object },
  ): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: object): Promise<T> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  // `config` lets a caller send a request BODY on a DELETE (the documented axios
  // form: `client.delete(url, { data })`). Used by AdminManager.removeCatalogSource
  // where the server expects `DELETE /admin/plugins/catalog/sources` body `{url}`.
  async delete<T>(
    url: string,
    config?: { data?: object; params?: object; headers?: Record<string, string> },
  ): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
