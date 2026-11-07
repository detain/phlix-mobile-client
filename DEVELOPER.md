# Phlix Mobile — Developer Guide

This document provides technical documentation for developers working on Phlix Mobile.

## Architecture Overview

Phlix Mobile follows a **modular architecture** with clear separation of concerns:

```
src/
├── api/           # API communication layer (typed managers + axios client)
├── components/    # Reusable UI components (domain-grouped subfolders)
├── hub/           # Hub auth service + relay token provider (federation lane)
├── native/        # Native module TypeScript interfaces + guarded wrappers
├── navigation/    # Navigation configuration (root navigator, deep links)
├── screens/       # Screen-level components (root + admin/ + feature subfolders)
├── services/      # Business logic services (storage, downloads, progress)
├── store/         # Zustand modules WITHOUT the use* convention (see trap below)
├── stores/        # Zustand hooks (use*Store.ts) — the main state layer
├── stubs/         # Test/dev stubs for native Turbo modules (reanimated)
├── syncplay/      # SyncPlay wire client (service, relay, endpoints, catalog)
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── App.tsx        # Root component (+ index.ts entry point)
```

> **The store-vs-stores trap.** There are TWO state directories with confusingly
> similar names: `src/stores/` holds the `use*Store.ts` Zustand hooks, while
> `src/store/` (singular) holds older non-hook modules (`downloadStore.ts`,
> `hubStore.ts`, `syncplayStore.ts`, `serverScope.ts`). AGENTS.md warns about
> it; grep both before assuming a store's location.

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| `api/` | HTTP client, authentication, API endpoint managers |
| `components/` | Reusable UI components (media cards, player controls, cast) |
| `hub/` | Hub sign-in/session (`HubAuthService`) + WS relay bearer (`RelayTokenProvider`) |
| `navigation/` | React Navigation setup, root navigator, deep-link routing |
| `screens/` | Full-screen views, screen-specific logic |
| `services/` | Secure vault, downloads, notifications, playback progress |
| `store/` | Non-hook Zustand modules (hub session, syncplay, downloads, server scope) |
| `stores/` | Hook-style application state (`use*Store.ts`) |
| `stubs/` | JS stubs so native-only modules load under Jest |
| `syncplay/` | SyncPlay protocol client: direct WS + hub relay, error catalog |
| `types/` | TypeScript interfaces and types |
| `utils/` | Formatting, storage helpers, endpoint parsing |

## Component Structure

### Screen Components

Screens live in `src/screens/` (27 root screens plus grouped subfolders).
Root screens: **HomeScreen** (dashboard), **LibraryScreen** (browse by
library), **MediaDetailScreen** (movie/series/music detail), **PlayerScreen**
(full-screen playback + SyncPlay surface), **SearchScreen** (global search),
**SettingsScreen** (app/server/hub preferences), **DownloadsScreen** (offline
content), **LoginScreen** (server sign-in + passkey), **ProfileSelectScreen**
(profile chooser/PIN), **FavoritesScreen**, **WatchHistoryScreen**,
**RecommendationsScreen**, **CollectionsScreen** + **CollectionDetailScreen**,
**MusicScreen** + **MusicAlbumScreen**, **PhotosScreen** + **PhotoAlbumScreen**
+ **PhotoViewerScreen**, **LiveTvScreen** + **LiveTvRecordingsScreen**,
**ParentalControlsScreen**, **PasskeysScreen** (WebAuthn enrollment),
**CastScreen** (device picker/session), and **AdminDashboardScreen** +
**AdminUsersScreen** + **AdminLibrariesScreen**.

`screens/admin/` groups the remaining admin surfaces (**AdminAuthProviders**,
**AdminBackup**, **AdminFsBrowse**, **AdminLogs**, **AdminPlugins**,
**AdminServerSettings**) with `adminScreenHelpers.ts`; feature subfolders
`collections/`, `favorites/`, `music/`, `photos/`, `search/`, `webauthn/` hold
each domain's shared helpers.

### UI Components

Located in `src/components/`, organized by domain:

**Layout Components**
- `SafeContainer`: Safe area wrapper with consistent styling
- `ErrorBoundary`: Root render-phase error boundary — `componentDidCatch` reports to the console (the sanctioned release log sink) and the fallback renders a readable card with a Retry that remounts the protected subtree. Deliberately does not claim to catch async/timer errors — outside React's error semantics.

