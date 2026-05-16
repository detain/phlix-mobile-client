---
name: api-manager
description: Adds a new API manager class in `src/api/` using the singleton pattern (`apiClient.get<T>(...)`, `export const xManager = new XManager()`). Wires re-exports through `src/api/index.ts`, keeps snake_case DTO fields, and puts shared media/playback types in `src/types/`. Use when user says 'add api manager', 'new endpoint client', 'wrap /api/foo', or adds files under `src/api/`. Do NOT use for raw axios calls outside `src/api/`, modifying `client.ts` interceptors, or anything inside `src/stores/` (managers stay stateless — Zustand stores call into them).
paths:
  - src/api/**
  - src/types/**
---
# API Manager Skill

Wrap a new backend resource (`/foo`, `/users/123/bar`, …) as a TypeScript class under `src/api/` following the exact pattern used by `src/api/AuthManager.ts`, `src/api/LibraryManager.ts`, and `src/api/PlaybackManager.ts`.

## Critical

- **Never call `axios` directly.** All HTTP must go through `apiClient.get<T>` / `post<T>` / `put<T>` / `delete<T>` from `src/api/client.ts` so the auth + 401-refresh interceptors apply.
- **Never touch `src/api/client.ts`.** Interceptors, base URL, and refresh logic are owned by `ApiClient`. Adding endpoints there is wrong.
- **DTO fields are `snake_case`** to match the server (`access_token`, `has_more`, `device_profile`, `runtime_ticks`). Do **not** rename to camelCase in TypeScript interfaces — only **method names and local variables** use camelCase.
- **Singleton export is mandatory.** Bottom of file must end with `export const fooManager = new FooManager(); export default fooManager;` — both named and default. The `src/api/index.ts` barrel re-exports `default as`.
- **Types shared across files go in `src/types/`** (`src/types/media.ts`, `src/types/playback.ts`, etc.). Types used only inside one manager (response envelopes, option bags) stay co-located in that manager file and are re-exported from `src/api/index.ts` with `type`.
- **Managers are stateless.** No caching, no in-memory state, no `AsyncStorage` reads/writes unless this manager owns that storage key end-to-end (only `src/api/AuthManager.ts` does today). Zustand stores under `src/stores/` are where state lives.

## Instructions

### Step 1 — Confirm endpoint shape and types

Before writing code, gather: HTTP verb, path (with path params), query/body fields, response shape. Decide where the response type lives:

- Reused across modules (e.g. `MediaItem`, `Episode`) → already in `src/types/media.ts` or `src/types/playback.ts`. Import it.
- New domain entity (e.g. `Subtitle`, `Collection`) → add to the matching file under `src/types/` as an `export interface`.
- Manager-local envelope (e.g. `PaginatedResponse<T>`, `FooMetadata`) → declare and `export interface` **inside the manager file**, then re-export from `src/api/index.ts`.

Verify: every field in your interface is `snake_case` and matches the server payload exactly. Optional fields use `?:`.

### Step 2 — Create the manager file in `src/api/`

Uses output from Step 1. File name is PascalCase + `Manager.ts` (for example `src/api/FooManager.ts`). Use this template verbatim (replace `Foo`/`foo`, endpoints, types):

```ts
// src/api/FooManager.ts
import apiClient from './client';
import { Bar } from '../types/media'; // or local interface

export interface FooResult {
  items: Bar[];
  total: number;
  has_more: boolean;
}

class FooManager {
  // GET list with optional query params
  async list(options: { limit?: number; offset?: number } = {}): Promise<FooResult> {
    return apiClient.get<FooResult>('/foo', options);
  }

  // GET single by id (path param)
  async get(id: string): Promise<Bar> {
    return apiClient.get<Bar>(`/foo/${id}`);
  }

  // POST returning data
  async create(payload: { name: string; parent_id?: string }): Promise<Bar> {
    return apiClient.post<Bar>('/foo', payload);
  }

  // POST fire-and-forget (no return body)
  async mark(id: string): Promise<void> {
    await apiClient.post(`/foo/${id}/mark`);
  }

  // DELETE
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/foo/${id}`);
  }
}

export const fooManager = new FooManager();
export default fooManager;
```

Rules pulled from existing managers:
- File header comment is the file's full path (matches `src/api/AuthManager.ts:1`, `src/api/LibraryManager.ts:1`, `src/api/PlaybackManager.ts:1`).
- Methods that return data use `return apiClient.get/post<T>(...)` directly — no intermediate `const response = ...`.
- Methods that return `void` use `await apiClient.post(...)` and do not return the result (see `src/api/PlaybackManager.ts` `reportProgress` near line 41).
- Query params go in the **second arg** of `apiClient.get` (the params object). Body params go in the **second arg** of `apiClient.post`.
- Option bags default to `{}` so callers can omit them: `options: { limit?: number } = {}` (see `src/api/LibraryManager.ts` `getLibraryItems` near line 36).
- One-line `//` comment above each method describing what it does — matches the existing style.

Verify: file has both `export const fooManager` and `export default fooManager` on the last two lines. No `axios` import. No `AsyncStorage` import unless this manager owns auth-style credential storage.

### Step 3 — Wire `src/api/index.ts`

Uses output from Step 2. Add a single line to `src/api/index.ts` re-exporting the default and any locally-declared types:

```ts
export { default as fooManager, type FooResult } from './FooManager';
```

Keep alphabetical-ish order matching the existing block (auth → library → playback → foo). If your manager has no exported types, omit the `type` clause (matches `PlaybackManager` line in `src/api/index.ts` near line 5).

Verify: `npm run typecheck` passes. The new manager is importable as `import { fooManager } from '../api'`.

### Step 4 — Add cross-cutting types under `src/types/` (only if Step 1 required it)

Uses output from Step 1. If you decided a type belongs in `src/types/media.ts` or `src/types/playback.ts`, add it there as `export interface` with `snake_case` fields. Do not create new files in `src/types/` unless the domain is genuinely new (current files cover media + playback + navigation).

Verify: `npm run typecheck` still passes and no `any` leaked into the manager signatures.

### Step 5 — Validate

Run in order, fix before proceeding:

```bash
npm run typecheck
npm run lint
npm test -- --testPathPattern="api"
```

Verify: zero TS errors, zero new lint warnings, existing API tests still green. Do **not** claim the task done before all three pass.

## Examples

### Example 1 — Wrap `/collections` endpoints

User says: **"Add an API manager for collections — GET `/collections`, GET `/collections/123`, POST `/collections` with `{ name, item_ids }`."**

Actions:
1. `Collection` is a new domain entity → add `export interface Collection { id: string; name: string; item_ids: string[]; created_at: string; }` to `src/types/media.ts`.
2. Create `src/api/CollectionsManager.ts`:
   ```ts
   // src/api/CollectionsManager.ts
   import apiClient from './client';
   import { Collection } from '../types/media';

   class CollectionsManager {
     // List all collections
     async list(): Promise<Collection[]> {
       return apiClient.get<Collection[]>('/collections');
     }

     // Get a single collection
     async get(id: string): Promise<Collection> {
       return apiClient.get<Collection>(`/collections/${id}`);
     }

     // Create a new collection
     async create(payload: { name: string; item_ids: string[] }): Promise<Collection> {
       return apiClient.post<Collection>('/collections', payload);
     }
   }

   export const collectionsManager = new CollectionsManager();
   export default collectionsManager;
   ```
3. Append to `src/api/index.ts`: `export { default as collectionsManager } from './CollectionsManager';`
4. `npm run typecheck && npm run lint` → green.

Result: callers do `import { collectionsManager } from '../api'; const list = await collectionsManager.list();` — identical shape to `libraryManager.getLibraries()`.

### Example 2 — Add paginated `/notifications`

User says: **"Wrap `/users/123/notifications` with pagination."**

Actions:
1. `PaginatedResponse<T>` already exists in `src/api/LibraryManager.ts`. Either import it from `../api` (after Step 3) or re-declare locally — existing pattern re-declares envelope types per-manager and re-exports them. Match by declaring locally.
2. `Notification` is new + domain-specific → add `export interface Notification { ... }` to `src/types/media.ts` (or a new `src/types/notifications.ts` if scope grows).
3. `src/api/NotificationsManager.ts` declares `PaginatedResponse<T>` locally, plus `list(userId, { limit?, offset? } = {})` returning `PaginatedResponse<Notification>`.
4. `src/api/index.ts`: `export { default as notificationsManager, type PaginatedResponse as NotificationsPage } from './NotificationsManager';` (alias only if name collides).

Result: same call site shape as `libraryManager.getLibraryItems()`.

## Common Issues

- **TS error: `Property 'Authorization' does not exist on type 'AxiosHeaders'`** — you imported `axios` directly. Replace with `import apiClient from './client'` and use `apiClient.get/post`. Interceptors only run on `apiClient`.
- **401s loop forever in dev** — your manager calls a path that itself returns 401 (e.g. token endpoint). The refresh interceptor in `src/api/client.ts` near line 42 will retry indefinitely. Use the bare `axios` only inside `src/api/client.ts` `refreshToken` — never in managers. If you genuinely need an unauthenticated call from a manager, that's a sign it belongs in `src/api/client.ts` or `src/api/AuthManager.ts` instead.
- **`Cannot find module '../types/foo'`** — you created a new types file but didn't add it. Either add `src/types/foo.ts` with the interface or move the type back into `src/types/media.ts`. Do not import from `../../types` — always one level up: managers live in `src/api/`, types in `src/types/`.
- **Lint: `'response' is declared but never used`** — old style was `const response = await apiClient.get(...); return response;`. Current style is `return apiClient.get<T>(...)`. Inline it.
- **Runtime: response fields are `undefined`** — TS interface uses camelCase but server returns snake_case. Fix the interface (`accessToken` → `access_token`). The server is authoritative; do not transform in the manager.
- **`fooManager is not a function`** — you forgot `export const fooManager = new FooManager()` or imported the class instead of the singleton. Always import the lowercase singleton: `import { fooManager } from '../api'`.
- **Tests fail with `Cannot read property 'get' of undefined`** — Jest needs `apiClient` mocked. Add `jest.mock('../client')` in the test and stub `apiClient.get.mockResolvedValue(...)`. Existing manager tests under `src/api/__tests__/` show the pattern.
