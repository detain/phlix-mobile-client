/* eslint-env jest */
// Jest setup file
import 'react-native-gesture-handler/jestSetup';

// reanimated 4 ships a jest mock at the package root (`react-native-reanimated/mock`).
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

// @notifee/react-native has no JS-only binding under jest — stub the full surface
// used by NotificationService.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('id'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn(),
    cancelAllNotifications: jest.fn(),
    requestPermission: jest.fn().mockResolvedValue({}),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    setBadgeCount: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  EventType: { PRESS: 1, DISMISSED: 0 },
}));

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