**Media Components**
- `MediaCard`: Card view for media items
- `PosterCard`: Poster-style card for series/movies
- `MediaList`: Horizontal scrolling list of media
- `ContinueWatching`: Resume playback component
- `RecommendationCard`: Recommendation rail card
- `RatingBadge`: Age/content rating chip
- `ServerSwitcher`: Active-server picker for multi-server setups

**Player Components**
- `PlayerControls`: Play/pause, seek controls
- `SeekBar`: Progress bar with scrubbing
- `SkipButton`: Skip-intro/outro control
- `AudioTrackList`: Audio track selection sheet
- `SubtitleTrackList`: Subtitle track selection sheet
- `SleepTimer`: Sleep-timer chooser
- `QualityMenu`: Bottom-sheet stream-quality picker (Auto / a specific resolution rung). Only shown once a transcode fallback resolves an ABR ladder (`variants[]`); hidden for direct-play titles. Pure selection/URL-resolution logic lives alongside it in `quality.ts`, not in the component itself.

**UI Components**
- `SearchBar`: Reusable search input
- `LoadingSpinner`: Loading indicator
- `EmptyState`: Empty list placeholder
- `ErrorView`: Error display component
- `ContentSkeleton`: Cold-load placeholders in the shape of the content on its way — `DetailSkeleton` mirrors MediaDetailScreen's real proportions (300pt hero band, 35%-width poster with title/meta stack, a rail of three poster cards) and `GridSkeleton` renders two-up poster rows (`rows` prop, default 3). Blocks pulse opacity via RN-core `Animated` only — no new pod — and each instance's loop is cancelled on unmount so fast navigation bursts leak no timers. The boxes hide from screen readers while the containers announce the load ("Loading details" / "Loading results"). Honesty rule: a skeleton is a shape, never fake data — no counts, titles or durations.
- `InsecureConnectionBanner`: Persistent cleartext indicator mounted at the root beside `CastSessionPill`; renders exactly while `useConnectionSecurityStore` reports a live cleartext lane and returns null the moment every lane is encrypted again. Amber and non-dismissible (no close affordance) — the copy states WHAT (traffic readable on this network) and WHAT TO DO (use on trusted networks only), deliberately avoiding scare-red because LAN-http is a ratified working mode.
- `LocalPlaceholder`: Offline-honest poster/photo fallback for the card and photo surfaces that once called a third-party placeholder web service per missing image — a brand-dark tile with a per-kind glyph (poster 🎬 / photo 🖼️), zero network calls, zero bitmap assets. The caller supplies the same width/height it would have given the replaced `<Image>`, so rows never reflow; the tile reads "No preview available" while the glyph itself stays decorative.

**Cast Components** (`components/cast/`)
- `CastButton`: Start-cast affordance
- `CastSessionPill`: Live cast session indicator
- `castPillHelpers`: Pill state/formatting helpers

**SyncPlay Components** (`components/syncplay/`)
- `SyncPlayModal`: Join/create dialog
- `SyncPlayOverlay`: Room status overlay on the player

## Native Module Design

### iOS — PhlixPlayer (Swift)

**Location**: `ios/LocalPods/PhlixPlayer/`

The iOS player is implemented as a local CocoaPod using AVPlayer:

```
ios/LocalPods/PhlixPlayer/
├── PhlixPlayer.podspec       # Pod specification (source glob covers all classes below)
├── PhlixPlayerView.swift     # Swift UIView implementation (AVPlayer)
├── PhlixPlayerViewManager.m  # React Native bridge (Obj-C)
├── PhlixDownloader.swift     # RCTEventEmitter + URLSessionDownloadDelegate
├── PhlixDownloader.m         # RCT_EXTERN_MODULE bridge
├── PhlixRandom.swift         # CSPRNG (SecRandomCopyBytes / kSecRandomDefault)
├── PhlixRandom.m             # RCT_EXTERN_MODULE bridge
├── PhlixWebAuthn.swift       # ASAuthorization passkeys (iOS 15+)
└── PhlixWebAuthn.m           # RCT_EXTERN_MODULE bridge
```

