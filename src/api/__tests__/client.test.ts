/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/client.test.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setActiveSessionId, absolutizeApiPath, apiErrorMessage } from '../client';
import { secureStorage } from '../../services/SecureStorage';
import { useSettingsStore } from '../../stores/useSettingsStore';

// Importing ../client constructs the ApiClient, which registers a request
// interceptor on the mocked axios instance. We pull that interceptor back out
// and run it against a fake config to assert the Phlix device headers.

const mockedAxios = axios as jest.Mocked<typeof axios>;

const keychainMock = jest.requireMock('react-native-keychain') as {
  __resetKeychainMock: () => void;
};

// The ApiClient is constructed once at import time and registers its request
// interceptor on the shared mocked axios instance. Capture that function BEFORE
// any jest.clearAllMocks() wipes the recorded calls.
let requestInterceptor: (config: any) => Promise<any>;
let responseErrorInterceptor: (error: any) => Promise<any>;
beforeAll(() => {
  const instance = mockedAxios.create();
  const use = instance.interceptors.request.use as unknown as jest.Mock;
  requestInterceptor = use.mock.calls[0][0];
  const responseUse = instance.interceptors.response.use as unknown as jest.Mock;
  // args: (onFulfilled, onRejected) — capture the 401 refresher.
  responseErrorInterceptor = responseUse.mock.calls[0][1];
});

const getRequestInterceptor = () => requestInterceptor;

const makeConfig = () => {
  const headerStore: Record<string, string> = {};
  return {
    headers: {
      set: (obj: Record<string, string>) => Object.assign(headerStore, obj),
      Authorization: undefined as string | undefined,
      _store: headerStore,
    },
  };
};

describe('ApiClient request interceptor', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    keychainMock.__resetKeychainMock();
    secureStorage.__resetMigrationLatchForTests();
    await AsyncStorage.clear();
    setActiveSessionId(undefined);
  });

  it('attaches X-Phlix-Device-Type matching the platform', async () => {
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    const expectedType = Platform.OS === 'ios' ? 'ios' : 'android';
    expect(config.headers._store['X-Phlix-Device-Type']).toBe(expectedType);
    expect(config.headers._store['X-Phlix-Device-ID']).toBeTruthy();
    expect(config.headers._store['X-Phlix-Device-Name']).toContain('Phlix Mobile');
  });

  // Law rotated by review mobile__exploiter M1 (per-origin token binding):
  // a bare stored token is NO LONGER attached unconditionally — the vault's
  // minted-host pin must match the dialled host. These three replace the
  // old "stored token → header" single test.
  it('attaches Authorization when the vault is bound to the dialled host', async () => {
    // Default test base (settings serverUrl '') resolves to
    // https://api.phlix.app — pin the pair to exactly that minting host.
    await secureStorage.storeTokens('tok-123', 'tok-ref', 'https://api.phlix.app');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    expect(config.headers._store.Authorization).toBe('Bearer tok-123');
  });

  it('refuses to carry a vault token to a host that did not mint it (credential ride)', async () => {
    await secureStorage.storeTokens('tok-of-A', 'tok-ref', 'https://victim-owned.example');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    // Dial target is the build-time default host; the pair belongs to
    // victim-owned.example → NO Authorization. Device headers still ride
    // (non-credential), which the device-type test above keeps pinning.
    expect(config.headers._store.Authorization).toBeUndefined();
  });

  it('fails CLOSED for legacy-migrated (pre-pin) tokens — no vouched origin, no ride', async () => {
    await AsyncStorage.setItem('access_token', 'tok-legacy');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    expect(config.headers._store.Authorization).toBeUndefined();
  });

  it('adds X-Phlix-Session-ID after setActiveSessionId', async () => {
    setActiveSessionId('sess-9');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    expect(config.headers._store['X-Phlix-Session-ID']).toBe('sess-9');
  });
});

// S407: subtitle rails carry a server-relative SIGNED path on the wire; the
// native player is handed a bare URI, so absolutizeApiPath is the single join
// point. Under jest, react-native-config is `{}` so the build-time root is the
// hardcoded default and `getServerRoot()` returns it when the store is unset.
describe('absolutizeApiPath (S407 signed-path join)', () => {
  beforeEach(async () => {
    await useSettingsStore.getState().setServerUrl('');
  });

  it('prefixes a server-relative signed path with the resolved root', () => {
    const abs = absolutizeApiPath(
      '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/0?exp=1800000000&sig=dGVzdC1zaWc',
    );
    expect(abs).toBe(
      'https://api.phlix.app/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/0?exp=1800000000&sig=dGVzdC1zaWc',
    );
  });

  it('passes an already-absolute URL through untouched (transcode synth rows)', () => {
    const url = 'https://cdn.example/master/subtitle_en.vtt?sig=abc';
    expect(absolutizeApiPath(url)).toBe(url);
  });

  it('honours a runtime server override', async () => {
    await useSettingsStore.getState().setServerUrl('https://home.lan:8096/');
    expect(absolutizeApiPath('/api/v1/media/9/subtitles/1')).toBe(
      'https://home.lan:8096/api/v1/media/9/subtitles/1',
    );
  });
});

