---
name: jest-rn-test
description: Writes Jest tests for the phlix-mobile React Native app using preset `react-native`, placing files at `src/<dir>/__tests__/<file>.test.ts` with `@/*` path aliases and reusing global mocks from `jest.setup.js`. Use when user says 'write test', 'add jest test', 'cover this store', 'test this component', or mentions TDD for TS/TSX files under `src/`. Capabilities: Zustand store testing with `getState`/`setState` reset, component snapshot/render testing via `react-test-renderer`, axios manager tests with `jest.mock('./client')`, async/await assertions, coverage filtering. Do NOT use for native iOS Swift/XCTest or Android JUnit/Espresso tests, Metro/build config tests, or non-React-Native projects.
paths:
  - src/**/__tests__/**/*.test.ts
  - src/**/__tests__/**/*.test.tsx
  - jest.config.js
  - jest.setup.js
---
# Jest React Native Test

## Critical

- Test files MUST live at `src/stores/__tests__/useAuthStore.test.ts` style paths — that is, under `src/<dir>/__tests__/<name>.test.ts` for plain TS, or use the `.tsx` extension for files that render JSX. This is the only path Jest collects in this repo.
- Use the `@/` path alias for imports — `jest.config.js` maps `^@/(.*)$` → `<rootDir>/src/$1`. Do NOT use relative `../../../` paths in tests when crossing `src/` subdirs.
- DO NOT re-mock `react-native-safe-area-context`, `@react-navigation/native`, or `react-native-gesture-handler` — they are mocked globally in `jest.setup.js`. Re-mocking breaks the shared setup.
- Barrel files (such as `src/stores/index.ts`, `src/api/index.ts`, `src/components/ui/index.ts`) are excluded from coverage (`collectCoverageFrom` in `jest.config.js`). Do NOT write tests targeting only a barrel; test the underlying module.
- TypeScript strict mode is on. Tests must type-check: `npm run typecheck` must pass before declaring done.
- Zustand stores are singletons across the process — reset state in `beforeEach` with `useStore.setState(initialState)` or tests will leak between cases.

## Instructions

### Step 1 — Locate the module under test and pick the right pattern

Identify which of the four module types you are testing:

| Module type | Location | Pattern |
|---|---|---|
| Zustand store | `src/stores/useAuthStore.ts` etc. | Call actions via `useStore.getState().action()`, assert via `useStore.getState()` properties |
| API manager | `src/api/AuthManager.ts` etc. | Mock the axios client, assert calls and returned shape |
| Component | `src/components/media/MediaCard.tsx` etc. | `react-test-renderer` `create()` + `toJSON()` / `root.findByType` |
| Utility | `src/utils/formatters.ts` etc. | Direct function call + assert return |

Verify the module exists with `ls src/stores/useAuthStore.ts` (or the equivalent path) before proceeding.

### Step 2 — Create the test file at the canonical path

Create the test alongside an `__tests__` folder next to the module. For example, a store test goes at `src/stores/__tests__/useAuthStore.test.ts`; a component test goes at `src/components/media/__tests__/MediaCard.test.tsx` (use the TSX extension when the test renders JSX). Use this header for every file:

```ts
import { useAuthStore } from '@/stores/useAuthStore';
```

For component tests, also import:

```tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
```

Verify the import resolves by running `npm test -- --testPathPattern="useAuthStore"` once before adding cases (it should compile even with zero `it()` blocks).

### Step 3 — Write the test body for the module type

**Zustand store** (mirrors `src/stores/useAuthStore.ts` pattern of `create<State>((set, get) => ({...}))`):

```ts
import { useAuthStore } from '@/stores/useAuthStore';

describe('useAuthStore', () => {
  const initial = useAuthStore.getState();
  beforeEach(() => {
    useAuthStore.setState(initial, true); // replace=true clears partial state
  });

  it('setUser updates user and isAuthenticated', () => {
    useAuthStore.getState().setUser({ id: '1', name: 'A' } as any);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
```

**API manager** (mocks the shared axios client from `src/api/client.ts`):

```ts
import client from '@/api/client';
import { LibraryManager } from '@/api/LibraryManager';

jest.mock('@/api/client');
const mockGet = client.get as jest.MockedFunction<typeof client.get>;

describe('LibraryManager.list', () => {
  beforeEach(() => mockGet.mockReset());

  it('GETs /libraries and returns data', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'l1' }] } as any);
    const result = await LibraryManager.list();
    expect(mockGet).toHaveBeenCalledWith('/libraries');
    expect(result).toEqual([{ id: 'l1' }]);
  });
});
```