**Key Features**:
- Native AVPlayer for video playback, HLS included
- Picture-in-picture via `AVPictureInPictureController`
- Background audio (`.playback` audio session + `UIBackgroundModes=[audio]`)
- Bridge surface — `play`/`pause`/`seekTo`/`updateVolume`/`updateMuted`/
  `startPiP`/`stopPiP` with `src`/`autoPlay`/`startPosition`/`subtitleUrl`
  props (as implemented — the surface is `PhlixPlayerViewManager.m`)
- Subtitles: the `subtitleUrl` prop is accepted, but native rendering is an
  open `TODO(E3-native)` sidecar seam in `PhlixPlayerView.swift` — no
  AVPlayerLayer subtitle track is wired up yet
- No playback-rate control exists on this bridge

**Integration** — the real `PhlixPlayerViewProps` export (MW-004: this section
formerly showed invented props; the surface below is `src/native/types.ts`
verbatim, modulo comment):
```typescript
// src/native/types.ts
interface PhlixPlayerViewProps {
  src?: string;                // URL to load (direct play / signed stream URL)
  autoPlay?: boolean;
  startPosition?: number;      // SECONDS — the app-internal unit
  volume?: number;
  muted?: boolean;
  subtitleUrl?: string;        // signed WebVTT sidecar URL (see TODO(E3-native) above)
  style?: ViewStyle;
  onPlaybackEvent?: (event: NativeSyntheticEvent<PlaybackEvent>) => void;
  onProgress?: (event: NativeSyntheticEvent<{ currentTime: number; duration: number }>) => void;
  onError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
}

interface PlaybackEvent {
  event: 'ready' | 'play' | 'pause' | 'ended' | 'buffering';
  currentTime?: number;
  duration?: number;
}
```

### Android — PhlixPlayer (Kotlin)

**Location**: `android/app/src/main/java/com/phlixmobile/player/`

The Android player is implemented as a React Native native module:

```
android/.../player/
├── PhlixPlayerView.kt         # Native view component
└── PhlixPlayerPackage.kt     # React Native package
```

**Key Features**:
- media3 1.4.1 ExoPlayer for video playback (HLS via its extractors; DASH is
  NOT wired — `dash_url` exists only in API types with zero consumers)
- WebVTT sidecar subtitles via `MediaItem.SubtitleConfiguration` (setting
  `subtitleUrl` re-prepares the item; embedded-track handling is deferred —
  E3-native)
- Bridge surface — `play`/`pause`/`seekTo`/`setVolume`/`setMuted` with
  `src`/`autoPlay`/`startPosition`/`volume`/`muted`/`subtitleUrl` props
  (as implemented — the surface is `PhlixPlayerViewManager.kt`). No PiP, no
  quality/track selection, no speed control.
- Pauses automatically when the host view pauses (lifecycle safety)

### Passkeys / WebAuthn — PhlixWebAuthn

A second native module implements platform passkeys (WebAuthn) on both platforms. The bridge is intentionally thin: the server's WebAuthn options go in as a JSON string and the authenticator's attestation/assertion comes back as a JSON string — **all base64url <-> binary conversion happens natively** (in Swift on iOS; not at all on Android, where Credential Manager works directly in WebAuthn JSON).

**iOS** — `ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift` + `PhlixWebAuthn.m`:

```
ios/LocalPods/PhlixPlayer/
├── PhlixWebAuthn.swift   # @objc(PhlixWebAuthn) : NSObject — ASAuthorization passkeys (iOS 15+)
└── PhlixWebAuthn.m       # RCT_EXTERN_MODULE bridge (isSupported/register/authenticate)
```

Built via the existing `PhlixPlayer` podspec (its `*.{h,m,swift}` source glob already picks up the files; the only podspec change is adding the `AuthenticationServices` framework). Uses `ASAuthorizationPlatformPublicKeyCredentialProvider`, fully `if #available(iOS 15.0, *)` guarded.

**Android** — `android/app/src/main/java/com/phlixmobile/webauthn/`:

```
android/.../webauthn/
├── PhlixWebAuthnModule.kt   # ReactContextBaseJavaModule — AndroidX Credential Manager
└── PhlixWebAuthnPackage.kt  # ReactPackage (registered in MainApplication.kt)
```

