# Changelog

All notable changes to **phlix-mobile-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed — cs41 currency re-pin (PURE provenance regen #28; 402 tuples unchanged; untagged) — 2026-09-12

- **cs#41 currency re-pin cascade (lane cs41).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #28 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is one merge confined to the
  parallel-suite junit-merge tooling, two new guard tests and
  changelog/release-journal prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs40 currency re-pin (PURE provenance regen #27; 402 tuples unchanged; untagged) — 2026-09-12

- **cs#40 currency re-pin cascade (lane cs40).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #27 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is three merges confined to parallel-harness
  suite-runner plumbing, an ignore-rule tidy and changelog/release-journal
  prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs39 currency re-pin (PURE provenance regen #26; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#39 currency re-pin cascade (lane cs39).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #26 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is one packaging-and-installation merge
  confined to the install script, release-process and changelog journals,
  and one third-party clone pin-guard test, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs38 currency re-pin (PURE provenance regen #25; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#38 currency re-pin cascade (lane cs38).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #25 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is two commits confined to CI workflow
  definitions, docker example files, helm chart value files, support test
  files and changelog prose, with an empty diff under the route-surface
  directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs37 currency re-pin (PURE provenance regen #24; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#37 currency re-pin cascade (lane cs37).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #24 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is test-and-CI-only, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs36 currency re-pin (PURE provenance regen #23; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#36 currency re-pin cascade (lane cs36).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #23 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is test-only, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs35 currency regen (manifest full regen 401 → 402 tuples; untagged) — 2026-09-11

- **cs#35 currency re-pin cascade (lane cs35).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen against the current phlix-server
  master tip). Genuine full regen, not provenance-only: the server gained one
  WebPortal route, so the manifest moves 401 → 402 `[method, path]` tuples
  (Application source count holds, WebPortal source count rises by one, shared
  overlap unchanged). Gate pins advance in the same commit — it-title cite, full
  provenance sha, and the provenance.total / routes-length tuple-count
  assertions — while mobile's own client-scan counts (request sites and distinct
  tuples derived from this repo's code) stay exactly as pinned because no Mobile
  request site calls the new server route: the manifest simply becomes a
  superset. Mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Prior era snapshot — cs34 currency re-pin (PURE provenance → server 8ba7789c)

### Changed — cs34 currency re-pin (manifest provenance → current server tip; untagged regen #21) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #21 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 and the sorted-tuple fence digest measure equal
  old-vs-new; only serverSha + generatedAt move. Gate pins (it-title cite +
  full provenance sha) advance in the same commit; mobile carries no md5 pin.
  Untagged wave: the dependency tag pin stays put.

### Changed — cs33 currency re-pin (manifest provenance → current server tip; untagged regen #20) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #20 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 and the sorted-tuple fence digest measure equal
  old-vs-new; only serverSha + generatedAt move. Gate pins (it-title cite +
  full provenance sha) advance in the same commit; mobile carries no md5 pin.
  Untagged wave: the dependency tag pin stays put.

### Changed — cs32 currency re-pin (manifest provenance → current server tip; untagged regen #19) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #19 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 measures equal old-vs-new; only serverSha + generatedAt
  move. Gate pins (it-title cite + full provenance sha) advance in the same
  commit; mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Changed — cs31 currency re-pin (manifest provenance → current server tip; untagged regen #18) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #18 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 measures equal old-vs-new; only serverSha + generatedAt
  move. Gate pins (it-title cite + full provenance sha) advance in the same
  commit; mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Changed — cs30 era-2 currency re-pin (manifest provenance → server 5986b61d) — 2026-09-09

- Server moved mid-wave (`32183f5b` → `5986b61d`, S210 #749 — docker boot-gate bounds only,
  route-zero re-proven: Router/Application/guard blobs and Routes/+FastPath/ trees byte-identical).
  Vendored `server-route-manifest.json` re-vendored byte-identical from `@phlix/contracts` master
  `57a8528a` (era-2 regen; full-file md5 `cb53d53f` → `045c0984`, blob identity `dd0cbaca` verified
  against the contracts dist artifact; stripped route-content md5 `508a…` holds — 401 tuples).
  Gate pins advance in the same commit; counts unchanged.

### Changed — cs30 currency re-pin (manifest provenance → server 32183f5b) — 2026-09-09

- cs#30 — route-manifest PURE provenance re-pin to contracts `767146a8` (server `e15d9543` → `32183f5b`; span re-proven route-zero at the contracts leg — S266 #747 + S171 #748, guard tests/`Router.php`/`Routes/`+`FastPath/` blobs/trees identical, `WebPortalRouter.php` comment-only); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `e15d9543` → `32183f5b` follow, vendored copy `git hash-object` = contracts dist blob `9068173e` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `cb53d53f`, none pinned).

### Changed — cs29 currency re-pin (manifest provenance → server e15d9543) — 2026-09-09

- cs#29 — route-manifest PURE provenance re-pin to contracts `8697c099` (server `a5cde27e` → `e15d9543`; span re-proven route-zero at the contracts leg — S211 #745 + S114 #746, route-authority blobs/trees identical); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `a5cde27e` → `e15d9543` follow, vendored copy `git hash-object` = contracts dist blob `73b945aa` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `27834ef4`, none pinned).

### Changed — cs28 currency re-pin (manifest provenance → server a5cde27e) — 2026-09-09

- cs28 — route-manifest PURE provenance re-pin to contracts `a1ca39d8` (server `afe54c7c` → `a5cde27e`, route-zero); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `afe54c7c` → `a5cde27e` follow, vendored copy `git hash-object` = contracts dist blob `a6048724` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `0331a2d8`, none pinned).

### Changed — cs27 currency re-pin (manifest provenance → server afe54c7c) — 2026-09-09

- cs27 — route-manifest PURE provenance re-pin to contracts `28000fa4` (server `afe54c7c`); seven route-zero server merges since `1e14b539` — all 401 tuples byte-identical (stripped route-set md5 `508a6415` old = new), only provenance moves; gate test-title cite + full serverSha pin `1e14b539` → `afe54c7c` follow, vendored copy `git hash-object` = contracts dist blob `81c56ea9` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `5c06306c`, none pinned).

### Changed — cs26 currency re-pin (manifest provenance → server 1e14b539) — 2026-09-08

- cs26 — route-manifest currency re-pin to contracts `97c87f27` (server `1e14b539`); NON-pure: 400→401 tuples, exactly one added (`POST /api/v1/admin/updates/check`, from S273), nothing removed — gate serverSha/total/length pins follow, client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained.

### Changed — cs25 currency re-pin (manifest provenance → server 2746677e) — 2026-09-08

- cs25 — route-manifest currency re-pin to contracts `e837e31c` (server `2746677e`); 400-tuple SET byte-identical (stripped-md5 `0a4a642c`), gate serverSha pin follows, no-md5 posture retained.

### Changed — cs24 currency re-pin (manifest provenance → server df6aa8e5) — 2026-09-07

- cs24 — route-manifest currency re-pin to contracts `59fd9` (server `df6aa`).

### Changed — cs23 currency re-pin (manifest provenance → server bab33ff2) — 2026-09-06

- cs23 — route-manifest currency re-pin to contracts `bcd27` (server `bab33`).

### Changed — cs22 currency re-pin (manifest provenance → server e4853f0f) — 2026-09-06

- cs22 — route-manifest currency re-pin to contracts `876d0` (server `e485`).

### Changed — cs21 currency re-pin (manifest provenance → server e729d48a) — 2026-09-06

- cs21 — route-manifest currency re-pin to contracts `341fc` (server `e729d`).

### Fixed — S441 relay inbound ms→s conversion at the protocol boundary (finish-S293)

- **Inbound SyncPlay positions no longer land 1000× down the timeline.** S293 moved both SEND
  boundaries to wire milliseconds, but the receive legs kept consuming the raw ms as seconds:
  a host's 42 500 ms seek threw the native player to 42 500 s. The decode now happens ONCE at
  the protocol boundary — new `src/syncplay/wireUnits.ts` `wireMsToSeconds()` applied in
  `SyncPlayService`'s group-state/play/pause/seek handlers, in the optimistic store writes of
  `sendPlay/sendPause/sendSeek` (the store's field is SECONDS), and in
  `SyncPlayManager.mapPlaybackState()` (REST join). `PlayerScreen`'s seek arm and the internal
  clock stay seconds-native with no unit math of their own. Inbound fixtures rewritten
  1000×-sensitive both ways (identity and double-decode each turn five named tests red);
  send-side S293 pins untouched.

### Changed — W34 (cs20retag) currency re-pin (manifest provenance → server f35a5742) — 2026-09-05

- **cs#20 currency leg of the combined re-tag wave.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `f2e284b3` (regen against server master
  `f35a5742` — the web-ui `@phlix/ui` v0.99.1 re-pin commit: zero PHP, zero route hunks; previous
  provenance `2250def2`/`3a253991`). The 400-tuple SET is byte-identical — only provenance moved.
  The gate's serverSha pin follows to `f35a5742` in `src/api/test/routeManifest.gate.test.ts`
  (it-title + full-sha assertion); this gate keeps its no-md5 posture. All count pins (400/400,
  generator string) and coverage pins untouched. No version or install-pin moves in this repo.

### Changed — W33 (cs19) currency re-pin (manifest provenance → server 3a253991) — 2026-09-05

- **cs#19 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `2250def2` (regen
  against server master `3a253991`; previous provenance `e74cdc88` — S431
  executable census, one commit, no route hunks). The 400-tuple SET is
  byte-identical — only provenance moved. The gate's serverSha pin follows to
  `3a253991` in `src/api/test/routeManifest.gate.test.ts` (it-title + full-sha
  assertion); this gate keeps its no-md5 posture. All count pins (400/400,
  generator string) and coverage pins untouched. Untagged wave: no install-pin
  or version moves.

### Changed — W31 (cs18) currency re-pin (manifest provenance → server e74cdc88) — 2026-09-05

- **cs#18 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `51ed6cd3` (regen
  against server master `e74cdc88`; previous provenance `4b620f59`). The
  400-tuple SET is byte-identical — only provenance moved. The gate's
  serverSha pin follows to `e74cdc88` in `src/api/test/routeManifest.gate.test.ts`
  (this gate pins provenance sha, not md5). No coverage-pin move was needed.

### Changed — W29 (cs17) currency re-pin (manifest provenance → server 4b620f59) — 2026-09-04

- **cs#17 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `55311c68` (regen
  against server master `4b620f59`; previous provenance `888a42b2`). The
  400-tuple SET is byte-identical — only provenance moved. The gate's
  serverSha pin follows to `4b620f59` in `src/api/test/routeManifest.gate.test.ts`
  (this gate pins provenance sha, not md5). No coverage-pin move was needed
  (171 sites / 167 tuples / 19 modules unchanged).

