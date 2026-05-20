---
paths:
  - src/api/**
---

# API Manager Conventions

- All HTTP goes through `apiClient` from `src/api/client.ts` (axios, `BASE_URL = 'https://api.phlix.app'`, 30s timeout, auth + 401-refresh interceptors). Do not import `axios` directly elsewhere.
- Managers are classes with async methods returning typed promises — see `src/api/LibraryManager.ts`.
- Export pattern at file bottom:
  ```ts
  export const libraryManager = new LibraryManager();
  export default libraryManager;
  ```
  Add to `src/api/index.ts` re-exports.
- Method shape: `async getX(...): Promise<T> { return apiClient.get<T>('/path', params); }` — no manual axios calls, no manual auth headers.
- Domain types belong in `src/types/` (`media.ts`, `playback.ts`); manager-specific response wrappers (`PaginatedResponse<T>`, `MediaMetadata`) stay in the manager file and are re-exported via `src/api/index.ts`.
- Snake_case field names match the server payload (e.g. `poster_url`, `run_time_ticks`, `user_data`) — do **not** camelCase API DTOs.
- Errors bubble up; screens/stores own the try/catch.
