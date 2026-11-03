/* eslint-env jest */
// Jest setup file
import 'react-native-gesture-handler/jestSetup';

// reanimated 4 ships a jest mock at the package root (`react-native-reanimated/mock`).
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// @notifee/react-native has no JS-only binding under jest — stub the full surface
// used by NotificationService.
jest.mock('@notifee/react-native', () => {
  const mockFn = jest.fn();
  const mockResolvedFn = jest.fn().mockResolvedValue(undefined);
  const mockFnWithResolved = (resolvedValue) => jest.fn().mockResolvedValue(resolvedValue);

  return {
    __esModule: true,
    default: {
      createChannel: mockFnWithResolved('id'),
      displayNotification: mockResolvedFn,
      cancelNotification: mockFn,
      cancelAllNotifications: mockFn,
      requestPermission: mockFnWithResolved({}),
      onForegroundEvent: jest.fn(() => () => {}),
      onBackgroundEvent: mockFn,
      setBadgeCount: mockFnWithResolved(undefined),
    },
    createChannel: mockFnWithResolved('id'),
    displayNotification: mockResolvedFn,
    cancelNotification: mockFn,
    cancelAllNotifications: mockFn,
    requestPermission: mockFnWithResolved({}),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: mockFn,
    setBadgeCount: mockFnWithResolved(undefined),
    AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
    EventType: { PRESS: 1, DISMISSED: 0 },
  };
});

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.UIManager = RN.NativeModules.UIManager || {};
  RN.NativeModules.UIManager.RCTView = RN.NativeModules.UIManager.RCTView || {};
  return RN;
});

// Mock the native modules
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-config (build-time env shim — no native binding under jest)
jest.mock('react-native-config', () => ({}));

// In-memory react-native-keychain stand-in: the token vault (services/
// SecureStorage.ts) reads/writes generic passwords per service; tests drive it
// through the same API and reset it via __resetKeychainMock(). getGenericPassword
// resolves `false` for an empty slot, exactly like the native module.
jest.mock('react-native-keychain', () => {
  const store = new Map();
  const serviceOf = (options) => (options && options.service) || '__default__';
  return {
    __esModule: true,
    getGenericPassword: jest.fn(async (options) => {
      const value = store.get(serviceOf(options));
      if (value === undefined) {
        return false;
      }
      return { service: serviceOf(options), username: 'phlix', password: value, storage: 'jest-memory' };
    }),
    setGenericPassword: jest.fn(async (username, password, options) => {
      store.set(serviceOf(options), password);
      return true;
    }),
    resetGenericPassword: jest.fn(async (options) => store.delete(serviceOf(options))),
    ACCESS_CONTROL: { BIOMETRY_ANY: 'BiometryAny' },
    ACCESSIBLE: {
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
      // Vault token slots (review mobile__secnet m13) — same enum shape as
      // the real module so tests can observe which class a write pinned.
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
    },
    __resetKeychainMock: () => store.clear(),
  };
});

// M3 (deferred lane): netinfo stand-in for the data-plan guard. In-memory
// current state feeds fetch() and pushes to subscribers; tests flip the
// network via `require('@react-native-community/netinfo').__setNetwork(...)`
// (listeners fire synchronously, mirroring the real module's emit-on-change).
jest.mock('@react-native-community/netinfo', () => {
  const wifiState = () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  });
  let current = wifiState();
  const listeners = new Set();
  const netinfo = {
    fetch: jest.fn(async () => current),
    refresh: jest.fn(async () => current),
    addEventListener: jest.fn((cb) => {
      listeners.add(cb);
      cb(current);
      return () => listeners.delete(cb);
    }),
    configure: jest.fn(),
    useNetInfo: () => current,
    NetInfoStateType: {
      unknown: 'unknown', none: 'none', cellular: 'cellular', wifi: 'wifi',
      bluetooth: 'bluetooth', ethernet: 'ethernet', wimax: 'wimax', vpn: 'vpn', other: 'other',
    },
    __setNetwork: (patch) => {
      current = { ...current, ...patch };
      listeners.forEach((cb) => cb(current));
    },
    __resetNetwork: () => {
      current = wifiState();
      // Deliberately KEEP subscribers (services hold their unsubscribe across
      // tests) and push the reset state to them, mirroring a real Wi-Fi join.
      listeners.forEach((cb) => cb(current));
    },
  };
  return { __esModule: true, default: netinfo, ...netinfo };
});

// Mock axios
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), handlers: [] },
      response: { use: jest.fn(), handlers: [] },
    },
  };

  const mockCreate = jest.fn(() => mockInstance);

  // Return a function/object that has both callable and property access
  const axiosMock = function(...args) {
    return mockCreate(...args);
  };
  axiosMock.get = mockInstance.get;
  axiosMock.post = mockInstance.post;
  axiosMock.put = mockInstance.put;
  axiosMock.delete = mockInstance.delete;
  axiosMock.create = mockCreate;
  axiosMock.interceptors = mockInstance.interceptors;

  return axiosMock;
});