### Changed — W22 currency re-pin (manifest provenance → server 01340633)

- **`src/api/test/server-route-manifest.json`** re-vendored from the merged
  `@phlix/contracts` master export (regen `068d5e86`, shipped untagged): the
  400-tuple SET is byte-identical — only provenance moved (server master is
  one CI-only commit above `8f72faec`). New vendored md5
  `6ea0eac92bfb0632d986b122608b9acc`; the gate's serverSha pin follows to
  `01340633`. No package.json pin move (gate reads the vendored copy); all
  coverage pins (171 sites / 167 tuples / 19 modules incl.
  `RecommendationsScreen.tsx: 1`) stayed green UNTOUCHED. jest 1151 baseline
  preserved.

### Added — S280 client route gate (mobile half)

- **`src/api/test/server-route-manifest.json`** — vendored byte-for-byte from
  `@phlix/contracts` `dist/server-route-manifest.json` (400 `[method, pathTemplate]`
  tuples derived from phlix-server `8f72faec`). No tag is consumed this wave;
  the copy is pinned by provenance sha inside.
- **`src/api/test/routeManifest.gate.test.ts`** — scans every request-issuing
  source and asserts each issued URL is tuple-exact against the vendored
  manifest (exact-segment compare, never substring — no sibling-wildcard
  absorption). Coverage is pinned per module: **171 request sites / 167
  distinct tuples / 19 modules**, hub-addressed + passthrough files excluded
  with enumerated reasons and negative pins. A planted unserved URL was
  demonstrated RED (and reverted to green). Tizen/console gates are the named
  W19 follow-up.

