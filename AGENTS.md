# Phlix Mobile — Agent Context

Cross-platform React Native 0.85 app (`phlix-mobile`) connecting to a media server (Jellyfin/Emby-compatible). TypeScript strict, Zustand state, React Navigation v6, native players via `ios/LocalPods/PhlixPlayer/` (AVPlayer/Swift) and `android/app/src/main/java/com/phlixmobile/player/` (ExoPlayer/Kotlin). Detailed architecture: `DEVELOPER.md`. Setup: `README.md`.

## Commands

```bash
npm install
cd ios && pod install && cd ..
npm start                                # Metro
npm run ios                              # react-native run-ios
npm run android                          # react-native run-android
npm test                                 # jest (preset react-native)
npm test -- --coverage
npm test -- --testPathPattern="stores"
npm run lint                             # eslint . --ext .js,.jsx,.ts,.tsx
npm run typecheck                        # tsc --noEmit
npm run build:android:debug              # ./gradlew assembleDebug
npm run build:android:release            # ./gradlew assembleRelease
```

Metro reset: `npm start -- --reset-cache`. Android clean: `cd android && ./gradlew clean`.

## Layout

**Entry**: `index.js` → `src/App.tsx` (`GestureHandlerRootView` + `SafeAreaProvider` + `RootNavigator`). `app.json` registers `PhlixMobile`.

**`src/api/`**: `client.ts` (axios, `BASE_URL = 'https://api.phlix.app'`, 30s timeout, auth + 401-refresh interceptors) · `AuthManager.ts` · `LibraryManager.ts` · `PlaybackManager.ts` · `index.ts`.

**`src/stores/`** (Zustand): `useAuthStore.ts` · `usePlayerStore.ts` · `useLibraryStore.ts` · `useSettingsStore.ts` · `index.ts`. Pattern: `create<State>((set, get) => ({ ...initial, ...actions }))`.

**`src/screens/`**: `HomeScreen.tsx` · `LibraryScreen.tsx` · `MediaDetailScreen.tsx` · `PlayerScreen.tsx` · `SearchScreen.tsx` · `SettingsScreen.tsx` · `DownloadsScreen.tsx` · `LoginScreen.tsx`. Default-export `React.FC`, wrapped in `<SafeContainer>`.

**`src/components/`**: `layout/SafeContainer.tsx` · `media/{MediaCard,PosterCard,MediaList,ContinueWatching}.tsx` · `player/{PlayerControls,SeekBar}.tsx` · `ui/{LoadingSpinner,ErrorView,EmptyState,SearchBar}.tsx`. Each subdir has an `index.ts` of named re-exports.

**`src/navigation/RootNavigator.tsx`**: root `Stack` (`Login` | `Main`+`Player`) → bottom `Tab` (`Home` · `Library` · `Search` · `Downloads` · `Settings`). `Player` is `fullScreenModal`.

**`src/types/`**: `media.ts` (`MediaItem`, `Library`, `Series`, `Season`, `Episode`, `UserData`) · `navigation.ts` (`RootStackParamList`, `TabParamList`) · `playback.ts` (`StreamInfo`, `DeviceProfile`, `SubtitleTrack`, `AudioTrack`, `PlaybackSession`).

**`src/services/`**: `SecureStorage.ts` (`react-native-keychain`, service `com.phlix.mobile`) · `DownloadService.ts` · `NotificationService.ts` · `index.ts`.

**`src/utils/`**: `formatters.ts` (`formatTime`, `formatRuntime`, `formatFileSize`, `formatRelativeTime`, `truncateText`) · `storage.ts` (typed `AsyncStorage` wrapper).

**`src/native/types.ts`**: `PhlixPlayerInterface`, `PhlixDownloaderInterface`, `PlaybackEvent`, `DownloadEvent`.

**iOS native**: `ios/LocalPods/PhlixPlayer/PhlixPlayer.podspec` · `PhlixPlayerView.swift` (AVPlayer, KVO on `status`, periodic time observer) · `PhlixPlayerViewManager.m` (`RCT_EXTERN_MODULE` bridge — props `src`/`autoPlay`/`startPosition`/`volume`/`muted`, methods `play`/`pause`/`seekTo`).

**Android native**: `android/app/src/main/java/com/phlixmobile/MainActivity.kt` · `MainApplication.kt` · `player/PhlixPlayerPackage.kt` · `player/PhlixPlayerView.kt` (ExoPlayer, `@ReactProp` for `src`/`autoPlay`/`startPosition`/`volume`/`muted`/`rate`/`pictureInPicture`, `@ReactMethod` for control). Manifest: `android/app/src/main/AndroidManifest.xml`. Build: `android/app/build.gradle` · `android/build.gradle`.

## Conventions

- **TS strict** (`tsconfig.json`), alias `@/* → src/*` (only used in tests via `moduleNameMapper`).
- Components: `React.FC<Props>` arrow function, `StyleSheet.create` at bottom, dark palette bg `#0f0f1a` / surface `#1a1a2e` / card `#2d2d44` / accent `#0066cc` / text `#fff`+`#888` (matches `android/app/src/main/res/values/colors.xml`).
- Screens: wrap in `<SafeContainer edges={['top']}>`, fall back to `<LoadingSpinner fullScreen />` / `<ErrorView onRetry=...>` / `<EmptyState>`.
- Stores: typed `interface State`, async actions wrap in try/catch and set `error`/`isLoading`. `useSettingsStore` auto-saves via `get().saveSettings()` after each setter.
- API managers: classes with async methods returning typed promises, exported `export const xManager = new XManager(); export default xManager;`.
- DTOs use snake_case (`poster_url`, `run_time_ticks`, `user_data`) — match server.
- AsyncStorage keys prefixed `phlix_` (`phlix_settings`, `phlix_downloads`).
- Ticks are 100ns: `/10000000` for seconds, `/600000000` for minutes (see `MediaDetailScreen.tsx`, `formatters.ts`).
- Navigation params declared in `src/types/navigation.ts`. `Player` route: `{ itemId: string; startPosition?: number }`.

## Testing

Jest preset `react-native` (`jest.config.js`). Setup in `jest.setup.js` mocks `react-native-safe-area-context`, `@react-navigation/native`, `react-native-gesture-handler`. Layout: `src/<dir>/__tests__/<file>.test.ts`. `moduleNameMapper`: `^@/(.*)$` → `<rootDir>/src/$1`. Coverage from `src/**/*.{ts,tsx}` excluding `*.d.ts` and `index.ts`.

## CI/CD

`.github/workflows/test.yml` (push/PR), `.github/workflows/build-android.yml`, `.github/workflows/build-ios.yml` (manual macOS runner).

## Gotchas

- `BASE_URL` hardcoded in `src/api/client.ts`.
- iOS player is a **LocalPod** (`ios/LocalPods/PhlixPlayer/`) — bump `podspec` and re-run `pod install` after Swift changes.
- `PhlixPlayerView.kt` casts `currentActivity as? MainActivity` for PiP.
- Push-notification typings in `src/types/react-native-push-notification.d.ts`.
- ProGuard rules at `android/app/proguard-rules.pro`.

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
  2. Run: `caliber refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md CALIBER_LEARNINGS.md .agents/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, read `.agents/skills/setup-caliber/SKILL.md` and follow its instructions to install Caliber.
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->
