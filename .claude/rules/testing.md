---
paths:
  - src/**/__tests__/**
  - jest.config.js
  - jest.setup.js
---

# Jest Test Conventions

- Preset is `@react-native/jest-preset`; `coverageProvider` MUST stay `'v8'` (see the comment in `jest.config.js` — the default `babel` provider loads `babel-plugin-istanbul`/`test-exclude`, which breaks every suite under the pinned `glob` override).
- Tests live at `src/<dir>/__tests__/<file>.test.ts` (`.tsx` when rendering JSX). `testPathIgnorePatterns` skips `/node_modules/`, `/android/`, `/ios/`.
- Import through the `@/` alias — `moduleNameMapper` maps `^@/(.*)$` → `<rootDir>/src/$1`.
- Global mocks live in `jest.setup.js`: `react-native-reanimated`, `@notifee/react-native`, `react-native-safe-area-context`, `@react-navigation/native`, `@react-native-async-storage/async-storage`, `react-native-config`, `axios`. Do **not** re-mock these in a test file.
- The `@notifee/react-native` mock exposes the same surface twice — on `default` and as named exports — plus `AndroidImportance` / `EventType` constants. Extend **both** shapes when a new notifee call is added (`src/services/__tests__/NotificationService.test.ts`).
- Zustand stores are process singletons: reset with `useStore.setState(initialState)` in `beforeEach` (`src/stores/__tests__/useAuthStore.test.ts`).
- Prefix unused `catch` bindings with `_` so `npm run lint` passes (`src/stores/__tests__/useWatchHistoryStore.test.ts`).
- `collectCoverageFrom` excludes `src/**/*.d.ts` and `src/**/index.ts` barrels — test the underlying module, not the barrel.
- `src/api/__tests__/deviceIdentity.test.ts` keeps one case skipped (Jest module-caching issue) — leave it skipped rather than "fixing" it.
- CI (`.github/workflows/test.yml`) runs `npm test -- --passWithNoTests --coverage` and uploads `coverage/lcov.info`; `.eslintignore` keeps `coverage/`, `node_modules/`, `android/`, `ios/` out of `npm run lint`.
