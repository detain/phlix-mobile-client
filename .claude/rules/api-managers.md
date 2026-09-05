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
- Every URL a manager can put on the wire must exist in the vendored route manifest: `src/api/test/routeManifest.gate.test.ts` matches `METHOD /path` tuple-exact against `src/api/test/server-route-manifest.json` (`{param}` segments compare as whole segments — never substring or prefix). A path the server does not register fails the gate; fix the path or re-vendor the manifest from `@phlix/contracts`.
- Domain types belong in `src/types/` (`media.ts`, `playback.ts`); manager-specific response wrappers (`PaginatedResponse<T>`, `MediaMetadata`) stay in the manager file and are re-exported via `src/api/index.ts`.
- Shapes `@phlix/contracts` already declares are re-exported, not re-declared: `src/types/playback.ts` re-exports `AudioTrack`/`SubtitleTrack` verbatim, and `TranscodeJob`/`TranscodeStatus` deliberately carry no `dash_url` — do not re-add it, not even as optional.
- Snake_case field names match the server payload (e.g. `poster_url`, `run_time_ticks`, `user_data`) — do **not** camelCase API DTOs. This applies to request bodies too: `src/api/ParentalControlsManager.ts` sends `start_time`/`end_time`/`days_of_week`/`is_active`/`tag_type` and maps the wire's `profile_id` onto the local `profileId` (a CHAR(36) UUID string) on read.
- Server-relative signed paths handed to a native player (no axios `baseURL` involved) go through `absolutizeApiPath` from `src/api/client.ts` — never hand-join a base URL.
- Errors bubble up; screens/stores own the try/catch.