### Fixed — SyncPlay called four routes phlix-server never registered (S280)

- **`src/api/SyncPlayManager.ts`** called `GET|POST /api/v1/syncplay/rooms`,
  `POST /api/v1/syncplay/rooms/{id}/join` and `DELETE /api/v1/syncplay/rooms/{id}/leave`
  — none of which exists. The server's five SyncPlay rails are all under
  `/syncplay/groups` (and `leave` is **POST**, not DELETE). The same
  S264/S276/S279 defect class, now caught (and fixed) in mobile: the responses
  are the server's snake_case `{ groups }` / `{ success, group }` envelopes,
  mapped to the modal's existing view models by a deliberately minimal local
  mapper. No new behaviour shipped — the browse/create/join/leave flow simply
  stops 404ing at the wire. The WebSocket transport URL is unaffected (it is
  not an HTTP-router route; pinned out of the gate by design).

### Fixed — parental-controls creates 400'd on the wire shape (S234)

- **`@phlix/contracts` bumped to `v0.4.4`** (from `v0.4.3`) in `package.json` /
  `package-lock.json` (resolved SHA `981cac4c`, the v0.4.4 tag commit). The
  release declares the snake_case wire shapes (`tag_type`, `start_time`,
  `end_time`, `days_of_week`, `is_active`) and `profileId: string` (CHAR(36)).
