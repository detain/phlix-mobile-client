/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/client.ts
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useConnectionSecurityStore } from '../stores/useConnectionSecurityStore';
import { secureStorage } from '../services/SecureStorage';
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
  // M-MOBILE-51 (review mobile__secnet m3): every REST dial derives from
  // here, so this is the lane's honest REPORT seam — cleartext becomes the
  // visible fact it should be (write-gated; see the store's law header).
  useConnectionSecurityStore.getState().mark('rest', root);
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
 * S407: Absolutize a server-relative wire path against the resolved server
 * root. The playback-info subtitle rows carry a SIGNED PATH
 * (`/api/v1/media/{id}/subtitles/{ordinal}?exp&sig` — StreamTrackShaper), but
 * the native players are handed a bare URI (no axios baseURL involved), so a
 * relative path would never resolve on-device. Rows that are already absolute
 * (the transcode-synth VTT URLs) pass through untouched. This is the single
 * choke point for that join — callers pass the raw wire `url`, never a
 * hand-joined literal.
 */
export const absolutizeApiPath = (pathOrUrl: string): string => {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${getServerRoot()}${pathOrUrl}`;
};

/**
 * Build the same Phlix device + auth headers the axios interceptor attaches,
 * for a manual `fetch`. Reads the access token from the vault (keychain).
 */
export const buildRequestHeaders = async (): Promise<Record<string, string>> => {
  const token = await secureStorage.getAccessToken();
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

// ── Auth-failure plumbing (audit M2/M3, M-MOBILE-34/52) ────────────────────

/**
 * App-owned copy for the stable wire codes the auth/session REST surface can
 * carry. Keys are the machine codes in the contracts registry
 * (`@phlix/contracts` error-codes.json — the wire SSOT; clients localize by
 * code, server message text is debug fallback — that file's own doctrine).
 *
 * Rationale (review M-MOBILE-34, M-MOBILE-52): a malicious or misconfigured
 * server could previously print arbitrary sentences — including URLs and
 * "re-enter your password at…" phishing prose — straight into the login
 * banner, indistinguishable from app copy. The syncplay lane already solved
 * the same problem code-first (`describeSyncPlayError`); the REST lane now
 * follows the same precedence: catalog hit for the code → quarantined server
 * text → generic fallback.
 */
const REST_ERROR_USER_MESSAGES: Readonly<Record<string, string>> = {
  'auth.invalid_credentials': 'Invalid username or password.',
  'auth.user_not_found': 'No account with that username exists on this server.',
  'auth.account_pending': 'This account is waiting for an administrator to approve it.',
  'auth.account_disabled': 'This account has been disabled on the server.',
  'auth.password_change_required': 'This account must change its password before signing in.',
  'auth.signups_disabled': 'This server is not accepting new accounts.',
  'auth.missing_credentials': 'Enter both a username and a password.',
  'auth.invalid_token': 'Your sign-in token is no longer valid. Sign in again.',
  'auth.required': 'Sign in to continue.',
  'auth.unauthenticated': 'Sign in to continue.',
  'auth.not_admin': 'This action needs a server administrator account.',
  'auth.server_mismatch': 'This sign-in belongs to a different server.',
  'auth.enrollment_expired': 'That enrollment has expired. Sign in again.',
  'unauthorized': 'Sign in to continue.',
  'hub.jwt_invalid': 'The hub rejected your session. Sign in to the hub again.',
  'hub.token_required': 'Sign in to the hub first.',
  'hub.not_enrolled': 'This hub account is not enrolled for that operation.',
  'hub.protocol_unsupported': 'This hub version does not support that operation.',
};

/** Wire-code shape: dotted lowercase snake tokens (plus legacy SCREAMING
 * twins). Anything else never reaches the user — it may itself be injected. */
const MACHINE_CODE_SHAPE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

/** Cap for server-sourced prose rendered in the UI — long enough for honest
 * sentences, short enough that walls of text can't impersonate the app. */
const QUARANTINE_MAX = 140;

/**
 * Render untrusted server prose safe for display: URLs masked, control and
 * zero-width characters dropped, whitespace collapsed to a single line, and
 * the whole thing capped. This is the fallback lane, not the primary one —
 * codes with catalog copy never come through here.
 */
export const quarantineServerProse = (raw: string): string => {
  const urlMasked = raw.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]');
  // The sanitizer's whole job is removing control/zero-width characters, so
  // the `no-control-regex` rule describes the intent, not a defect.
  // eslint-disable-next-line no-control-regex
  const printable = urlMasked.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]+/g, ' ');
  const collapsed = printable.replace(/\s+/g, ' ').trim();
  return collapsed.length > QUARANTINE_MAX
    ? collapsed.slice(0, QUARANTINE_MAX - 1) + '…'
    : collapsed;
};

/** First candidate that is actually a non-empty string (boundary read). */
function firstWireString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Contract-error bodies: both the server (`AuthController`) and the hub
 * (`Response::error`) answer failures with `{ error: <human message>, code:
 * <stable machine code> }` (the syncplay rails spell the code `error_code`).
 * axios only ever surfaces "Request failed with status code 4xx", so the body
 * must be parsed at this boundary (audit M2) — but the body is server input,
 * so it no longer renders verbatim (M-MOBILE-34/52). Precedence:
 * catalog copy for a known code → `Server says:`-attributed quarantined
 * server text (code appended when it is a well-formed machine code) → the
 * thrown message (also quarantined) → caller fallback.
 */
export const apiErrorMessage = (error: unknown, fallback: string): string => {
  const body = (
    error as
      | AxiosError<{ error?: unknown; code?: unknown; error_code?: unknown; message?: unknown }>
      | undefined
  )?.response?.data;
  const code = firstWireString(body?.error_code, body?.code);
  if (code !== undefined && MACHINE_CODE_SHAPE.test(code)) {
    const catalogCopy = REST_ERROR_USER_MESSAGES[code];
    if (catalogCopy !== undefined) {
      return catalogCopy;
    }
  }
  const serverText = firstWireString(body?.error, body?.message);
  if (serverText !== undefined) {
    const quarantined = quarantineServerProse(serverText);
    if (quarantined !== '') {
      const codeSuffix = code !== undefined && MACHINE_CODE_SHAPE.test(code) ? ` (${code})` : '';
      return `Server says: ${quarantined}${codeSuffix}`;
    }
  }
  // Axios errors are `instanceof Error`, but re-thrown JSON (RN fetch paths)
  // arrives as a plain `{ message }` object — accept either shape. The
  // message may originate from server parsing upstream, so it is quarantined
  // too; an empty result (pure control junk) falls through to `fallback`.
  const thrown = (error as { message?: unknown } | undefined)?.message;
  if (typeof thrown === 'string' && thrown !== '') {
    return quarantineServerProse(thrown) !== '' ? quarantineServerProse(thrown) : fallback;
  }
  return fallback;
};

type AuthInvalidatedListener = () => void;
const authInvalidatedListeners = new Set<AuthInvalidatedListener>();

/**
 * Register a listener fired when the refresh flow proves the session dead
 * (refresh call failed → tokens cleared). The auth store subscribes so the
 * Zustand state drops to signed-out together with the credential wipe —
 * clearing tokens while `isAuthenticated` stayed true was audit M3. Returns an
 * unsubscribe function.
 */
export const onAuthInvalidated = (listener: AuthInvalidatedListener): (() => void) => {
  authInvalidatedListeners.add(listener);
  return () => authInvalidatedListeners.delete(listener);
};

const notifyAuthInvalidated = (): void => {
  for (const listener of [...authInvalidatedListeners]) {
    try {
      listener();
    } catch (error) {
      console.error('ApiClient: auth-invalidated listener threw', error);
    }
  }
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

        const token = await secureStorage.getAccessToken();
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
            // Refresh proved the session dead: wipe the vault and tell the
            // auth store so `isAuthenticated` drops with the credentials
            // (audit M3 — clearing tokens while the store stayed logged-in
            // left the UI in a phantom-authenticated state).
            await secureStorage.clearTokens();
            notifyAuthInvalidated();
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
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Hit the real `/api/v1/auth/refresh` route (getBaseUrl includes /api/v1).
      // The S280 gate pins the axios call to keep its literal
      // `${getBaseUrl()}` URL form, so the pin snapshot is taken in the SAME
      // synchronous tick as the dial — JS evaluates both calls with no await
      // between them, making `dialedBase` exactly the base being dialled: the
      // host that serves this issuance is what re-pins the rotated pair
      // (review mobile__exploiter M2).
      const dialedBase = getBaseUrl();
      const response = await axios.post(`${getBaseUrl()}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // The vault holds the pair atomically; a rotation that omits a new
      // refresh token re-presents the current one rather than dropping it.
      await secureStorage.storeTokens(
        access_token,
        newRefreshToken || refreshToken,
        dialedBase
      );

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
