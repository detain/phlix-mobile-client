---
paths:
  - ios/LocalPods/**
  - android/app/src/main/java/com/phlixmobile/**
  - src/native/**
---

# Native Module Conventions

- TS surface lives in `src/native/types.ts` (`PhlixPlayerInterface`, `PhlixDownloaderInterface`, `PhlixWebAuthnInterface`, `PlaybackEvent`, `DownloadEvent`). Keep prop/method names in sync across iOS Obj-C bridge, Android Kotlin, and the TS interface.
- **iOS** (`ios/LocalPods/PhlixPlayer/`): Swift view in `PhlixPlayerView.swift` (AVPlayer + `AVPlayerLayer`, KVO on `status`, `addPeriodicTimeObserver` for progress). Obj-C bridge in `PhlixPlayerViewManager.m` using `RCT_EXTERN_MODULE` / `RCT_EXPORT_VIEW_PROPERTY` / `RCT_EXTERN_METHOD`. Update `PhlixPlayer.podspec` and run `cd ios && pod install` after adding files.
- **Android** (`android/app/src/main/java/com/phlixmobile/player/`): `PhlixPlayerView.kt` is the ExoPlayer-backed `FrameLayout` (`Player.Listener` for state, `PlaybackException` for errors); `PhlixPlayerViewManager.kt` extends `SimpleViewManager<PhlixPlayerView>` and registers props with `@ReactProp(name = "...")` plus imperative methods with `@ReactMethod`. New packages must be added to `PhlixPlayerPackage.kt` and wired in `MainApplication.kt`.
- Events: emit via `sendEvent("onPlaybackEvent", Arguments.createMap()...)` on Android and `onPlaybackEvent?(["event": ...])` on iOS — keep the `event` string set aligned with `PlaybackEvent.event` in `src/native/types.ts`.
- Time units crossing the bridge: seconds (double) for `seekTo`/`startPosition`/`currentTime`. The 100ns tick conversion happens in JS, not native.
- Cleanup: remove KVO/`timeObserver`/`NotificationCenter` observers in `cleanup()`/`onDropViewInstance`; Android releases the `ExoPlayer` in `onDropViewInstance`.
- AndroidManifest permissions and ProGuard rules: `android/app/src/main/AndroidManifest.xml`, `android/app/proguard-rules.pro`.
- **PhlixWebAuthn (passkeys, E10e)**: TS interface `PhlixWebAuthnInterface` + the guarded wrapper `src/native/PhlixWebAuthn.ts` (resolves `isSupported()` false / rejects `register`/`authenticate` when the module is absent, so JS + Jest run without native). **iOS** — `ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift` (`@objc(PhlixWebAuthn) : NSObject`, `ASAuthorizationPlatformPublicKeyCredentialProvider`, iOS 15+ `if #available` guarded) + `PhlixWebAuthn.m` (`RCT_EXTERN_MODULE`/`RCT_EXTERN_METHOD`); the podspec `*.{h,m,swift}` glob auto-includes the files — only `s.frameworks` (AuthenticationServices) was added. **Android** — `android/app/src/main/java/com/phlixmobile/webauthn/PhlixWebAuthnModule.kt` (`@ReactMethod`-with-Promise, AndroidX Credential Manager on `Dispatchers.Main`) + `PhlixWebAuthnPackage.kt`, registered in `MainApplication.kt`; needs the `androidx.credentials` + `:credentials-play-services-auth` deps in `android/app/build.gradle`.
- The WebAuthn bridge is JSON-string-in / JSON-string-out (server options → authenticator response). **base64url<->binary conversion happens NATIVELY** — in Swift for iOS, and not at all on Android (Credential Manager consumes/produces standard WebAuthn JSON). JS never decodes credential bytes.
- **Passkeys are device-only at runtime**: the ceremony shows the system biometric/PIN sheet; no simulator/emulator/CI can run it (CI compiles only). Cross-device portability needs the SERVER to publish `apple-app-site-association` `webcredentials` (iOS) + `assetlinks.json` (Android) for the returned `rpId` — host infra, not client code.
