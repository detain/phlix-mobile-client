module.exports = {
  testEnvironment: 'node',
  preset: '@react-native/jest-preset',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    // `@phlix/*` ship ESM (`"type": "module"`); allow Babel to transform them in
    // case the resolver picks the ESM entry over the CJS `main`.
    // reanimated 4 + its new worklets peer + notifee ship untranspiled ESM/Flow
    // and must be Babel-transformed under jest.
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-worklets|react-native-reanimated|@notifee|zustand|@phlix)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
