# Phlix Mobile

[![CI](https://github.com/detain/phlix-mobile-client/actions/workflows/test.yml/badge.svg)](https://github.com/detain/phlix-mobile-client/actions/workflows/test.yml)
<!-- M-MOBILE-56 (review mobile__writer): the semver-tag version badge was
     retired. The repo publishes no versioned git tags — the only tag is the
     release machinery's rolling `latest` (build-android.yml resets it to the
     current tip on every master push), which `sort=semver` can never
     resolve. The app's real version lives in package.json; the rolling
     `latest` GitHub prerelease is described in §CI/CD and §Deployment. -->
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61dafb?logo=react&logoColor=white)](https://reactnative.dev/)
[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A cross-platform mobile application for media playback, built with React Native. Phlix connects to your Phlix server to provide a seamless experience for watching movies, TV shows, listening to music, and browsing photos.

## Project Overview

Phlix Mobile is a React Native application built for the **Phlix media server** — it speaks the `phlix-server` `/api/v1` API directly, with remote access routed through the **Phlix Hub** relay. It is not a generic multi-server client and does not speak Jellyfin or Emby APIs. It provides a native mobile experience with:

- **Movies & TV Series**: Browse, search, and play media content
- **Music Playback**: Listen to your music library with full playback controls
- **Photo Albums**: View your photo collections
- **Offline Downloads**: Download content for offline viewing
- **Cross-Platform**: Available on both iOS and Android

## Features

### Core Features

- **User Authentication**: Secure login with token-based authentication and automatic token refresh
- **Media Library**: Browse movies, series, music, and photos organized by library
- **Media Playback**: Full-screen video player with a draggable seek bar plus
  ±15-second jump buttons, subtitle and audio track selection, quality
  pinning (see Quality Selection below), a sleep timer, and offline playback
  of downloaded items. Volume follows the **system hardware volume** (there
  is no in-app slider), and there is **no playback-speed control** yet.

> **Background/lock-screen playback is iOS-only today** (review
> mobile__casualgamer M-MOBILE-02). The iOS player now activates a
> `.playback` `AVAudioSession` and the app declares `UIBackgroundModes =
> [audio]`, so a "music in pocket" track keeps playing — and Picture in
> picture is genuinely live there. Android has **no MediaSession /
> foreground service**: backgrounding stops playback, and the 📺 PiP
> control does not render there at all (Android's native player command
> surface implements no PiP — a visible button would be decorative).
> The Android side is a feature-scale gap, not a configuration oversight.
- **Subtitle Support**: Multiple subtitle tracks and audio tracks
- **Quality Selection**: When a title falls back to on-demand transcoding (the direct file isn't natively playable), a quality menu in the player lets you pick **Auto** — native adaptive bitrate — or pin a specific resolution rung; the menu is hidden entirely for titles that play back directly. Your choice is remembered as your default for next time, and switching mid-playback resumes from where you left off instead of restarting.
- **Search**: Global text search across all media types, plus an **advanced filter sheet** (filter by genre, content rating, and year range, and choose the sort field — name, year, rating, date added, or runtime — with an ascending/descending toggle). When browsing (no text query) with name sorting, an **A–Z jump rail** appears down the right edge so you can leap straight to titles starting with any letter (letters with no matches are greyed out); results page in as you scroll.
- **User Preferences**: Customizable playback settings and app preferences
- **Continue Watching**: Resume playback from where you left off
- **SyncPlay watch parties**: The player carries a SyncPlay control for
  synchronized co-watching: create a room (optionally **public**, with an
  optional password), or join one by room ID from the modal's browse/join
  surface. The host's play/pause/seek commands drive the group — members'
  timelines follow the host and manual member seeks defer to the room
  clock. Failures arrive as stable server error codes and are shown as
  readable sentences from a client-side catalog instead of raw protocol
  text. The feature runs over BOTH connection shapes: a direct server
  WebSocket and the hub-relay lane (bearer subprotocol) when the session
  came through a hub.
- **Downloads**: Download media for offline playback
- **Multi-user Profiles**: Manage per-user profiles (name, max content rating, optional PIN gate) and switch the active profile from Settings → Profiles
- **Admin Dashboard**: Server administrators get a Settings → Admin → Dashboard showing now-playing sessions, top users, top media, per-library storage, and recent activity (admin-gated; non-admins see no Admin section).
- **Admin Users**: Settings → Admin → Users lets administrators list accounts (filter by all/pending/active/disabled), approve/reject pending sign-ups, disable accounts, grant/revoke admin, reset a password (the freshly generated password is shown once), create and edit users, and delete accounts (the server's self / last-admin guard message is surfaced).
- **Admin Libraries**: Settings → Admin → Libraries lets administrators add/edit/delete libraries (name, type, paths — with a **Browse…** server-side folder picker, `series_per_directory` for series), trigger Scan / Rescan / Match-metadata jobs with live progress (polled status, current path, percent), and review per-library scan history.
- **Admin Plugins**: Settings → Admin → Plugins lets administrators manage server plugins from an **Installed | Catalog** view. Install a plugin from a URL (`https://` or `file://`), enable/disable installed plugins, edit a plugin's settings via a schema-driven form (secret fields are masked), and uninstall with confirmation. The Catalog tab browses configured catalog sources, lets you add or remove a source, and lists each catalog's available plugins.
- **Admin Auth Providers**: Settings → Admin → Auth Providers lets administrators see the server's authentication providers and enable/disable each one. A provider's configuration schema can be viewed read-only (provider config itself is set on the server — there is no mobile write route).
- **Admin Server Settings**: Settings → Admin → Server Settings lets administrators view and edit server configuration values, typed by the server (toggles for booleans, inputs for strings/numbers). Settings overridden by the environment are badged, and Save sends only the keys you changed.
- **Admin Backup**: Settings → Admin → Backup lets administrators list existing backups (label, size, created date), create a new backup (with an optional label), restore a backup (with a clear destructive confirmation — it overwrites the current database/config and may restart the server), delete a backup, and upload a backup to S3. An auto-backup **schedule** card lets you set the backup interval (days) and how many backups to retain.
- **Admin Logs**: Settings → Admin → Logs is a server log viewer — pick a log file (or **All logs (merged)**) to tail it, choose how many lines to show (200/500/1000), see a "truncated" badge when the file is longer, and pull to refresh. Long lines scroll horizontally in a monospace view so nothing is clipped.
- **Admin File Browser**: Settings → Admin → File Browser is a server-side directory browser (breadcrumb navigation, up-one-level, tap a folder to descend). It also serves as the **path picker** for libraries — when adding or editing a library, tap **Browse…** on the paths field to pick a folder on the server and have it filled in for you.
- **Cast**: A Cast button on the media detail screen opens a discovery picker that finds **Chromecast, Roku, AirPlay and DLNA** devices on your network, sends the item to the chosen device, and shows a live transport view (status badge polled every 2.5s, Play/Pause, Stop, and a Seek bar). Capability-gated controls reflect what each backend supports (DLNA has no resume; Roku has no stop/seek; AirPlay has no seek). Leaving the screen keeps the device playing — only **Stop** halts it.
- **Music**: Tapping a music library opens a dedicated Music screen with a segmented **Artists | Albums | Tracks** view. Artists list their albums in-screen; albums open an ordered track list (sorted by disc then track number); the Tracks tab pages through every track. Tapping any track plays it through the standard player (a track id is a media-item id — there is no separate audio player). Music aggregates across all music libraries server-side, so the per-library entry is informational.
- **Photos**: Tapping a photo library opens a dedicated Photos screen that groups your pictures into **date-based albums** (a 2-column grid with cover thumbnails and per-album counts; a library picker appears when you have more than one photo library). Opening an album shows a 3-column thumbnail grid, and tapping a photo launches a full-screen, swipeable viewer. In the viewer, a tap toggles an **EXIF info overlay** (camera, lens, dimensions, date, GPS) and a **Slideshow** button auto-advances the album at the server's configured interval. All images load over signed URLs, so no extra authentication is needed.
- **Collections**: **Settings → Library → Collections** lists your collections — named groupings of media within a library. Create a new collection (name + library picker), tap one to open its items in a poster grid (tap a poster to jump to its detail screen), remove items from a manual collection, and delete a collection with confirm. Collections come in two kinds: **manual** ones you curate by hand, and **smart** ones (marked ⚡) that the server builds from a saved smart-playlist — smart collections are **refresh-only** (a Refresh button re-evaluates the playlist; you can't add or remove their items by hand).
- **Favorites & ratings**: When you're signed in, the media detail screen shows a **heart toggle** to favorite/un-favorite an item and a **1–10 star rating** (five stars, each worth two points — tap to set, re-tap the current rating to clear). **Settings → Library → Favorites** lists everything you've favorited in a poster grid (pull to refresh, pages in as you scroll); tap a poster to open its detail. Favorites and ratings are stored per account on the server.
- **Passkeys (WebAuthn)**: Sign in without a password. On the login screen, **Sign in with a passkey** runs your device's native passkey ceremony (Face ID / Touch ID / fingerprint / device PIN) and logs you straight in. **Settings → Security → Passkeys** lists your registered passkeys (with created/last-used dates), lets you **add a passkey** (a one-tap registration ceremony, optional label) and remove one. The passkey button and the Passkeys screen only appear on devices that support platform passkeys (iOS 15+ / Android with Credential Manager and a configured screen lock).

> **Passkeys are DEVICE-ONLY at runtime.** The passkey ceremony is driven by native modules — iOS `ASAuthorization` platform passkeys (iOS 15+) and Android's AndroidX Credential Manager — and shows the system biometric/PIN sheet, which **only runs on a real device** (no simulator/emulator, and CI compiles the native code but cannot run a ceremony). The JavaScript layer is fully tested. For cross-device passkey portability the **server/host** must publish the relying-party association files for the `rpId` it returns — iOS `apple-app-site-association` (`webcredentials`) and Android Digital Asset Links (`assetlinks.json`); these are server/host infrastructure, not mobile-app config.

> **Cast is SERVER-MEDIATED.** All four backends are driven entirely through the server's HTTP routes (`/cast`, `/roku`, `/airplay`, `/dlna` — discover → send → transport); the mobile app sends the item's *signed stream URL* and the server relays commands to the device. There is **no native local Cast SDK** in the client today — this is a deliberate choice (build-safe under the New-Architecture CI gate, testable, and covering all four backends instead of Chromecast-only). A native local Cast SDK (e.g. `react-native-google-cast` for Chromecast) is a **future enhancement** folded into the TurboModule/Fabric rewrite epic + on-device smoke test.

> **Quality selection pins by playlist URL, not by a native resolution cap.** Picking a rung swaps the player to that rung's own signed HLS media playlist (server-side, zero native code); `Auto` plays the full multi-variant master and lets the native player (AVPlayer/ExoPlayer) run its own adaptive bitrate. A native `maxResolution` prop — capping the resolution native ABR is allowed to pick on the `Auto`/master path — was evaluated and intentionally left out: it needs real iOS/Android track-selection code and is redundant with the pin (which already hard-caps resolution). It's a possible **future native-side enhancement**, not a limitation of the quality picker itself.

> **Profiles are SELF-SERVICE (was: upstream gap, closed).** The server exposes the caller's own profile CRUD on `GET/POST /api/v1/profiles` and `GET/PUT/DELETE /api/v1/profiles/{profileId}` (plus `.../pin` set/unset/verify) behind plain auth — every signed-in account manages its own family profiles, no admin hat needed. Mobile's `ProfileManager` uses exactly these routes (review M-MOBILE-07); the admin-gated `/api/v1/admin/users/{userId}/profiles` lane exists for administrative management of OTHER users and mobile does not call it. Activation is a separate `POST /api/v1/profiles/{id}/switch` that re-mints the session tokens — mobile's selection stays local (persisted profile id) until that flow is deliberately adopted.

- **Live TV / EPG / DVR (admin-gated)**: Server administrators get **Settings → Admin → Live TV** — a channel list (number/name/type) with a "now playing" current-program label drawn from the EPG, an expandable per-channel guide (programs with time ranges), a one-tap **Refresh guide** action, and tap-a-channel-to-watch (the stream URL is resolved, then the player plays it). A **Recordings** screen lists upcoming + all DVR recordings, schedules a recording from any upcoming program (picker modal), deletes a recording (with confirm), and lists series rules (read-only). Most servers have no tuner — when Live TV is not configured the screens show a friendly *"Live TV is not set up on this server"* state instead of a raw error.

> **Live TV is ADMIN-gated and a REACH feature.** Every route lives under `/api/v1/admin/livetv/*` (AdminMiddleware), and the server's Live TV route group is wrapped in try/catch ("not configured — silent ignore") and needs a configured tuner + EPG source. Mobile Live TV is therefore gated on `is_admin` (non-admins see "Admin access required") and treats 404/500 from these routes as "not configured". **There is NO user-facing Live TV route on the server** — add one upstream for true multi-user Live TV.
>
> **Stream-auth caveat (flag upstream):** `GET /admin/livetv/channels/{id}/stream` is admin-Bearer-gated and **302-redirects** to the tuner's HLS URL (not JSON). The native player can't carry a Bearer and axios silently follows redirects, so the client issues a raw `fetch(absoluteUrl, { redirect: 'manual' })` and reads the `location` header, falling back to the stream-endpoint URL itself when the header is unavailable (React Native opaque redirect). This only works if the resolved tuner URL is directly playable; if it still requires auth, the server should expose a `GET .../stream-url` JSON route or a signed-livetv-url — flagged upstream.

### Hub Mode

Phlix Mobile supports **Hub Mode** for remote access to your Phlix servers:

- **Sign in to Hub**: Authenticate with a Phlix Hub to access your claimed servers
- **Multi-Server Support**: View and manage multiple claimed servers from a single app
- **Server Switching**: Quickly switch between servers with the Server Switcher
- **Direct Mode**: Connect directly to your server over LAN when on the same network
- **Relay Mode**: Connect to your server remotely via the Hub relay when away from home

#### Hub Connection Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Direct** | Connects directly to server hostname (e.g., `https://192.168.1.100:8096`) | Same network as server |
| **Via Hub Relay** | Routes traffic through Hub relay endpoint | Remote access when not on same network |

Hub sessions survive app restarts. The hub JWT pair is persisted in the OS keychain vault via `react-native-keychain` (the plugin provides access to the Keychain on iOS and the Keystore on Android); `AsyncStorage` holds only non-secret session metadata — hub URL, user id, expiry, active server, connection mode. Pre-vault installs that stored the whole session in plaintext `AsyncStorage` are migrated on first read, and signing out of the hub wipes both the vault slots and the metadata blob.

### Technical Features

- **React Native** with TypeScript for type safety
- **Zustand** for lightweight state management
- **React Navigation** for navigation flows
- **Native Modules** for optimal video playback performance
- **Secure token vault** — server and hub JWTs live in the OS keychain via `react-native-keychain`; `AsyncStorage` keeps only non-secret preferences and session metadata
- **CI/CD Pipeline** with GitHub Actions

## Documentation

| Document | What it covers |
|----------|----------------|
| [README.md](README.md) | This file — overview, setup, configuration, build/run, deployment |
| [DEVELOPER.md](DEVELOPER.md) | Architecture deep-dive: source layout, navigation, API layer, state, native modules |
| [docs/signing.md](docs/signing.md) | Release signing for Android (keystore) and iOS (certificates, profiles, exportOptions) |
| [CHANGELOG.md](CHANGELOG.md) | Landed-change history (repo-local format, see its header preamble) |
| [AGENTS.md](AGENTS.md) | Contributor/agent ground rules for this repo (store-vs-stores trap, wire law, venue) |

Maintenance scripts: `npm run copyright` (`scripts/add-copyright.mjs`) idempotently
inserts the `@copyright` header into non-test TS/JS sources — re-running it
produces a zero diff once every file is stamped.

## Prerequisites

Before you begin, ensure you have the following installed:

### Common Requirements

- **Node.js** (v24 or later — matches `"engines": { "node": ">=24" }` and CI)
- **npm** (v9.x or later). The repo ships `package-lock.json` and CI installs
  with npm; **yarn** (v1.22.x or later) also works but installs floating —
  there is no committed yarn lock to honor.
- **Git** (v2.x or later)

### iOS Development

- **Xcode** (v15.0 or later)
- **CocoaPods** (`sudo gem install cocoapods`)
- **macOS** (required for iOS development)
- **Apple Developer Account** (for device deployment)

### Android Development

- **Android Studio** (latest stable version)
- **Android SDK** (build platform API 36 — `compileSdk`/`targetSdk` in `android/build.gradle`; `minSdk` 24 is the device floor)
- **Java Development Kit** (JDK 17 or higher)
- **Gradle** (no install needed — the wrapper in `android/gradle/wrapper/` downloads Gradle 9.3.1)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/detain/phlix-mobile-client.git
cd phlix-mobile-client
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using yarn
yarn install
```

### 3. Install iOS Dependencies (macOS only)

```bash
cd ios && pod install && cd ..
```

### 4. Configure Environment

No configuration is required to start: the app defaults to
`https://api.phlix.app`. To build against your own server, copy the provided
`.env.example` to `.env` in the project root and set:

```env
PHLIX_BASE_URL=http://192.168.1.10:8096
PHLIX_SYNCPLAY_WS_PORT=8097
```

Three facts about this file, from how the code consumes it
(`src/api/client.ts`, `src/syncplay/wsEndpoint.ts`):

- Both keys are read at **native build time** by react-native-config,
  so after changing them you must rebuild the app (`npm run android` / a fresh
  Xcode build) — reloading Metro is not enough. The module is already wired
  on both platforms (`dotenv.gradle` in `android/app/build.gradle`, the
  autolinked pod on iOS), so `npm install` + `pod install` is all it takes.
  These are the only two keys the app reads; `.env` is git-ignored, but
  anything in it ships inside the app bundle unencrypted — put no secrets
  there.
- `PHLIX_SYNCPLAY_WS_PORT` overrides the port the **direct-mode** SyncPlay
  WebSocket dials (default `8097`; a malformed value falls back to the
  default). Asymmetry to know when self-hosting: the hub **relay** port is
  the compiled constant `8804` (`HUB_SYNC_PLAY_PORT` in
  `src/syncplay/hubRelay.ts`) with no env override — remapping it requires a
  code change.
- The `PHLIX_BASE_URL` value is the server **root**: the client appends
  `/api/v1` to every request, so leave that suffix off.

For a quick trial against your server without any rebuild, skip `.env`
entirely and enter the server URL on the login screen instead — that runtime
override is stored in the settings store (visible under Settings) and
out-ranks the build-time value.

## Configuration

### API Configuration

The server the app talks to resolves in this priority order (implemented by
`getServerRoot()` in `src/api/client.ts`):

1. **Runtime override** — the server URL entered on the login screen
   (persisted as `serverUrl` in `src/stores/useSettingsStore.ts`).
2. **Build-time default** — `PHLIX_BASE_URL` from the root `.env`, baked in
   by react-native-config (see step 4 above).
3. **Hardcoded fallback** — `https://api.phlix.app`.

### Native Module Configuration

#### iOS (PhlixPlayer)

The iOS player is implemented as a local CocoaPod in `ios/LocalPods/PhlixPlayer/`. It provides native video playback using AVPlayer.

#### Android (PhlixPlayer)

The Android player is implemented as a native module in `android/app/src/main/java/com/phlixmobile/player/`. It uses ExoPlayer for video playback.

#### Passkeys / WebAuthn (PhlixWebAuthn)

The passkey authenticator is a native module on both platforms:

- **iOS**: `ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift` + `PhlixWebAuthn.m`, built via the existing `PhlixPlayer` podspec (the podspec's source glob already picks up the new files; it only adds the `AuthenticationServices` framework). Uses `ASAuthorizationPlatformPublicKeyCredentialProvider` (iOS 15+).
- **Android**: `android/app/src/main/java/com/phlixmobile/webauthn/PhlixWebAuthnModule.kt` + `PhlixWebAuthnPackage.kt` (registered in `MainApplication.kt`). Uses AndroidX Credential Manager, which requires the `androidx.credentials:credentials` and `:credentials-play-services-auth` dependencies (already added to `android/app/build.gradle`) and `compileSdk` 34+.

The TypeScript surface is `src/native/types.ts` (`PhlixWebAuthnInterface`) wrapped by `src/native/PhlixWebAuthn.ts`. The bridge passes the server's WebAuthn options in as a JSON string and returns the authenticator's response as a JSON string; all base64url encoding/decoding happens natively. The wrapper is guarded so JavaScript and Jest run fine without the native module present (passkey UI is simply hidden).

### Building for iOS

#### Prerequisites

1. Ensure CocoaPods dependencies are installed
2. Open `ios/PhlixMobile.xcworkspace` in Xcode
3. Select your target device or simulator
4. Configure signing (if deploying to a real device)

#### Build Commands

```bash
# Using xcodebuild (requires macOS)
xcodebuild -workspace ios/PhlixMobile.xcworkspace \
  -scheme PhlixMobile \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build

# Or build for release
xcodebuild -workspace ios/PhlixMobile.xcworkspace \
  -scheme PhlixMobile \
  -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build
```

#### Running the App

```bash
# Start Metro bundler
npm start

# In another terminal, run on iOS simulator
npx react-native run-ios

# Or specify a device
npx react-native run-ios --device "iPhone 15"
```

### Building for Android

#### Prerequisites

1. Ensure Android SDK is properly configured
2. Set `ANDROID_HOME` environment variable
3. Add platform tools to PATH

#### Build Commands

```bash
# Debug build
cd android && ./gradlew assembleDebug

# Release build
cd android && ./gradlew assembleRelease
```

The APK will be generated at:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`

#### Running the App

```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npx react-native run-android
```

### Versioning

The root `package.json` `"version"` is **the single source of truth**
(reviews M-MOBILE-15 / M-MOBILE-25):

- Bump it with `npm version <patch|minor|major>` — one line changes.
- **Android**: `android/app/build.gradle` reads `package.json` at configure
  time; `versionName` is the version string and `versionCode` is derived
  semver-int-style (`major*1000000 + minor*1000 + patch`), so every bump
  produces a strictly higher installable code — the rolling `latest`
  sideload artifact can no longer re-publish an indistinguishable version.
- **iOS**: Xcode cannot read `package.json`, so `MARKETING_VERSION` /
  `CURRENT_PROJECT_VERSION` in `ios/PhlixMobile.xcodeproj/project.pbxproj`
  are literal — and `src/__tests__/versionSync.test.ts` fails the test suite
  the moment they drift from the derived pair. Update those four pbxproj
  settings (both targets) in the same commit as the version bump.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- --testPathPattern="src/stores"
```

### Test Structure

Tests are located alongside source files with the naming convention:

```
src/
├── stores/
│   ├── __tests__/
│   │   └── usePlayerStore.test.ts
│   └── usePlayerStore.ts
├── api/
│   ├── __tests__/
│   │   └── client.test.ts
│   └── client.ts
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck
```

## Deployment

The shipped, automated deployment path today is **Android sideload via CI**; the
store paths below are manual procedures the repo documents but does not
automate (there is no fastlane or store-upload machinery in this repository).

### Android

1. **Direct APK (shipped)**: every push to `master` republishes a rolling
   `latest` GitHub prerelease carrying `app-release.apk`. The release build
   currently uses the debug signing config, so the APK is **debug-signed** —
   fine for sideload and testing, not for a store.
2. **Google Play / F-Droid (manual)**: requires a real release keystore and
   `minifyEnabled`/signing changes; the preparation steps are documented in
   [docs/signing.md](docs/signing.md). No CI workflow performs an upload.

### iOS

1. **CI (shipped)**: builds the app for the **iOS Simulator** only (unsigned,
   `CODE_SIGNING_ALLOWED=NO`) as a compile gate — it produces no installable
   device artifact.
2. **TestFlight / App Store (manual)**: archive with Xcode and upload to App
   Store Connect. Certificates, profiles, and exportOptions setup are covered
   in [docs/signing.md](docs/signing.md); the Xcode project itself is not yet
   configured for automated device distribution.

### CI/CD
<!-- M-MOBILE-20 (review mobile__devops): this section is now the verified
     workflow truth (triggers, jobs, and artifacts read from
     .github/workflows/*.yml). Claims it previously made and dropped:
     "iOS Build … manual trigger" (no workflow_dispatch exists on any of
     the three files), "Android debug APK on every push" (it also runs on
     PRs, and master pushes additionally build a release APK + republish
     the rolling `latest` prerelease). -->

Three GitHub Actions workflows — `test.yml`, `build-android.yml`,
`build-ios.yml` — run on every push **and** pull request targeting
`main`/`master`/`develop`:

- **Tests**: `tsc` type check, ESLint, and the Jest suite (serial), with
  coverage uploaded.
- **Build Android**: builds the debug APK and uploads it as a workflow
  artifact on every push/PR. Pushes to `main`/`master` additionally build
  a release APK — debug-signed until real signing is wired (see
  [docs/signing.md](docs/signing.md)) — and republish a rolling `latest`
  GitHub **prerelease** carrying the raw, directly installable APK
  (Actions artifacts are always served zipped; a Release is the only way
  to offer a bare installable `.apk`).
- **Build iOS**: runs on a macOS runner and builds the app for the iOS
  **simulator** unsigned (`xcodebuild … CODE_SIGNING_ALLOWED=NO`) as a
  compile gate, plus a standalone JS bundle uploaded for inspection —
  the bundle is NOT the device payload. There is no device-signing or
  TestFlight/App Store automation; that remains the manual archive
  described in §Deployment.

## Troubleshooting

### Common Issues

#### iOS Build Failures

- Ensure Xcode and Command Line Tools are up to date
- Run `cd ios && pod install` to refresh dependencies
- Clean build folder in Xcode: `Cmd + Shift + K`

#### Android Build Failures

- Verify Android SDK path: `echo $ANDROID_HOME`
- Clean Gradle cache: `cd android && ./gradlew clean`
- Ensure JDK 17 is being used

#### Metro Bundler Issues

- Reset cache: `npm start -- --reset-cache`
- Delete node_modules and reinstall

## Support

For issues and feature requests, please open an issue on the GitHub repository.

## License

This project is licensed under the MIT License.
