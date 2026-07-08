# Changelog

All notable changes to **phlix-mobile-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
