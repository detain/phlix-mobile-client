module.exports = {
  testEnvironment: 'node',
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    // `@phlix/*` ship ESM (`"type": "module"`); allow Babel to transform them in
    // case the resolver picks the ESM entry over the CJS `main`.
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|zustand|@phlix)/)',
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
