# Phlix Mobile — Agent Context

Cross-platform React Native 0.85 app (`phlix-mobile`) connecting to a media server (Jellyfin/Emby-compatible). TypeScript strict, Zustand state, React Navigation v6, native players via `ios/LocalPods/PhlixPlayer/` (AVPlayer/Swift) and `android/app/src/main/java/com/phlixmobile/player/` (ExoPlayer/Kotlin).

See `@./DEVELOPER.md` for full architecture/native module deep-dive and `@./README.md` for setup/deployment.

## Commands

```bash
npm install                              # install JS deps
cd ios && pod install && cd ..           # iOS pods (macOS only)
npm start                                # Metro bundler
npm run ios                              # react-native run-ios
npm run android                          # react-native run-android
npm test                                 # jest (preset: react-native)
npm test -- --coverage                   # jest with coverage
npm test -- --testPathPattern="stores"   # filter test path
npm run lint                             # eslint . --ext .js,.jsx,.ts,.tsx
npm run typecheck                        # tsc --noEmit
npm run build:android:debug              # ./gradlew assembleDebug
npm run build:android:release            # ./gradlew assembleRelease
```

Metro cache reset: `npm start -- --reset-cache`. Android clean: `cd android && ./gradlew clean`.

## Layout

**Entry**: `index.js` → `src/App.tsx` (wraps `GestureHandlerRootView` + `SafeAreaProvider` + `RootNavigator`). `app.json` registers `PhlixMobile`.