- **`ParentalControlsManager`**: `addTag` now posts `{tag, tag_type}` and
  `createSchedule`/`updateSchedule` post `{name, start_time, end_time,
  days_of_week, is_active}` — the previous camelCase bodies (`tagType`,
  `startTime`, …) 400'd against the server. `profileId` is now `string`
  (CHAR(36) UUID) everywhere in the parental-controls surface.
- **`src/types/parental.ts`**: wire keys corrected to snake_case (mirroring
  contracts v0.4.4); GET read paths map the server's `profile_id` emission
  into the local `profileId` shape.
- **`ParentalControlsScreen`**: schedule read/display and the add-tag/create-
  schedule payloads use the snake_case keys; the active profile id now comes
  from `useProfileStore.activeProfileId` (the app's real profile model —
  `user.profileId` never existed on the auth `User` shape).

### Added — in-app stream quality picker (G3)

- **`@phlix/contracts` bumped to `v0.2.0`** (from `v0.1.1`) in `package.json` /
  `package-lock.json`, pulling in the `Rendition` / `RenditionId` /
  `QualitySelection` / `AUTO_QUALITY` types (step B1). Resolved SHA verified
  against `git ls-remote --tags` before landing.
- **New `QualityMenu`** (`src/components/player/QualityMenu.tsx`) — a
  bottom-sheet picker (matches the existing subtitle-picker Modal style/dark
  palette) letting the viewer choose **Auto** (native AVPlayer/ExoPlayer ABR on
  the multi-variant HLS master) or pin a specific resolution rung (that rung's
  own signed `media_v{id}.m3u8`, playable with **zero native code**). All the
  testable logic lives in the new pure helper module
  `src/components/player/quality.ts` (`buildQualityOptions`,
  `resolveQualityUrl`, `seedQualitySelection`, `activeQualityLabel`), which
  consumes the real `Rendition`/`variants` DTO from `@phlix/contracts` directly
  — no locally-reinvented shape (mirrors the `phlix-console-client` G5
  precedent).
- **The picker is gated on transcode playback.** The mobile player tries the
  signed direct-play `stream_url` first; a real, pinnable quality ladder only
  exists once a transcode job resolves (server A7 `variants[]`) — the mobile
  `MarkerManager.getPlaybackInfo` response carries markers only, no ladder. So
  the quality button/menu is **hidden entirely** whenever direct-play succeeds
  or the ladder has fewer than 2 usable options; it appears once a transcode
  fallback resolves ≥2 rungs. `TranscodeManager.prepare()` now surfaces
  `variants: Rendition[]` on its result (`[]` on a legacy/pre-ABR server).