Requires the `androidx.credentials:credentials` and `:credentials-play-services-auth` dependencies (added to `android/app/build.gradle`) and `compileSdk` 34+.

**JS surface** — `src/native/types.ts` (`PhlixWebAuthnInterface`: `isSupported`/`register`/`authenticate`) wrapped by `src/native/PhlixWebAuthn.ts`, which guards every native access so Jest and non-native runs work without the module (`isSupported()` resolves `false`, ceremony calls reject with a clear "passkeys unavailable" error). Orchestration lives in `src/services/WebAuthnService.ts` (options → native ceremony → verify; passwordless login feeds the returned token envelope into `AuthManager.savePasskeyLogin` and sets `useAuthStore`).

> **Device-only at runtime.** The passkey ceremony shows the system biometric/PIN sheet, which only runs on a real device — CI compiles the native code but cannot run a ceremony, and the JS layer is fully covered by Jest with the native module mocked. Cross-device portability additionally requires the **server** to publish relying-party association files (`apple-app-site-association` `webcredentials` for iOS, `assetlinks.json` for Android) for the `rpId` it returns.

### Downloads — PhlixDownloader (iOS)

**iOS** — `ios/LocalPods/PhlixPlayer/PhlixDownloader.swift` + `PhlixDownloader.m`:

```
ios/LocalPods/PhlixPlayer/
├── PhlixDownloader.swift   # @objc(PhlixDownloader) : RCTEventEmitter, URLSessionDownloadDelegate
└── PhlixDownloader.m       # RCT_EXTERN_MODULE bridge (startDownload/pause/resume/cancel/deleteFile)
```

