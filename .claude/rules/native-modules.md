---
paths:
  - ios/LocalPods/**
  - android/app/src/main/java/com/phlixmobile/**
  - src/native/**
---

# Native Module Conventions

- TS surface lives in `src/native/types.ts` (`PhlixPlayerInterface`, `PhlixDownloaderInterface`, `PlaybackEvent`, `DownloadEvent`). Keep prop/method names in sync across iOS Obj-C bridge, Android Kotlin, and the TS interface.
- **iOS** (`ios/LocalPods/PhlixPlayer/`): Swift view in `PhlixPlayerView.swift` (AVPlayer + `AVPlayerLayer`, KVO on `status`, `addPeriodicTimeObserver` for progress). Obj-C bridge in `PhlixPlayerViewManager.m` using `RCT_EXTERN_MODULE` / `RCT_EXPORT_VIEW_PROPERTY` / `RCT_EXTERN_METHOD`. Update `PhlixPlayer.podspec` and run `cd ios && pod install` after adding files.
- **Android** (`android/app/src/main/java/com/phlixmobile/player/`): `PhlixPlayerView.kt` is the ExoPlayer-backed `FrameLayout` (`Player.Listener` for state, `PlaybackException` for errors); `PhlixPlayerViewManager.kt` extends `SimpleViewManager<PhlixPlayerView>` and registers props with `@ReactProp(name = "...")` plus imperative methods with `@ReactMethod`. New packages must be added to `PhlixPlayerPackage.kt` and wired in `MainApplication.kt`.
- Events: emit via `sendEvent("onPlaybackEvent", Arguments.createMap()...)` on Android and `onPlaybackEvent?(["event": ...])` on iOS — keep the `event` string set aligned with `PlaybackEvent.event` in `src/native/types.ts`.
- Time units crossing the bridge: seconds (double) for `seekTo`/`startPosition`/`currentTime`. The 100ns tick conversion happens in JS, not native.
- Cleanup: remove KVO/`timeObserver`/`NotificationCenter` observers in `cleanup()`/`onDropViewInstance`; Android releases the `ExoPlayer` in `onDropViewInstance`.
- AndroidManifest permissions and ProGuard rules: `android/app/src/main/AndroidManifest.xml`, `android/app/proguard-rules.pro`.