- **`useSettingsStore.defaultQuality` is now genuinely wired.** This setting
  was persisted and user-settable from day one but never *read* by any
  playback code (a true orphan). `PlayerScreen` now seeds the initial pick
  from it via `seedQualitySelection` (falling back to `Auto` when the
  persisted rung isn't in the current job's ladder — the same failure class as
  the `phlix-roku-client` G4 `FindVariantUrl` bug, guarded here by a dedicated
  test) and persists a fresh pick back to it via `setDefaultQuality` whenever
  the viewer changes quality.
- **Fixed: mid-playback quality switches no longer restart from position 0.**
  Picking a different rung/Auto swaps the native `<PhlixPlayerView src>`, and
  AVPlayer/ExoPlayer reload from the `startPosition` prop on a `src` change.
  The initial implementation left `startPosition` bound to the screen's
  mount-time route param, so every switch jumped the viewer back to the
  beginning. Fixed with a live-position mirror: a `currentPositionRef`
  (updated from every `setCurrentTime` source — progress, seek, syncplay) is
  read at the moment of the switch and used to seed a new `playerStartPosition`
  state that actually drives the player prop, so Auto↔pin and pin↔pin switches
  resume near where the viewer left off, on both platforms. Covered by a
  dedicated mutation-tested case in `src/screens/__tests__/PlayerScreen.test.tsx`.
- **New tests**: `src/components/player/__tests__/quality.test.ts` (16 cases,
  the four pure helpers), `QualityMenu.test.tsx`, 3 new cases in
  `src/api/__tests__/TranscodeManager.test.ts` (variants default/from-start/
  from-poll), and a new `src/screens/__tests__/PlayerScreen.test.tsx` (6
  cases) exercising the screen wiring end-to-end via a renderer-free "hook
  host" technique (this repo intentionally has no React Native Testing
  Library / `react-test-renderer` — see `SkipButton.test.tsx`'s note on React
  19 instability under `@react-native/jest-preset`).

### Skipped — native `maxResolution` prop (flagged for a future native step)

A `maxResolution` prop on `PhlixPlayerView` (real ExoPlayer
`TrackSelectionParameters.maxVideoSize` / AVPlayer
`preferredMaximumResolution` track-selection code, on **both** iOS and
Android) was investigated and deliberately **not** added for this step. It is
not a limitation of the JS-side work above — it would be **redundant** with
the variant-URL pin this step ships: playing a rung's own media playlist
already hard-caps the decoded resolution to that rung with zero native
changes. A native cap would only add value on the **Auto/master** path (e.g.
capping the resolution ABR is allowed to pick) and would need genuine
cross-platform native code that is untestable in this CI environment (no
Xcode/Gradle device or simulator build). Flagged as a possible future
native-side enhancement, not a gap in this feature.

### Fixed — SyncPlay positions on the wire are now milliseconds (S293)

- **The SyncPlay send boundaries now convert the player's seconds to the
  wire's milliseconds unit (`phlix-syncplay/SPEC.md:91`).** `PlayerScreen`'s
  `currentTime` is seconds; the wire unit is milliseconds per
  `phlix-syncplay/SPEC.md:91` — Roku was the only client already compliant.
  A new `toSyncPlayPositionMs()` helper converts at each send boundary
  (`sendPlay`/`sendPause` in `handlePlayPause`, `_handlePlay`,
  `_handlePause`), asserted with 1000×-sensitive values and
  mutation-proved. The receive side is untouched: inbound positions are
  consumed exactly as before, and the player's internal seconds state and
  the native player keep seconds. KNOWN LIMIT: `sendSeek` still has no
  production callsite — a host seek is applied locally and never broadcast
  — so no seek-position conversion ships. The server (stores the payload
  raw, unit-agnostic) and Roku (already compliant) are not touched.

### Added — hub-relay pending_command consumer (S298, mobile half)

