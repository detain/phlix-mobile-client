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

**`src/api/`** (axios + manager singletons): `client.ts` (`BASE_URL = 'https://api.phlix.app'`, 30s timeout, auth interceptor, 401 refresh) · `AuthManager.ts` · `LibraryManager.ts` · `PlaybackManager.ts` · `index.ts` re-exports.

**`src/stores/`** (Zustand): `useAuthStore.ts` · `usePlayerStore.ts` · `useLibraryStore.ts` · `useSettingsStore.ts` · `index.ts` re-exports. Pattern: `create<State>((set, get) => ({ ...initial, ...actions }))`.

**`src/screens/`**: `HomeScreen.tsx` · `LibraryScreen.tsx` · `MediaDetailScreen.tsx` · `PlayerScreen.tsx` · `SearchScreen.tsx` · `SettingsScreen.tsx` · `DownloadsScreen.tsx` · `LoginScreen.tsx`. All `default export`, wrapped in `<SafeContainer>`, use `useNavigation<NativeStackNavigationProp<any>>()`.

**`src/components/`**: `layout/SafeContainer.tsx` · `media/{MediaCard,PosterCard,MediaList,ContinueWatching}.tsx` · `player/{PlayerControls,SeekBar}.tsx` · `ui/{LoadingSpinner,ErrorView,EmptyState,SearchBar}.tsx`. Each subdir has `index.ts` named re-exports.

**`src/navigation/RootNavigator.tsx`**: `NavigationContainer` → root `Stack` (`Login` | `Main`+`Player`) → `Tab` (`Home` · `Library` · `Search` · `Downloads` · `Settings`). Player presented as `fullScreenModal`. Auth gate reads `useAuthStore`.

**`src/types/`**: `media.ts` (`MediaItem`, `Library`, `Series`, `Season`, `Episode`, `UserData`) · `navigation.ts` (`RootStackParamList`, `TabParamList`, screen prop types) · `playback.ts` (`StreamInfo`, `DeviceProfile`, `SubtitleTrack`, `AudioTrack`, `PlaybackSession`).

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
- **Navigation params**: declared in `src/types/navigation.ts`; `Player` accepts `{ itemId: string; startPosition?: number }`.

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