**`src/api/`** (axios + manager singletons): `client.ts` (`BASE_URL = 'https://api.phlix.app'`, 30s timeout, auth interceptor, 401 refresh) · `AuthManager.ts` · `LibraryManager.ts` · `PlaybackManager.ts` · `ProfileManager.ts` (multi-user profiles; **admin-gated** `/admin/users/{userId}/profiles` + `/admin/profiles/{id}` + `/admin/profiles/{id}/pin`, bare envelopes) · `AdminManager.ts` (**admin-gated** dashboard/stats/users/libraries; **PER-CONTROLLER envelopes** — `/admin/dashboard/*` is `{success,data,count}`, `/admin/stats/*` is `{data}`, `/admin/users*` + `/libraries*` are BARE `{users}`/`{user}`/`{libraries}`/`{library}`/`{message}`) · `CastManager.ts` (**SERVER-MEDIATED Cast**, 4 backends Chromecast/Roku/AirPlay/DLNA; `discover()` = fault-tolerant fan-out of `/cast/devices`+`/roku/devices`+`/airplay/devices`+`/dlna/renderers`, each leg swallows error→[] so one dead backend never blanks the others; `castTo/pause/resume/stop/seek/status` dispatch per backend; **request bodies are EXACT snake_case** — `media_url`/`audio_url`/`uri`, `mime_type`/`content_type`, `media_item_id`, `position_ms`/`position_ticks` [DLNA ticks = ms × 10000]; **capability gates no-op unsupported transports** — DLNA resume, Roku stop+seek, AirPlay seek; **NO native Cast SDK** — all over HTTP, native SDK is a future enhancement) · `LiveTvManager.ts` (**ADMIN-gated** Live TV / EPG / DVR [E8]; routes start `/admin/livetv`; BARE `{success,<key>}` envelopes — channels→`{channels}`/`{channel}`, guide→`{programs}`/`{program}`, recordings→`{recordings}`/`{recording}`, series-rules→`{rules}`; `getChannelStreamUrl(id)` resolves the 302 stream redirect via a RAW `fetch(absoluteUrl,{redirect:'manual'})` reading the `location` header, falling back to the stream-endpoint URL on opaque redirect — uses `getApiBaseUrl()`+`buildRequestHeaders()` re-exported from `client.ts`; exports `isNotConfiguredError(err)` = axios 404/500 → "no tuner") · `MusicManager.ts` (**Bearer-gated** music browse [E9a]; routes start `/music`; `getArtists/getArtist(name)/getAlbums/getAlbum(name)/getTracks({limit,offset})/getTrack(id)/getNowPlaying()`; BARE envelopes `{artists}`/`{artist}`/`{albums}`/`{album}`/`{tracks,total,limit,offset}`/`{track}`/`{now_playing|null}`; `getTracks` returns the WHOLE `{tracks,total,limit,offset}` envelope [exported `TracksResponse`], the rest unwrap to the inner value; **artist/album path segments are NAMES not ids** → `encodeURIComponent`'d; aggregates across ALL music libraries server-side [no library_id]. **LANDMINE: `getArtists/getAlbums/getTracks/getTrack` return FLAT formatTrack-normalized rows, but `album.tracks` from the album endpoints are RAW media-item rows** whose track fields live under `metadata.*` → normalize each via `normalizeAlbumTrack` from `types/music`. Music playback REUSES the existing Player — a track `id` IS a media_item id, so navigate `Player({itemId: track.id})`; there is NO dedicated music stream route. now-playing `position` is inferred 100ns ticks, display-only) · `index.ts` re-exports.

**`src/stores/`** (Zustand): `useAuthStore.ts` · `usePlayerStore.ts` · `useLibraryStore.ts` · `useSettingsStore.ts` · `useProfileStore.ts` (profiles list + active profile; persists active id to `phlix_active_profile_id`) · `useAdminStore.ts` (admin dashboard + users + libraries state & actions; section-scoped loading/error; loaders swallow into error, mutators rethrow) · `useCastStore.ts` (cast devices/discover state + activeDevice/activeSession/transport; `discover/castTo/pause/resume/stop/seek/refreshStatus`; `disconnect()` clears the session WITHOUT stopping the device [remote keeps playing — console Esc behavior], `stopAndDisconnect()` stops then clears; the 2.5s status-poll interval is owned by `CastScreen`, not the store) · `useLiveTvStore.ts` (Live TV channels/guide/recordings/upcoming/series-rules state with section-scoped loading/error; `notConfigured` flag set when ANY loader hits a 404/500 [`isNotConfiguredError`] so screens show "not set up" not a raw error; loaders swallow→error/notConfigured, mutators [updateChannel/refreshGuide/createRecording/deleteRecording] rethrow; `getChannelStreamUrl` delegates to the manager) · `useMusicStore.ts` (music browse [E9a]: `artists`/`albums`/`tracks` [first page only] + `nowPlaying`, each section-scoped `*Loading`/`*Error`; loaders `loadArtists/loadAlbums/loadTracks/loadNowPlaying` swallow→section error; NO mutators [music is read-only]; `initialState`+`reset()`. Album-level track listing is screen-local — `MusicAlbumScreen` calls `musicManager.getAlbum` directly, not the store; the Tracks tab paginates screen-locally too, the store only holds page 1) · `index.ts` re-exports. Pattern: `create<State>((set, get) => ({ ...initial, ...actions }))`.

**`src/screens/`**: `HomeScreen.tsx` · `LibraryScreen.tsx` · `MediaDetailScreen.tsx` · `PlayerScreen.tsx` · `SearchScreen.tsx` · `SettingsScreen.tsx` · `DownloadsScreen.tsx` · `LoginScreen.tsx` · `ProfileSelectScreen.tsx` (admin-only profile manager; reached via Settings → Profiles, registered in the root stack — NOT the tab bar) · `AdminDashboardScreen.tsx` (admin-only server overview: now-playing/top-users/top-media/storage/activity; reached via Settings → Admin → Dashboard, registered in the root stack; non-admins see an "Admin access required" state) · `AdminUsersScreen.tsx` (admin-only user management: status-filter chips, approve/reject/disable/set-admin/reset-password[shown once]/delete[surfaces 400 self/last-admin], create + edit modals; Settings → Admin → Users) · `AdminLibrariesScreen.tsx` (admin-only library management: add/edit/delete, Scan/Rescan/Match-metadata with a live `getScanStatus` poll [interval started on trigger, ticks all active libraries, stops a library on terminal `completed`/`failed`/null status, full teardown on unmount], per-library scan-history sheet; Settings → Admin → Libraries). Pure screen logic (status filter, paths parse, `isJobActive` poll predicate, badge) is extracted to `src/screens/admin/adminScreenHelpers.ts` and unit-tested in `src/screens/admin/__tests__/`. · `CastScreen.tsx` (server-mediated Cast; takes route PARAMS `{mediaItemId, streamUrl, title?, thumbnail?, durationSecs?}`; discovery picker [FlatList grouped/labeled by backend, pull-to-refresh, "No cast devices found" empty state] → on select casts the item → transport view [status badge, Play/Pause, Stop if `canStop`, Seek bar if `canSeek`] with a 2.5s status poll keyed off `activeDevice` via refs, fully torn down on unmount + when the device clears; **Back leaves the device playing** — only Stop halts it; reached via the Cast button on MediaDetailScreen) · `LiveTvScreen.tsx` (**admin-gated** [E8]; non-admin → "Admin access required"; `notConfigured` → friendly "Live TV is not set up" EmptyState; channel list with a current-program "Now:" label from the guide, expandable per-channel EPG, pull-to-refresh + a "Refresh guide" action; tap a channel → resolve stream URL → navigate to `Player` with `streamUrl`+`liveTitle`; reached via Settings → Admin → Live TV) · `LiveTvRecordingsScreen.tsx` (admin-gated DVR; upcoming + all recordings, create-from-program picker modal, delete-with-confirm, series-rules list-only; reached via Live TV → Recordings). · `MusicScreen.tsx` (music browse [E9a]; takes `{libraryId?}`; segmented **Artists | Albums | Tracks** [custom dark segmented row]; Artists → tap sets in-screen `selectedArtist` → that artist's albums filtered via `albumsForArtist` with a "‹ All artists" back row; Albums → tap navigates `MusicAlbum`; Tracks → paginated 50/page screen-locally via `getTracks` offset → tap navigates `Player({itemId})`; per-section LoadingSpinner/ErrorView/EmptyState; reached when a `type === 'music'` library is tapped on LibraryScreen) · `MusicAlbumScreen.tsx` (reads `albumName` param, `getAlbum(name)`, maps `album.tracks` through `normalizeAlbumTrack` THEN `sortTracks`, header [name + `albumSubtitle`] + ordered position•name•subtitle rows; track tap → `Player({itemId})`). Pure music screen logic (`MUSIC_SEGMENTS`, `albumsForArtist`, `trackSubtitle`, `artistSubtitle`, `albumSubtitle`, `trackPositionLabel`) is extracted to `src/screens/music/musicScreenHelpers.ts` and unit-tested in `src/screens/music/__tests__/`. All `default export`, wrapped in `<SafeContainer>`, use `useNavigation<NativeStackNavigationProp<any>>()`.

> **Live TV is ADMIN-gated + a REACH feature (no tuner on most servers).** Gated on `is_admin`; 404/500 from `/admin/livetv/*` is treated as "not configured", never surfaced raw. **No user-facing Live TV server route exists** (flag upstream). Stream playback resolves a 302 redirect to the tuner HLS URL — the resolved URL must be directly playable; if it still needs auth, the server should add a `GET .../stream-url` JSON or signed-livetv-url (flag upstream).

> **Profiles upstream gap:** server has no user-facing `/users/me/profiles` route — only the admin-gated routes above. Mobile profile management is admin-scoped (non-admins see an informational state). Add a user-facing route upstream for true multi-user mobile.

**`src/components/`**: `layout/SafeContainer.tsx` · `media/{MediaCard,PosterCard,MediaList,ContinueWatching}.tsx` · `player/{PlayerControls,SeekBar}.tsx` · `ui/{LoadingSpinner,ErrorView,EmptyState,SearchBar}.tsx` · `cast/CastButton.tsx` (named export; navigates to the `Cast` route with the item's id + signed `stream_url` [+ title/poster/duration]; wired into MediaDetailScreen's button row for non-series items that carry a `stream_url`). Each subdir has `index.ts` named re-exports.

**`src/navigation/RootNavigator.tsx`**: `NavigationContainer` → root `Stack` (`Login` | `Main` + `Profiles`/`AdminDashboard`/`AdminUsers`/`AdminLibraries`/`LiveTv`/`LiveTvRecordings`/`Music`/`MusicAlbum`/`Cast`/`Player`) → `Tab` (`Home` · `Library` · `Search` · `Downloads` · `Settings`). `Cast` is a headered root-stack screen taking params; `Music` (title "Music", param `{libraryId?}`) and `MusicAlbum` (title "Album", param `{albumName}`) are headered root-stack screens [E9a]; `Player` presented as `fullScreenModal`. Auth gate reads `useAuthStore`.

**`src/types/`**: `media.ts` (`MediaItem`, `Library`, `Series`, `Season`, `Episode`, `UserData`) · `cast.ts` (`CastBackend` union + normalized `CastDevice`/`CastStatus`/`CastSession`; PURE capability helpers `canResume`/`canStop`/`canSeek`; per-backend snake_case DTOs + `normalizeChromecast`/`normalizeRoku`/`normalizeAirplay`/`normalizeDlna`/`normalizeStatus`/`normalizeSession`) · `music.ts` (music domain [E9a]: `Artist`/`Track` [flat]/`RawAlbumTrack` [loose index-signature]/`Album` [`tracks` are RAW rows]/`NowPlaying`; PURE `normalizeAlbumTrack(raw): Track` [top-level field FIRST then `metadata.*` fallback, `name = metadata.title ?? raw.name ?? ''`, safe numeric coercion incl. numeric-string] + `sortTracks(tracks): Track[]` [stable disc→track, nulls last, new array]) · `navigation.ts` (`RootStackParamList` incl. `Profiles` + `Cast: {mediaItemId, streamUrl, title?, thumbnail?, durationSecs?}` + `Music: {libraryId?}` + `MusicAlbum: {albumName}`, `TabParamList`, screen prop types) · `playback.ts` (`StreamInfo`, `DeviceProfile`, `SubtitleTrack`, `AudioTrack`, `PlaybackSession`) · `profile.ts` (`Profile`, `ProfileSettings`, `ContentRatingLabel`; `ratingToLabel`/`labelToRating` int↔label helpers — 0=G…6=UNRATED).

**`src/services/`**: `SecureStorage.ts` (`react-native-keychain`, service `com.phlix.mobile`) · `DownloadService.ts` · `NotificationService.ts` · `index.ts`.

**`src/utils/`**: `formatters.ts` (`formatTime`, `formatRuntime`, `formatFileSize`, `formatRelativeTime`, `truncateText`) · `storage.ts` (typed `AsyncStorage` wrapper).

**`src/native/types.ts`**: `PhlixPlayerInterface`, `PhlixDownloaderInterface`, `PlaybackEvent`, `DownloadEvent`.

**iOS native**: `ios/LocalPods/PhlixPlayer/PhlixPlayer.podspec` · `PhlixPlayerView.swift` (AVPlayer, KVO `status`, periodic time observer) · `PhlixPlayerViewManager.m` (`RCT_EXTERN_MODULE` bridge, props `src`/`autoPlay`/`startPosition`/`volume`/`muted`, methods `play`/`pause`/`seekTo`).

**Android native**: `android/app/src/main/java/com/phlixmobile/MainActivity.kt` · `MainApplication.kt` · `player/PhlixPlayerPackage.kt` · `player/PhlixPlayerView.kt` (ExoPlayer, `@ReactProp` for `src`/`autoPlay`/`startPosition`/`volume`/`muted`/`rate`/`pictureInPicture`, `@ReactMethod` for control). Manifest: `android/app/src/main/AndroidManifest.xml`. Build: `android/app/build.gradle` · `android/build.gradle`.

## Conventions

- **TS strict**: `tsconfig.json` has `strict: true`, alias `@/* → src/*`. Never use `any` for public API surface; screens may use `NativeStackNavigationProp<any>` for cross-stack nav.
- **Imports**: relative within `src/` (no `@/` alias usage in current code) — match existing files.
- **Components**: `React.FC<Props>` arrow functions, `StyleSheet.create({...})` at file bottom, **dark theme palette**: bg `#0f0f1a`, surface `#1a1a2e`, card `#2d2d44`, accent `#0066cc`, text `#fff`/`#888`. Match `android/app/src/main/res/values/colors.xml`.
- **Screens**: wrap in `<SafeContainer edges={['top']}>`, handle `isLoading`/`error` with `<LoadingSpinner fullScreen />` / `<ErrorView onRetry={...}>` / `<EmptyState>`.
- **Stores**: `create<State>((set, get) => ({...}))`, expose `setX` mutators, async actions wrap in try/catch and set `error`/`isLoading`. Settings stores auto-persist via `get().saveSettings()` after each setter.
- **API managers**: classes with async methods returning typed promises, exported as `export const xManager = new XManager(); export default xManager;`.
- **AsyncStorage keys**: prefixed `phlix_` (e.g. `phlix_downloads`, `phlix_settings`).
- **Time units**: ticks are 100ns (divide by `10000000` for seconds, by `600000000` for minutes — see `MediaDetailScreen.tsx`/`formatters.ts`).
- **Navigation params**: declared in `src/types/navigation.ts`; `Player` accepts `{ itemId: string; startPosition?: number; streamUrl?: string; liveTitle?: string }`. The `streamUrl`/`liveTitle` fields are **ADDITIVE (E8)**: when `streamUrl` is present the player plays it verbatim and SKIPS the itemId detail-fetch/transcode/markers lifecycle; absent → the existing itemId path is 100% unchanged.

## Testing

Jest preset `react-native` (`jest.config.js`). Setup in `jest.setup.js` mocks `react-native-safe-area-context`, `@react-navigation/native`, `react-native-gesture-handler`. Test layout: `src/<dir>/__tests__/<file>.test.ts`. `moduleNameMapper`: `^@/(.*)$` → `<rootDir>/src/$1`. Coverage from `src/**/*.{ts,tsx}` excluding `*.d.ts` and `index.ts`.

```bash
npm test                                       # run full jest suite
npm test -- --watch                            # interactive watch mode
npm test -- --testPathPattern="api"            # only api manager tests
npm test -- --testPathPattern="stores"         # only zustand store tests
npm test -- --coverage --collectCoverageFrom="src/**/*.{ts,tsx}"  # coverage report
npm test -- --runInBand                        # serial mode for debugging
npm test -- -u                                 # update snapshots
```

## CI/CD

`.github/workflows/test.yml` (push/PR), `.github/workflows/build-android.yml`, `.github/workflows/build-ios.yml` (manual macOS runner).

```bash
cd android && ./gradlew bundleRelease          # build AAB for Play Store upload
cd android && ./gradlew assembleRelease        # build signed APK
cd ios && xcodebuild -workspace PhlixMobile.xcworkspace -scheme PhlixMobile -configuration Release  # iOS release build
npm run lint -- --fix                          # auto-fix lint errors
npm run typecheck && npm run lint && npm test  # full pre-push gate
```

## Gotchas

- `BASE_URL` is hardcoded in `src/api/client.ts` — change there for self-hosted.
- iOS player is a **LocalPod** under `ios/LocalPods/PhlixPlayer/`; bump `podspec` and re-run `pod install` after Swift changes.
- Android Kotlin code references `MainActivity` for PiP — `PhlixPlayerView.kt` casts `reactApplicationContext.currentActivity as? MainActivity`.
- Push-notification typings live in `src/types/react-native-push-notification.d.ts`.
- `proguard-rules.pro` at `android/app/proguard-rules.pro`.

<!-- caliber:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md CLAUDE.md .claude/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, tell the user: "This project uses Caliber for agent config sync. Run /setup-caliber to get set up."
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->

<!-- caliber:managed:model-config -->
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

<!-- /caliber:managed:model-config -->

<!-- caliber:managed:sync -->
## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, run `/setup-caliber` to configure everything automatically.
<!-- /caliber:managed:sync -->