Method signatures, event names and payload keys are kept **IDENTICAL** to the Android module (`android/.../download/PhlixDownloaderModule.kt`) and the TS interface (`src/native/types.ts`: `PhlixDownloaderInterface` + `DOWNLOAD_EVENTS`) — the Swift header records this law, and the event-name strings must stay byte-ident with `DOWNLOAD_EVENTS`. The JS layer is `src/services/DownloadService.ts`; when the native module is absent it **fails the task loudly with the named missing-module error** (MW-027, review mobile__crossfe #14 — the old simulated-downloader fallback is gone: it faked progress to 100% and marked tasks complete over files never written), so Jest and non-native runs surface the registration failure instead of hiding it (the file header carries an honest UNTESTED-in-CI note: no device/simulator build runs in this environment).

### Random — PhlixRandom (both platforms)

CSPRNG-backed random bytes for device identity — the device id used to be `Math.random()`-shaped (predictable under a known PRNG state) until this module replaced it.

- **iOS** — `ios/LocalPods/PhlixPlayer/PhlixRandom.swift` + `PhlixRandom.m`: `SecRandomCopyBytes` / `kSecRandomDefault`.
- **Android** — `android/.../random/PhlixRandomModule.kt` + `PhlixRandomPackage.kt` (registered in `MainApplication.kt`): `java.security.SecureRandom`.

**JS surface** — `src/native/types.ts` (`PhlixRandomInterface`: `randomHex(byteCount)`) wrapped by `src/native/PhlixRandom.ts` (`nativeRandomHex`), which treats module-absent and native failure as one honest fallback path; the sole consumer is `src/api/deviceIdentity.ts` (v4 UUID minting). Method name, arg order and the hex-string out shape MUST match across both platforms and the TS interface.

### TypeScript Interfaces

**Location**: `src/native/types.ts`

MW-004 truth pass: this section used to show `NativePlaybackSession`,
`SubtitleTrack` and `AudioTrack` "from this file" — none of the three is
declared here (or anywhere in the repo). The file's real exports:

```typescript
// src/native/types.ts — exported surface
interface PlaybackEvent { … }             // player event envelope (see iOS Integration above)
interface DownloadEvent { … }             // downloader event envelope
interface PhlixPlayerViewProps { … }      // the view's props (the bridge surface)
interface PhlixPlayerInterface { … }      // NativeModule: play/pause/seekTo(seconds)/
                                          // setVolume/setMuted/getCurrentPosition/getDuration
interface PhlixDownloaderInterface { … }  // startDownload/pause/resume/cancel/deleteFile, documentsPath
interface PhlixWebAuthnInterface { … }    // isSupported/register/authenticate (JSON-string ceremony bridge)
interface PhlixRandomInterface { … }      // randomHex(byteCount) — CSPRNG for device identity
interface DownloadProgressPayload { … }   // per-event payload shapes for the four DOWNLOAD_EVENTS
interface DownloadCompletePayload { … }
interface DownloadErrorPayload { … }
interface DownloadPausedPayload { … }
const DOWNLOAD_EVENTS = {                 // native event NAME strings
  progress: 'PhlixDownloadProgress',      // (keep byte-ident with the iOS/Android emitters)
  complete: 'PhlixDownloadComplete',
  error: 'PhlixDownloadError',
  paused: 'PhlixDownloadPaused',
} as const;
```

Where the **track** types actually live: the `SubtitleTrack`/`AudioTrack`
that `usePlayerStore` carries are re-exported VERBATIM from
`@phlix/contracts` by `src/types/playback.ts:55` — the local mirror that once
existed here was deleted deliberately (the file's header records why), and
the pinned tag (`github:detain/phlix-contracts#v0.5.6`) is the wire source
of truth. Don't re-declare track shapes in this repo.

## State Management

Phlix Mobile uses **Zustand** for state management - a lightweight alternative to Redux.

### Store Architecture

`src/stores/` (Zustand hooks):

| Store | Purpose |
|-------|---------|
| `useAuthStore` | Authentication state, user session |
| `usePlayerStore` | Playback state, current media, tracks |
| `useLibraryStore` | Media libraries, cached content |
| `useSettingsStore` | User preferences, app settings |
| `useAdminStore` | Admin dashboards/lists |
| `useCastStore` | Cast devices/session state |
| `useCollectionStore` | Collections + smart playlists |
| `useConnectionSecurityStore` | Cleartext-connection ledger: dial seams `mark()` their resolved URL per lane (`rest`/`syncplayWs`/`hubRelay`/`hubApi`); one banner listens (M-MOBILE-51) |
| `useFavoritesStore` | Favorite items |
| `useLiveTvStore` | Live TV guide/recordings |
| `useMusicStore` | Music library/albums |
| `usePhotoStore` | Photo libraries/albums |
| `useProfileStore` | Profile selection/PIN |
| `useSearchStore` | Search queries/results |
| `useWatchHistoryStore` | Resume/continue-watching rails |
| `useWebAuthnStore` | Passkey enrollment state |

`src/store/` (singular — non-hook modules): `hubStore.ts` (hub session +
vault-persisted tokens), `syncplayStore.ts` (SyncPlay room UI state),
`downloadStore.ts` (download queue mirror), `serverScope.ts` (active-server
scoping helpers).

### useAuthStore

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
```

### usePlayerStore

```typescript
interface PlayerState {
  // Current playback
  currentItem: MediaItem | null;
  currentSession: PlaybackSession | null;
  streamInfo: StreamInfo | null;

  // Playback state
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;

  // Tracks
  subtitleTracks: SubtitleTrack[];
  currentSubtitleTrackId: string | null;
  audioTracks: AudioTrack[];
  currentAudioTrackId: string | null;

  // Actions
  setCurrentItem: (item: MediaItem | null) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  // ... more actions
}
```

### useLibraryStore

```typescript
interface LibraryState {
  libraries: Library[];
  movies: MediaItem[];
  series: MediaItem[];
  music: MediaItem[];
  photos: MediaItem[];
  isLoading: boolean;
  fetchLibraries: () => Promise<void>;
  fetchLibraryContent: (libraryId: string) => Promise<void>;
}
```

### useSettingsStore

```typescript
interface SettingsState {
  // Playback
  defaultQuality: string; // 'auto' — PlayerScreen seeds its quality picker
                          //          from this and writes fresh picks back
  autoplay: boolean; // true
  autoPlayNextEpisode: boolean; // true
  defaultSubtitleLanguage: string; // 'en'
  defaultAudioLanguage: string; // 'en'
  // Downloads
  downloadQuality: string; // 'high'
  maxConcurrentDownloads: number; // 2
  downloadPath: string; // '' (OS default)
  downloadOverWifiOnly: boolean; // true — enforced in DownloadService.processQueue()
  // Appearance / app
  theme: 'dark' | 'light' | 'system'; // 'dark'
  enableNotifications: boolean; // true
  enableBiometricAuth: boolean; // false
  // Server
  serverUrl: string; // ''
  serverName: string; // ''
  // Actions — every setter writes state AND persists (saveSettings());
  // resetSettings() restores the defaults and REMOVES the persisted blob.
  setDefaultQuality: (quality: string) => void;
  setAutoplay: (autoplay: boolean) => void;
  setAutoPlayNextEpisode: (autoplay: boolean) => void;
  setDefaultSubtitleLanguage: (language: string) => void;
  setDefaultAudioLanguage: (language: string) => void;
  setDownloadQuality: (quality: string) => void;
  setMaxConcurrentDownloads: (max: number) => void;
  setDownloadPath: (path: string) => void;
  setDownloadOverWifiOnly: (enabled: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setEnableNotifications: (enable: boolean) => void;
  setEnableBiometricAuth: (enable: boolean) => void;
  setServerUrl: (url: string) => void;
  setServerName: (name: string) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  resetSettings: () => void;
}
```

The persisted blob (`phlix_settings` in AsyncStorage) passes through
`sanitizeSettings` on load: unknown keys are dropped, wrong-typed scalars
fall back to their defaults, and `theme` must additionally hit the
`'dark' | 'light' | 'system'` whitelist — a stale or tampered blob can
never smuggle a value the typed state would choke on (M-MOBILE-31).

## API Layer

### Client Architecture

**Location**: `src/api/client.ts`

The API client uses Axios with:

- **Base URL**: Resolved by `getServerRoot()` — Settings/login `serverUrl` runtime override, else build-time `PHLIX_BASE_URL` (`.env` via react-native-config), else the hardcoded default; `/api/v1` is appended by the client
- **Request Interceptor**: Automatically adds auth token to requests
- **Response Interceptor**: Handles 401 errors and token refresh
- **Timeout**: 30 seconds default

### Authentication Flow

1. User submits credentials via `AuthManager.login()`
2. Server returns `access_token` and `refresh_token`
3. The JWT pair is written to the keychain vault (`SecureStorage.storeTokens`, iOS Keychain / Android Keystore via `react-native-keychain`) together with a non-secret pin of the minting host; only the user profile goes to `AsyncStorage`
4. All subsequent requests include `Authorization: Bearer <token>` (the request interceptor reads the access JWT from the vault)
5. On 401 response, the interceptor refreshes using the vault's refresh JWT; the rotated pair is re-written to the vault and re-pinned to the host that served the issuance
6. If refresh fails, the user is logged out — `SecureStorage.clearTokens()` wipes both vault slots, the minted-host pin, and the legacy plaintext keys

### Token & Data Storage Model

**Vault (keychain).** `src/services/SecureStorage.ts` is the only sanctioned
home for auth JWTs — four `react-native-keychain` generic-password slots
(the plugin's own surface: Keychain on iOS, Keystore on Android):

| Slots | Contents |
|-------|----------|
| `com.phlix.mobile.access` / `.refresh` | Server-session JWT pair (login, register, passkey, every refresh rotation) |
| `com.phlix.mobile.hub.access` / `.hub.refresh` | Hub-session JWT pair minted by `HubAuthService` sign-in — separate slots so hub and server sign-out never wipe each other |

**`AsyncStorage` holds non-secret data only:**

| Key | Contents |
|-----|----------|
| `phlix_hub_session` | Sanitized hub envelope `{ hubUrl, session: { expiresAt, userId }, activeServerId, connectionMode }` — written through the single `buildSanitizedHubBlob` builder, so a JWT field can never drift back into it |
| `user` | Server user profile (from the auth response / `getMe`) — the one live key without the `phlix_` prefix |
| `phlix.access_issued_host` | Which host minted the stored server pair — integrity metadata, not a credential: the direct SyncPlay dial is checked against it |
| `phlix_settings` · `phlix_active_profile_id` · `phlix_device_id` · `phlix_downloads_v2` · `phlix_download_storage` | Preferences, profile id, device identity, download records |

**Legacy migration is never-orphan.** Pre-vault sessions kept JWTs as
plaintext `AsyncStorage` (`access_token` / `refresh_token`; the hub pair
inside the `phlix_hub_session` blob). Each lane migrates on first read:
read → secure-write → and only once the secure side settles, delete the
plaintext. A failing vault write leaves the plaintext copy in place for the
next read to retry — an existing session is never orphaned, which honestly
means that while the keychain is failing, those JWTs do remain in plaintext
storage. Crash residue (vault committed, blob rewrite died) is swept on the
next read: the vault wins and the redundant plaintext half is sanitized. If
the OS wipes the vault pair out from under a sanitized blob, no credential
exists on either side — the corpse blob is swept and the user signs in
again; there is never a credential-less fallback session.

**Sign-out wipes both halves.** `AuthManager.logout()` clears the server
slots, the minted-host pin, the legacy keys, and the `user` profile;
`signOutOfHub()` removes the `phlix_hub_session` blob and the hub slots.
A failing vault read is treated as signed-out (`getAccessToken()` returns
null), never as a plaintext fallback.

### API Managers

`src/api/` holds seventeen manager modules (MW-003: this table used to list
four of them). Every one is a static-method class over `client.ts`; the
row's methods are the actual exported surface:

| Manager | Purpose |
|---------|---------|
| `AdminManager` | Admin rails: users (list/create/approve/enable/disable/delete), libraries + catalog sources, plugins, backups, activity log, FS browse, auth-provider enable/disable |
| `AuthManager` | Login/register/refresh/logout, credential + passkey-login persistence, server discovery, `getCurrentUser`/`getMe` |
| `CastManager` | Cast device discovery (DLNA/Roku/Chromecast/AirPlay) + session control (castTo/status/pause/resume/seek/stop) |
| `CollectionManager` | Collections + smart playlists: CRUD, item add/remove/bulk, refresh, per-library listing |
| `FavoritesManager` | Favorites add/remove/list + personal ratings (`setRating`/`clearRating`/`getMediaRatings`) |
| `LibraryManager` | Library browsing: items/letter-index/seasons/episodes/recently-added, media-item fetch, search |
| `LiveTvManager` | Channels + EPG guide, programs, recordings (list/create/delete), series rules, upcoming, channel stream URL |
| `MarkerManager` | Playback markers + the playback-info payload (track rails + intro/credits markers) feeding `PlayerScreen` |
| `MusicManager` | Music library: artists/albums/tracks + now-playing rail |
| `ParentalControlsManager` | Content tags, access schedules, stream limits (profile-gating rails) |
| `PhotoManager` | Photo libraries/albums, photo detail, slideshow rail |
| `PlaybackManager` | Playback sessions: create/report-progress/complete/end + signed stream URL (`getStreamUrl`) |
| `ProfileManager` | User profiles: list/create/update/delete + per-profile PIN set/clear |
| `SyncPlayManager` | SyncPlay rooms over the `/syncplay/groups` REST rails (create/join/public list/WebSocket URL) + `mapPlaybackState` wire decode |
| `TranscodeManager` | Start/poll on-demand transcode jobs (`startTranscode`/`getStatus`/`prepare`); surfaces the ABR quality ladder (`variants[]`) the in-player `QualityMenu` picks from |
| `UserManager` | Account settings + watch history: continue-watching/recently-watched rails, history clear/delete |
| `WebAuthnManager` | Passkey ceremony payloads: register/login options, credential list/delete |

Supporting modules, not managers: `client.ts` (axios + interceptors),
`hubAwareClient.ts` (scoped client factory for the hub-relay lane),
`deviceIdentity.ts` (stable CSPRNG device id), `index.ts` (re-exports).

## Building and Testing Guide

### Development Workflow

1. **Start Metro Bundler**
   ```bash
   npm start
   ```

2. **Run on iOS**
   ```bash
   npx react-native run-ios
   ```

3. **Run on Android**
   ```bash
   npx react-native run-android
   ```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific tests
npm test -- --testPathPattern="stores"

# Watch mode
npm test -- --watch
```

### TypeScript

```bash
# Type check without emitting
npm run typecheck

# Or use TypeScript compiler directly
npx tsc --noEmit
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix issues
npm run lint -- --fix
```

### Native Module Development

#### iOS Native Module Updates

1. Modify files in `ios/LocalPods/PhlixPlayer/` (this pod holds all four iOS native families — `PhlixPlayer*`, `PhlixDownloader*`, `PhlixRandom*`, `PhlixWebAuthn*` — the source glob auto-includes new files)
2. Run `pod install` in `ios/` directory
3. Clean and rebuild: `xcodebuild clean`
4. Verify in Xcode that changes compile
5. If the change added/removed a native pod (a new dependency with an iOS podspec, not just an edit to existing pod sources), commit the regenerated `ios/Podfile.lock` — CI's `npm run check:podfile-lock` leg (`scripts/check-podfile-lock.mjs`, M-MOBILE-09) fails loud when the committed lock no longer names every auto-linked pod; the gate needs no macOS, so run it locally before pushing

#### Android Native Module Updates

1. Modify files in `android/app/src/main/java/com/phlixmobile/` (`player/` for the video player, `download/` for the downloader, `random/` for the CSPRNG, `webauthn/` for passkeys); register new packages in `MainApplication.kt`
2. Clean Gradle: `./gradlew clean`
3. Rebuild: `./gradlew assembleDebug`

> Passkey ceremonies cannot be exercised in a simulator/emulator or CI — they need a real device. Verify a passkey register/login flow on hardware after touching the WebAuthn modules.

### Debugging

#### JavaScript/React

- Use React DevTools
- Use Chrome DevTools (debugging via Metro)
- Add console.log statements

#### Native Code

**iOS**: Use Xcode's debugger and LLDB

**Android**: Use Android Studio's debugger and Logcat

```bash
# View Android logs
adb logcat | grep PhlixMobile
```

## Project Structure Summary

```
phlix-mobile/
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios client with interceptors
│   │   ├── hubAwareClient.ts # Scoped client factory (hub-relay lane)
│   │   ├── deviceIdentity.ts # Stable CSPRNG device id
│   │   ├── <Name>Manager.ts  # The 17 API managers (see "API Managers" table)
│   │   └── index.ts          # Re-exports
│   ├── components/
│   │   ├── layout/          # Layout components
│   │   ├── media/           # Media display components
│   │   ├── player/          # Player controls
│   │   └── ui/              # General UI components
│   ├── navigation/
│   │   ├── RootNavigator.tsx# Main navigation setup
│   │   └── index.ts
│   ├── native/
│   │   └── types.ts         # Native module interfaces
│   ├── screens/
│   │   ├── HomeScreen.tsx … PlayerScreen.tsx (27 root screens)
│   │   ├── admin/           # Admin* screens + adminScreenHelpers.ts
│   │   └── collections|favorites|music|photos|search|webauthn/  # helpers
│   ├── services/
│   │   ├── SecureStorage.ts # Auth token vault (OS keychain)
│   │   ├── DownloadService.ts# Download management
│   │   ├── NotificationService.ts
│   │   └── index.ts
│   ├── store/               # Non-hook modules (hubStore, syncplayStore, …)
│   ├── stores/
│   │   ├── useAuthStore.ts  # Auth state
│   │   ├── usePlayerStore.ts# Playback state
│   │   ├── useLibraryStore.ts
│   │   ├── useSettingsStore.ts
│   │   └── … (16 use*Store.ts modules total)
│   ├── stubs/               # Jest-safe native module stubs
│   ├── syncplay/            # Wire client: SyncPlayService, hubRelay,
│   │                        # wsEndpoint, sha256, syncplayErrors catalog
│   ├── hub/                 # HubAuthService, RelayTokenProvider
│   ├── types/
│   │   ├── media.ts         # Media item types
│   │   ├── navigation.ts    # Navigation types
│   │   └── playback.ts      # Playback types
│   ├── utils/
│   │   ├── formatters.ts    # Time, date formatting
│   │   ├── storage.ts       # AsyncStorage helpers
│   │   └── index.ts
│   ├── App.tsx              # Root component
│   └── index.ts             # Entry point
├── ios/
│   └── LocalPods/
│       └── PhlixPlayer/     # Native iOS player
├── android/
│   └── app/src/main/java/com/phlixmobile/
│       ├── player/          # PhlixPlayerView.kt + view manager
│       ├── download/        # PhlixDownloaderModule.kt + package
│       ├── random/          # PhlixRandomModule.kt + package (SecureRandom CSPRNG)
│       └── webauthn/        # Passkey ceremony module
└── .github/
    └── workflows/           # CI/CD pipelines (test, build-android, build-ios)
```
