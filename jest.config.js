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
  // Coverage is enabled from CI via `npm test -- --coverage` (see
  // .github/workflows/test.yml); that flag is the single switch.
  //
  // The provider MUST stay 'v8'. The default 'babel' provider loads
  // babel-plugin-istanbul, which requires test-exclude@6, whose very first
  // statements are `promisify(require('glob'))`. This package pins
  // `overrides: { glob: "^13" }`, and glob >= 9 exports an *object*, not a
  // callable — so promisify throws and EVERY suite fails to compile with
  // `TypeError: [BABEL]: The "original" argument must be of type function`.
  // The v8 provider uses V8's built-in coverage and never loads
  // babel-plugin-istanbul at all, so the glob override is irrelevant.
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
