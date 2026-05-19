/* eslint-env jest */
// Jest setup file
import 'react-native-gesture-handler/jestSetup';

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
