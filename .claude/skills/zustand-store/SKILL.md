---
name: zustand-store
description: Scaffolds a new Zustand store under src/stores/ using the create<State>((set, get) => ({...})) pattern with typed State interface, initialState + reset(), optional AsyncStorage persistence via the phlix_ key prefix, and wires the hook into src/stores/index.ts. Use when the user says 'add a store', 'new zustand store', 'add state for X', 'persist X across launches', or creates a file under src/stores/. Do NOT use for modifying existing stores' actions, for ephemeral component-local state (use useState), or for non-Zustand state (Redux/Context/Recoil are not used in this codebase).
paths:
  - src/stores/**/*.ts
---
# Zustand Store

Scaffold a new Zustand store under `src/stores/` matching the exact pattern used by `src/stores/useAuthStore.ts`, `src/stores/usePlayerStore.ts`, `src/stores/useLibraryStore.ts`, and `src/stores/useSettingsStore.ts`.

## Critical

- File MUST live in `src/stores/` and be named `useDomainStore.ts` style (camelCase `use` prefix, PascalCase domain, `Store` suffix, TypeScript extension).
- State interface MUST be a single exported `interface DomainState` containing BOTH data fields and action signatures — do not split into separate types.
- Use `create<State>()((set, get) => ({...}))` — explicit generic, no middleware unless persistence is required.
- Persistence keys MUST be prefixed with `phlix_` (e.g. `phlix_settings`, `phlix_auth_token`). Never store secrets in AsyncStorage — use `react-native-keychain` (see `src/stores/useAuthStore.ts` for the token pattern).
- Always wire the new hook into `src/stores/index.ts` as a named re-export. The barrel file is the single import surface for screens/components.
- Do NOT call `set` from inside a selector or render path. Actions only.
- Do NOT introduce Redux, Context, or Recoil. This codebase is Zustand-only.

## Instructions

1. **Read the closest existing store to match its style.** Run `Read src/stores/useSettingsStore.ts` (closest to a simple persisted store) or `src/stores/useLibraryStore.ts` (closest to an API-backed store). Confirm: import order, action naming (`setX`, `loadX`, `clearX`, `reset`), and whether `get()` is used. Verify before proceeding to Step 2.

2. **Create the file in `src/stores/`.** Use this skeleton, replacing `{Domain}` and fields. Keep imports in this exact order:

   ```ts
   import { create } from 'zustand';
   // import AsyncStorage from '@react-native-async-storage/async-storage'; // only if persisting
   // import { someManager } from '../api'; // only if calling backend
   // import type { SomeType } from '../types/media'; // only if referencing shared types

   interface DownloadsState {
     // data
     items: DownloadItem[];
     isLoading: boolean;
     error: string | null;

     // actions
     loadDownloads: () => Promise<void>;
     setItems: (value: DownloadItem[]) => void;
     reset: () => void;
   }

   const initialState = {
     items: [],
     isLoading: false,
     error: null,
   };

   export const useDownloadsStore = create<DownloadsState>()((set, get) => ({
     ...initialState,

     loadDownloads: async () => {
       set({ isLoading: true, error: null });
       try {
         const data = await downloadsManager.fetch();
         set({ items: data, isLoading: false });
       } catch (err) {
         set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
       }
     },

     setItems: (value) => set({ items: value }),

     reset: () => set(initialState),
   }));
   ```

   Verify with `npm run typecheck` (zero errors) before proceeding to Step 3.

3. **If state must persist across launches**, hydrate from AsyncStorage on first import and write through on every mutation. Match the pattern at the top of `src/stores/useSettingsStore.ts`:

   ```ts
   import AsyncStorage from '@react-native-async-storage/async-storage';

   const STORAGE_KEY = 'phlix_downloads'; // MUST start with phlix_

   const persist = (state: Partial<DownloadsState>) => {
     AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
   };

   export const useDownloadsStore = create<DownloadsState>()((set, get) => ({
     ...initialState,

     hydrate: async () => {
       const raw = await AsyncStorage.getItem(STORAGE_KEY);
       if (raw) set(JSON.parse(raw));
     },

     setItems: (value) => {
       set({ items: value });
       persist({ items: value, ...get() });
     },
   }));
   ```

   Call `useDownloadsStore.getState().hydrate()` once from `src/App.tsx` startup. Verify the key starts with `phlix_` before proceeding to Step 4.