// M2 — server/hub failures ride a contract body `{ error, code }`; the UI must
// quote THAT, not axios' transport sentence. M-MOBILE-34/52 — quoting became
// code-first: catalog copy beats server prose, and prose that does render is
// attributed and quarantined (a hostile server must not forge app copy).
describe('apiErrorMessage (contract error parsing, code-first)', () => {
  it('resolves a known wire code to app-owned copy, ignoring server prose', () => {
    expect(
      apiErrorMessage(
        {
          response: {
            data: { error: 're-enter your password at http://phish.example/login', code: 'auth.invalid_credentials' },
          },
        },
        'Login failed'
      )
    ).toBe('Invalid username or password.');
  });

  it('accepts the syncplay-lane error_code spelling', () => {
    expect(
      apiErrorMessage({ response: { data: { error: 'x', error_code: 'auth.account_pending' } } }, 'f')
    ).toBe('This account is waiting for an administrator to approve it.');
  });

  it('attributes unknown-code server prose and masks URLs inside it', () => {
    expect(
      apiErrorMessage(
        { response: { data: { error: 'Go to https://evil.test/re-auth now', code: 'brand.new_code' } } },
        'f'
      )
    ).toBe('Server says: Go to [link] now (brand.new_code)');
  });

  it('reads error alone (no code) through the quarantine lane', () => {
    expect(apiErrorMessage({ response: { data: { error: 'Account pending approval' } } }, 'f'))
      .toBe('Server says: Account pending approval');
  });

  it('caps long server prose and never passes control junk through', () => {
    const long = 'a'.repeat(300);
    expect(apiErrorMessage({ response: { data: { error: long } } }, 'f')).toHaveLength(
      'Server says: '.length + 140
    );
    // Malformed code shapes are dropped, not echoed, and never catalog-hit.
    expect(
      apiErrorMessage({ response: { data: { error: 'Boom', code: 'x'.repeat(200) } } }, 'f')
    ).toBe('Server says: Boom');
  });

  it('ignores non-string body junk and falls back to the Error message', () => {
    expect(apiErrorMessage({ response: { data: { error: 422 } }, message: 'Request failed' }, 'f'))
      .toBe('Request failed');
    expect(apiErrorMessage({}, 'Login failed')).toBe('Login failed');
    expect(apiErrorMessage(undefined, 'Login failed')).toBe('Login failed');
  });
});

// M3 — refresh failure must take the STORE down with the tokens: the vault
// wipe alone left `isAuthenticated` true and the UI phantom-logged-in.
describe('401 refresh-failure flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    keychainMock.__resetKeychainMock();
    secureStorage.__resetMigrationLatchForTests();
    await AsyncStorage.clear();
  });

  it('clears the vault and notifies listeners (auth store drops to signed-out)', async () => {
    // Import the store for its side-effect subscription on client.ts.
    const { useAuthStore } = require('../../stores/useAuthStore');
    // Law added with review mobile__exploiter M1: the refresh leg is refused
    // unless the vault's minted-host pin matches the dialled host, so this
    // test (refresh POST actually fires and fails) must pin the pair to the
    // host getBaseUrl() resolves to. Order: target first (any teardown the
    // auth-store subscription fires lands BEFORE the write below — vault
    // writes are chained by issuance order), then authenticate the store.
    await useSettingsStore.getState().setServerUrl('https://login.example');
    useAuthStore.setState({
      user: { id: 'u1', username: 'bob' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    await secureStorage.storeTokens('acc', 'ref-expired', 'https://login.example');
    // The refresh POST itself fails (offline / dead refresh token).
    mockedAxios.post.mockRejectedValueOnce(new Error('refresh offline'));

    await expect(
      responseErrorInterceptor({
        config: { headers: {} },
        response: { status: 401 },
      })
    ).rejects.toThrow('refresh offline');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().error).toMatch(/session expired/i);
    expect(await secureStorage.getAccessToken()).toBeNull();
  });

  // Core of review mobile__exploiter M1: on a 401 from host B, the refresh
  // leg must NOT POST host A's refresh token to B. The refusal happens
  // BEFORE any network write; the failure route then wipes the vault and
  // drops the store to signed-out (attacker B never sees the credential and
  // never gets to re-issue it).
  it('refuses to refresh across hosts: no POST, vault wiped, store signed out', async () => {
    const { useAuthStore } = require('../../stores/useAuthStore');
    await useSettingsStore.getState().setServerUrl('https://attacker.example');
    await secureStorage.storeTokens('acc-A', 'ref-A', 'https://victim-owned.example');
    useAuthStore.setState({
      user: { id: 'u1', username: 'bob' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    await expect(
      responseErrorInterceptor({
        config: { headers: {} },
        response: { status: 401 },
      })
    ).rejects.toThrow(/host/i);

    // The defining assertion: axios.post was NEVER called (no A-token to B).
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await AsyncStorage.getItem('phlix.access_issued_host')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('passes non-401 errors through untouched', async () => {
    await expect(
      responseErrorInterceptor({
        config: { headers: {} },
        response: { status: 500 },
      })
    ).rejects.toMatchObject({ response: { status: 500 } });
  });
});
