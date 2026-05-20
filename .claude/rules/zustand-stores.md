---
paths:
  - src/stores/**
---

# Zustand Store Conventions

- Use `create<State>((set, get) => ({ ...initial, ...actions }))` — see `src/stores/usePlayerStore.ts`.
- Define a TypeScript `interface` for the full state (data + setters/async actions) at the top of the file.
- Extract an `initialState` const for any store that needs `reset()` (`usePlayerStore.ts` pattern).
- Async actions: `set({ isLoading: true, error: null })` → try/catch → `set({ ..., isLoading: false })`; rethrow on error if callers (screens) need it (`useAuthStore.login`).
- Persisted stores call `get().saveSettings()` inside each setter and load via `AsyncStorage.getItem(SETTINGS_KEY)` on `loadSettings()` — see `useSettingsStore.ts`. Storage key prefix: `phlix_`.
- Selector usage in screens: `const x = useAuthStore((s) => s.x)` — never destructure the whole store.
- Export named hook (`export const useFooStore = ...`) and add to `src/stores/index.ts`.
- Do **not** add middleware (devtools/persist) — current stores manage persistence manually via `AsyncStorage`.