4. **Wire the hook into `src/stores/index.ts`.** Open the file and add a named re-export beside the existing ones — keep alphabetical order:

   ```ts
   export { useDownloadsStore } from './useDownloadsStore';
   ```

   Do NOT add a default export. Verify with `Grep "useDownloadsStore" src/stores/index.ts`.

5. **Consume in screens/components via the barrel only.** Never deep-import:

   ```ts
   // GOOD
   import { useDownloadsStore } from '../stores';

   // BAD — bypasses the barrel
   import { useDownloadsStore } from '../stores/useDownloadsStore';
   ```

   Use selector syntax to avoid re-renders on unrelated changes:

   ```ts
   const items = useDownloadsStore((s) => s.items);
   const load = useDownloadsStore((s) => s.loadDownloads);
   ```

6. **Add a Jest test at `src/stores/__tests__/useDownloadsStore.test.ts`** mirroring existing store tests. At minimum cover: initial state, one action mutation, and `reset()` restoring `initialState`. Use `useXStore.setState(initialState)` in `beforeEach` to isolate tests.

   ```ts
   import { useDownloadsStore } from '../useDownloadsStore';

   describe('useDownloadsStore', () => {
     beforeEach(() => useDownloadsStore.setState(useDownloadsStore.getInitialState()));

     it('starts with initialState', () => {
       expect(useDownloadsStore.getState().items).toEqual([]);
     });

     it('reset() restores initialState', () => {
       useDownloadsStore.setState({ items: [{ id: '1' } as any] });
       useDownloadsStore.getState().reset();
       expect(useDownloadsStore.getState().items).toEqual([]);
     });
   });
   ```

   Run `npm test -- --testPathPattern="stores"` and confirm green before claiming done.

7. **Final verification gate.** Run all three and confirm zero failures:

   ```bash
   npm run typecheck
   npm run lint
   npm test -- --testPathPattern="stores"
   ```

## Examples

**User says:** "Add a downloads store that tracks queued and completed downloads and persists across launches."

**Actions taken:**
1. Read `src/stores/useSettingsStore.ts` to copy the persistence pattern.
2. Create `src/stores/useDownloadsStore.ts` with `DownloadsState` interface (`queued: DownloadItem[]`, `completed: DownloadItem[]`, `enqueue`, `markComplete`, `remove`, `reset`).
3. Add `STORAGE_KEY = 'phlix_downloads'` and persist on every action.
4. Add `export { useDownloadsStore } from './useDownloadsStore';` to `src/stores/index.ts` (alphabetical position).
5. Add `src/stores/__tests__/useDownloadsStore.test.ts` covering initial state, `enqueue`, `markComplete`, and `reset`.
6. Run `npm run typecheck && npm run lint && npm test -- --testPathPattern="stores"`.

**Result:** New store importable as `import { useDownloadsStore } from '../stores';` from `src/screens/DownloadsScreen.tsx`, persisted under key `phlix_downloads`, fully typed, three Jest tests green.

## Common Issues

- **`TS2322: Type '...' is not assignable to type 'Partial<State>'` on `set(...)`** — You returned a value outside the state shape. `set` accepts a `Partial<State>` or a `(prev) => Partial<State>` updater. Wrap object actions: `set((s) => ({ items: [...s.items, item] }))`.
- **`Cannot read properties of undefined (reading 'getState')`** in a test — You imported from `../stores` (the barrel) before `jest.setup.js` mocked AsyncStorage. Import directly from the underlying store file inside test files only, or ensure `jest.setup.js` mocks `@react-native-async-storage/async-storage` (already present in this repo).
- **Component re-renders on every store change even though it reads one field** — You destructured the whole store: `const { items } = useXStore()`. Use a selector instead: `const items = useXStore((s) => s.items)`.
- **`AsyncStorage.setItem` rejects with `Unhandled promise rejection`** — Persist call missing `.catch(() => {})`. The `persist` helper in Step 3 includes it; do not remove.
- **State persists across tests, causing order-dependent failures** — Missing `beforeEach(() => useXStore.setState(useXStore.getInitialState()))`. Zustand stores are module-singletons; tests must reset.
- **`Module '"../stores"' has no exported member 'useXStore'`** — Forgot Step 4. Add the re-export to `src/stores/index.ts`.
- **AsyncStorage key collides with another app/build** — Key missing the `phlix_` prefix. All keys MUST be namespaced; rename and ship a one-time migration if the store already shipped.
- **Sensitive value (token, password) ended up in AsyncStorage** — AsyncStorage is plaintext on disk. Move to `react-native-keychain` (see `src/stores/useAuthStore.ts` for the exact pattern) and delete the AsyncStorage entry on next launch.
