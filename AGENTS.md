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

**`src/api/`**: `client.ts` (axios, `BASE_URL = 'https://api.phlix.app'`, 30s timeout, auth + 401-refresh interceptors) · `AuthManager.ts` · `LibraryManager.ts` · `PlaybackManager.ts` · `TranscodeManager.ts` (`startTranscode`/`prepare()`; `prepare()`'s result carries `variants: Rendition[]`, the ABR quality ladder consumed by `PlayerScreen`'s `QualityMenu`) · `SyncPlayManager.ts` (SyncPlay group-watch backend; re-exported from `index.ts`) · `index.ts`.

**`src/stores/`** (Zustand): `useAuthStore.ts` · `usePlayerStore.ts` · `useLibraryStore.ts` · `useSettingsStore.ts` · `index.ts`. Pattern: `create<State>((set, get) => ({ ...initial, ...actions }))`.

**`src/screens/`**: `HomeScreen.tsx` · `LibraryScreen.tsx` · `MediaDetailScreen.tsx` · `PlayerScreen.tsx` · `SearchScreen.tsx` · `SettingsScreen.tsx` · `DownloadsScreen.tsx` · `LoginScreen.tsx`. Default-export `React.FC`, wrapped in `<SafeContainer>`.

**`src/components/`** syncplay subdir: `syncplay/{SyncPlayModal,SyncPlayOverlay}.tsx` (re-exported from `src/components/syncplay/index.ts`) are the SyncPlay group-watch UI wired into `PlayerScreen.tsx`, backed by `src/api/SyncPlayManager.ts` and the fan-out coordinator `src/syncplay/SyncPlayService.ts`.

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
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md AGENTS.md .agents/ 2>/dev/null`
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
If the pre-commit hook is not set up, read `.agents/skills/setup-caliber/SKILL.md` and follow the setup instructions.
<!-- /caliber:managed:sync -->
