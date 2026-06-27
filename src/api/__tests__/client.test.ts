// src/api/__tests__/client.test.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { setActiveSessionId } from '../client';

// Importing ../client constructs the ApiClient, which registers a request
// interceptor on the mocked axios instance. We pull that interceptor back out
// and run it against a fake config to assert the Phlix device headers.

const mockedAxios = axios as jest.Mocked<typeof axios>;

// The ApiClient is constructed once at import time and registers its request
// interceptor on the shared mocked axios instance. Capture that function BEFORE
// any jest.clearAllMocks() wipes the recorded calls.
let requestInterceptor: (config: any) => Promise<any>;
beforeAll(() => {
  const instance = mockedAxios.create();
  const use = instance.interceptors.request.use as unknown as jest.Mock;
  requestInterceptor = use.mock.calls[0][0];
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

  it('adds Authorization via the device-header builder when a token is stored', async () => {
    await AsyncStorage.setItem('access_token', 'tok-123');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    expect(config.headers._store.Authorization).toBe('Bearer tok-123');
  });

  it('adds X-Phlix-Session-ID after setActiveSessionId', async () => {
    setActiveSessionId('sess-9');
    const interceptor = getRequestInterceptor();
    const config = makeConfig();

    await interceptor(config);

    expect(config.headers._store['X-Phlix-Session-ID']).toBe('sess-9');
  });
});