- **The mobile app now consumes "Alexa, play X" (`pending_command` /
  `play_media` frames) from the hub's SyncPlay relay.** New
  `src/syncplay/hubRelay.ts` opens a real `:8804` socket at
  `ws(s)://<hub>:8804/syncplay/{server_id}` with the **bearer subprotocol
  carrier** (`Sec-WebSocket-Protocol: bearer, <token>` — S237/S355-proven
  against the real hub; the relay refuses query-string tokens by design).
  The open-whenever lifecycle boots the socket whenever hub auth exists —
  NOT gated on a SyncPlay room join — with a capped exponential reconnect
  ladder that re-reads the token on every attempt (relay tokens expire
  hourly). Frames are parsed at the boundary (parse-don't-validate); only
  `pending_command` / `play_media` is consumed, everything else is dropped.
- **`src/hub/RelayTokenProvider.ts`** mints the per-(user, server) client
  relay token over `POST /api/v1/me/servers/{id}/relay-token` (S2a) with the
  hub session JWT, caches it until just before `expires_at`, and returns
  `null` (never a stale credential) on any failure or after sign-out.
- **`src/syncplay/HubRelayConsumer.ts`** wires it at app boot (`App.tsx`):
  hub-auth-gated socket lifecycle + a command router that consumes each
  delivered frame once and navigates the player to the media id — the
  mobile load-a-new-title path (PlayerScreen's itemId-driven load resolves a
  signed stream and auto-plays).
- **`current_media_id` carry-through paired caller.** The wire value was
  already mapped into `SyncPlayGroup` (`?? null` in
  `SyncPlayService.handleGroupState`); `applyPendingPlayMedia` is the caller
  that writes the delivered media id into the live group via the new
  `setCurrentMediaId` store action — the field is produced at the wire
  boundary and consumed here, not dead wiring.
- **Tests** (`src/__tests__/syncplay/hubRelay.test.ts`,
  `HubRelayConsumer.test.ts`, `syncplayStore.test.ts`,
  `src/__tests__/hub/RelayTokenProvider.test.ts`): carrier shape, parse
  boundary, lifecycle/reconnect, router (deliver → navigate → consume,
  once per unique command), store consumer pair, mint/cache/re-mint. Real
  hub proof: handshake OPEN + delivered=1 + control delivered=0 (see the
  lane report). KNOWN LIMIT: no device/emulator on the build box — the
  frame's path through the consumer into the player load is proven at the
  component/store level; pixel playback is unobservable here.

### Fixed — S404 track-shape alignment (local mirror retired)

- **`src/types/playback.ts` re-declared `SubtitleTrack`/`AudioTrack` with a
  required `display_title` — a key phlix-server has NEVER emitted**
  (`StreamTrackShaper` is the wire authority, verified at server `01340633`;
  `display_title`: zero hits in server `src/`). The mirror is retired: the
  file now re-exports the corrected `@phlix/contracts` v0.4.5 playback.ts
  pair verbatim (audio: `id, index, stream_index, codec, language, channels,
  bitrate (always present, nullable), title (nullable), default`; subtitle:
  `id, index, stream_index, language, label, codec, source, hearing_impaired,
  url (nullable)`).
- **`PlayerScreen`'s transcode subtitle rows now carry the full honest wire
  shape** (the old hand-literal held `display_title: s.language`; the display
  string moves to `label` — same value, same rendering; ordinals positional,
  `source: 'transcode'` marks client provenance). Behavior unchanged.
- **`@phlix/contracts` pinned to v0.4.5** (lockfile resolves the tag to the
  merge squash; the vendored route manifest shipped in the bundle stays
  byte-identical, md5 `cca4660dda7876fba840f9d108ad7c18`).
- **Tests rewritten honestly (not deleted)**: the `src/types/__tests__/playback.test.ts`
  track fixtures now pin the nine-key wire shapes plus compile-time ABSENCE
  pins (`display_title`/`title`-on-subtitle must never come back — gated by
  `tsc`, the file's documented executing check); the `usePlayerStore` track
  fixtures carry full wire rows. `tsc --noEmit` clean, eslint clean (2
  pre-existing disable-comment warnings unchanged), jest 76 suites /
  1151 passed + 1 skipped, metro android bundle emitted.
- Out of scope by ruling: the DEAD `audioTrackList`/`subtitleTrackList`
  pickers (setters have zero call sites; components still type against the
  `Stream*` DB mirrors) — wiring is S407.