**Component** (functional component using `react-test-renderer`, NOT `@testing-library/react-native` — it is not installed):

```tsx
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MediaCard } from '@/components/media/MediaCard';

describe('<MediaCard />', () => {
  it('renders title from props', () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<MediaCard item={{ id: '1', name: 'X' } as any} />);
    });
    expect(tree!.toJSON()).toMatchSnapshot();
  });
});
```

**Utility**: direct call + `expect(...).toEqual(...)`. No setup needed. Example: import `formatRuntime` from `@/utils/formatters` and assert `expect(formatRuntime(60)).toBe('1h 0m')`.

Verify the test runs in isolation: `npm test -- --testPathPattern="useAuthStore"`. Must show `PASS`.

### Step 4 — Mock external native modules only if not in `jest.setup.js`

Before adding a `jest.mock(...)` call, check `jest.setup.js` — these are already mocked globally:
- `react-native-safe-area-context` → returns insets `{top: 0, right: 0, bottom: 0, left: 0}`
- `@react-navigation/native` → `useNavigation`, `useRoute`, `useFocusEffect`
- `react-native-gesture-handler` → re-exports its jest-setup

For `@react-native-async-storage/async-storage`, `react-native-keychain`, `react-native-push-notification`, or `react-native-linear-gradient`, mock locally at the top of the test file with the following form:

```ts
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn(),
}));
```

Verify by importing from a fresh node REPL would fail without the mock.

### Step 5 — Verify and measure

Run in order, fix failures before continuing:

```bash
npm test -- --testPathPattern="useAuthStore"   # specific file passes
npm run typecheck                              # tsc --noEmit clean
npm run lint                                   # eslint clean
npm test -- --coverage --testPathPattern="stores"  # check coverage
```

All four must succeed before reporting the task complete.

## Examples

**User says**: "Add a jest test for the auth store covering login and logout."

**Actions**:
1. Read `src/stores/useAuthStore.ts` to learn state shape and action signatures.
2. Create `src/stores/__tests__/useAuthStore.test.ts`.
3. Import `useAuthStore` via `@/stores/useAuthStore`.
4. Add `beforeEach` that resets via `useAuthStore.setState(initial, true)`.
5. Write `it('login sets user and token', ...)` and `it('logout clears user', ...)`.
6. Run `npm test -- --testPathPattern="useAuthStore"` → `PASS`.
7. Run `npm run typecheck` and `npm run lint` → clean.

**Result**: `src/stores/__tests__/useAuthStore.test.ts` with 2+ green tests, store coverage > 0% in the coverage report.

## Common Issues

**`Cannot find module '@/stores/useAuthStore' from '...'`**
→ The test file is outside `src/`. Move it under `src/<dir>/__tests__/`. The `moduleNameMapper` only applies under `<rootDir>` and the path alias is `@/(.*) → src/$1` — never `src/src/...`.

**`SyntaxError: Unexpected token '<'` when rendering a component**
→ The file extension is wrong for a file containing JSX. Rename `*.test.ts` to `*.test.tsx`.

**`TypeError: Cannot read properties of undefined (reading 'getConstants')` from a native module**
→ The package needs a local mock. Add at the top of the file:
```ts
jest.mock('react-native-keychain', () => ({ /* shape used in code under test */ }));
```
Do NOT add it to `jest.setup.js` unless used across many tests.

**Store test passes alone but fails when run with the full suite**
→ State leaked from a prior test. Use `useStore.setState(initial, true)` (second arg `true` replaces instead of merges) inside `beforeEach`, capturing `initial` once at module scope BEFORE any `it` runs.

**`ReferenceError: __DEV__ is not defined`**
→ The test imported a file that uses `__DEV__` outside the RN preset's transform path. Confirm `preset: 'react-native'` is in `jest.config.js`; do NOT override `transform` for `.ts`/`.tsx`.

**Snapshot fails with `react-native-safe-area-context` differences**
→ Something locally re-mocked it. Remove the local `jest.mock('react-native-safe-area-context', ...)` — the global mock in `jest.setup.js` is canonical.

**Coverage report shows 0% for a tested file**
→ Verify the file is not a barrel module (excluded in `collectCoverageFrom`). Test the underlying module the barrel re-exports, not the barrel itself.

**`Jest worker encountered 4 child process exceptions, exceeding retry limit`**
→ Usually an unmocked native module crashing on import. Run `npm test -- --testPathPattern="useAuthStore" --runInBand` to surface the real stack, then add the missing `jest.mock(...)`.
