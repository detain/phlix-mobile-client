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

See the source tree for the full `src/api/`, `src/stores/`, `src/screens/`, `src/components/`, `src/types/`, `src/services/`, and native module breakdown — the canonical per-file documentation lives inline in this file's original sections and in `@./DEVELOPER.md`.

**`src/components/`** player subdir: `player/{PlayerControls,SeekBar,SkipButton,QualityMenu,SleepTimer,SubtitleTrackList,AudioTrackList}.tsx` — `QualityMenu.tsx` [G3] is the bottom-sheet quality picker (logic in the pure sibling `player/quality.ts`); **`SleepTimer.tsx`** is the sleep-timer picker wired into `PlayerScreen.tsx` (iOS timer support bridged via `ios/LocalPods/PhlixPlayer/PhlixPlayerView.swift` + `PhlixPlayerViewManager.m`); **`SubtitleTrackList.tsx`/`AudioTrackList.tsx`** [P3B-S7] are the subtitle- and audio-track selection lists wired into `PlayerScreen.tsx` and re-exported from `src/components/player/index.ts`. **`src/components/syncplay/{SyncPlayModal,SyncPlayOverlay}.tsx`** [P8-S4] (re-exported from `src/components/syncplay/index.ts`) are the SyncPlay group-watch UI wired into `PlayerScreen.tsx`, backed by `src/api/SyncPlayManager.ts` (re-exported from `src/api/index.ts`) and the fan-out coordinator `src/syncplay/SyncPlayService.ts`. **`src/screens/WatchHistoryScreen.tsx`** is the watch-history screen backed by `src/stores/useWatchHistoryStore.ts`, reached from `src/screens/SettingsScreen.tsx`, registered in `src/navigation/RootNavigator.tsx` with params in `src/types/navigation.ts`.

> NOTE: This is a condensed regeneration. The full per-file API/store/screen/type documentation is maintained in the repository's committed CLAUDE.md history and `@./DEVELOPER.md`; do not treat this condensed layout as authoritative over those.

## Conventions

- **TS strict**: `tsconfig.json` has `strict: true`, alias `@/* → src/*`. Never use `any` for public API surface; screens may use `NativeStackNavigationProp<any>` for cross-stack nav.
- **Imports**: relative within `src/` (no `@/` alias usage in current code) — match existing files.
- **Components**: `React.FC<Props>` arrow functions, `StyleSheet.create({...})` at file bottom, **dark theme palette**: bg `#0f0f1a`, surface `#1a1a2e`, card `#2d2d44`, accent `#0066cc`, text `#fff`/`#888`. Match `android/app/src/main/res/values/colors.xml`.
- **Screens**: wrap in `<SafeContainer edges={['top']}>`, handle `isLoading`/`error` with `<LoadingSpinner fullScreen />` / `<ErrorView onRetry={...}>` / `<EmptyState>`.
- **Stores**: `create<State>((set, get) => ({...}))`, expose `setX` mutators, async actions wrap in try/catch and set `error`/`isLoading`.
- **API managers**: classes with async methods returning typed promises, exported as `export const xManager = new XManager(); export default xManager;`.
- **AsyncStorage keys**: prefixed `phlix_`.
- **Time units**: ticks are 100ns (divide by `10000000` for seconds, by `600000000` for minutes).
- **Navigation params**: declared in `src/types/navigation.ts`.

## Testing

Jest preset `react-native` (`jest.config.js`). Setup in `jest.setup.js`. Test layout: `src/<dir>/__tests__/<file>.test.ts`. `moduleNameMapper`: `^@/(.*)$` → `<rootDir>/src/$1`.

```bash
npm test                                       # run full jest suite
npm test -- --watch                            # interactive watch mode
npm test -- --testPathPattern="api"            # only api manager tests
npm test -- --coverage --collectCoverageFrom="src/**/*.{ts,tsx}"  # coverage report
```

## Before Committing

Before every git commit, ensure Caliber syncs agent configs. Check the hook:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```
- **hook-active**: commit normally.
- **no-hook**: run `caliber refresh && git add CALIBER_LEARNINGS.md CLAUDE.md .claude/ .opencode/ 2>/dev/null` before committing.

## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.

## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, run `/setup-caliber` to configure everything automatically.
