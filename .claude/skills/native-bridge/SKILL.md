---
name: native-bridge
description: Adds or extends a native module bridge across src/native/types.ts, ios/LocalPods/PhlixPlayer/ (Swift + Obj-C RCT_EXTERN_MODULE), and android/app/src/main/java/com/phlixmobile/ (Kotlin @ReactProp/@ReactMethod). Keeps event names and prop signatures aligned across all three layers, handles cleanup/observer removal. Use when user says 'add native module', 'expose to JS', 'bridge ios/android player feature', or edits PhlixPlayerView.swift/PhlixPlayerView.kt. Do NOT use for pure JS features, JS-only components, or features that don't require native code.
paths:
  - src/native/**
  - ios/LocalPods/PhlixPlayer/**
  - android/app/src/main/java/com/phlixmobile/**
---
# Native Bridge

Add or extend a native module/view bridge so a feature is exposed identically across TypeScript, iOS (Swift + Obj-C), and Android (Kotlin). The three layers MUST stay in lockstep — a prop/event added on one side without the other two will silently fail at runtime.

## Critical

- **Three-layer rule**: every new prop, method, or event MUST be added to ALL of: `src/native/types.ts`, `ios/LocalPods/PhlixPlayer/`, `android/app/src/main/java/com/phlixmobile/`. Skipping a layer ships a broken bridge.
- **Names must match exactly**:
  - View manager name: iOS `RCT_EXTERN_MODULE(PhlixPlayerViewManager, …)` ↔ Android `override fun getName() = "PhlixPlayerView"` ↔ JS `requireNativeComponent('PhlixPlayerView')`.
  - Event names: iOS `@objc var onProgress: RCTBubblingEventBlock?` ↔ Android `WritableMap` with `"onProgress"` via `RCTEventEmitter` ↔ TS callback prop `onProgress`.
  - Prop names: must match between `RCT_EXPORT_VIEW_PROPERTY` (Obj-C) and `@ReactProp(name = "…")` (Kotlin) and the TS interface field.
- **Cleanup is mandatory**: any KVO observer (iOS), `Player.Listener` (Android), or timer added in setup MUST be removed in the corresponding teardown (`removeObserver`, `removeListener`, `invalidate`). Leaks crash on view recycling.
- **Never bridge UI-thread blocking work**: long calls go on background queues (iOS `DispatchQueue.global()`, Android `Executors`) and post results back via the event block / `sendEvent`.
- **Run `npm run typecheck` after editing `src/native/types.ts`** — a mismatched callback signature won't fail at build time on native but will silently drop events.

## Instructions

### Step 1 — Define the TS contract first

Edit `src/native/types.ts`. Add the prop/method/event to the existing interface. Use the exact event payload shape native will emit.

```ts
// src/native/types.ts
export interface PhlixPlayerViewProps {
  source: { uri: string; headers?: Record<string, string> };
  paused?: boolean;
  onProgress?: (e: NativeSyntheticEvent<{ currentTime: number; duration: number }>) => void;
  // new prop goes here, matching native name exactly
  onBuffer?: (e: NativeSyntheticEvent<{ isBuffering: boolean }>) => void;
}
```

For a TurboModule/method (non-view), add to the module interface and re-export from `src/native/index.ts` if one exists.

**Verify**: `npm run typecheck` passes before touching native code.

### Step 2 — iOS: Swift view + Obj-C bridge

Two files in `ios/LocalPods/PhlixPlayer/`:

**`PhlixPlayerView.swift`** — add the `@objc` property and emit the event. For props, use `@objc var <name>: <Type> = <default> { didSet { … } }`. For event callbacks, use `@objc var onBuffer: RCTBubblingEventBlock?` and call `onBuffer?(["isBuffering": true])` from a KVO callback or AVPlayer observer.

```swift
@objc var onBuffer: RCTBubblingEventBlock?

private func observePlayer() {
  playerItemObserver = player?.currentItem?.observe(\.isPlaybackBufferEmpty, options: [.new]) { [weak self] item, _ in
    self?.onBuffer?(["isBuffering": item.isPlaybackBufferEmpty])
  }
}

deinit { playerItemObserver?.invalidate() }  // MUST clean up
```

**`PhlixPlayerViewManager.m`** — register the prop/event with Obj-C macros (file is `.m`, NOT `.swift`):

```objc
RCT_EXPORT_VIEW_PROPERTY(onBuffer, RCTBubblingEventBlock)
// or for a scalar prop:
RCT_EXPORT_VIEW_PROPERTY(paused, BOOL)
```

For a non-view module method, add to the `RCT_EXTERN_MODULE` block:
```objc
RCT_EXTERN_METHOD(getMetadata:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

**Verify**: `cd ios && pod install && cd ..` then `npm run ios` builds without `Undefined symbol` or `Unrecognized selector` errors.

### Step 3 — Android: Kotlin view manager + module

Edit `android/app/src/main/java/com/phlixmobile/player/PhlixPlayerViewManager.kt`.

**Props**: annotate with `@ReactProp(name = "…")` — name MUST match the TS prop and iOS `RCT_EXPORT_VIEW_PROPERTY`:

```kotlin
@ReactProp(name = "paused")
fun setPaused(view: PhlixPlayerView, paused: Boolean) {
  view.setPaused(paused)
}
```

**Events**: register in `getExportedCustomBubblingEventTypeConstants()`:

```kotlin
override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> = mapOf(
  "onProgress" to mapOf("phasedRegistrationNames" to mapOf("bubbled" to "onProgress")),
  "onBuffer" to mapOf("phasedRegistrationNames" to mapOf("bubbled" to "onBuffer")),
)
```

**Emit** from `PhlixPlayerView.kt` via `RCTEventEmitter`:

```kotlin
private fun sendEvent(name: String, payload: WritableMap) {
  val ctx = context as ReactContext
  ctx.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, name, payload)
}

private val playerListener = object : Player.Listener {
  override fun onPlaybackStateChanged(state: Int) {
    val map = Arguments.createMap().apply { putBoolean("isBuffering", state == Player.STATE_BUFFERING) }
    sendEvent("onBuffer", map)
  }
}

fun onDropViewInstance() {  // MUST clean up
  player?.removeListener(playerListener)
  player?.release()
}
```

For `@ReactMethod` on a regular module (extends `ReactContextBaseJavaModule`), use a `Promise`:
```kotlin
@ReactMethod
fun getMetadata(url: String, promise: Promise) {
  Executors.newSingleThreadExecutor().execute {
    try { promise.resolve(/* WritableMap */) } catch (e: Exception) { promise.reject("ERR", e) }
  }
}
```

Register the manager/module in `MainApplication.kt`'s package list if it's new.

**Verify**: `npm run build:android:debug` succeeds; `adb logcat | grep ReactNativeJS` shows no `Module ... is not registered` warnings.

### Step 4 — Cross-layer sanity check

Grep the new name across all three layers — it MUST appear at least once in each:

```bash
grep -rn "onBuffer" src/native/ ios/LocalPods/ android/app/src/main/
```

If any layer is missing, you have a broken bridge. Add the missing piece before proceeding.

### Step 5 — Test through the JS consumer

Wire the new prop/event into the actual screen using it (typically `src/screens/PlayerScreen.tsx` or `src/components/player/`). Run on a real device or simulator and confirm the event fires (e.g. `console.log` inside the callback).

**Verify**: `npm run lint && npm run typecheck && npm test` all pass. Manually exercise the feature on iOS AND Android — a passing typecheck does not prove the native side is wired.

## Examples

**User says**: "Expose a buffering event from the native player to JS."

**Actions taken**:
1. Add `onBuffer?: (e: NativeSyntheticEvent<{ isBuffering: boolean }>) => void;` to `PhlixPlayerViewProps` in `src/native/types.ts`.
2. In `PhlixPlayerView.swift`, add `@objc var onBuffer: RCTBubblingEventBlock?` and a KVO observer on `isPlaybackBufferEmpty` that calls it; invalidate the observer in `deinit`.
3. In `PhlixPlayerViewManager.m`, add `RCT_EXPORT_VIEW_PROPERTY(onBuffer, RCTBubblingEventBlock)`.
4. In `PhlixPlayerViewManager.kt`, register `onBuffer` in `getExportedCustomBubblingEventTypeConstants()`.
5. In `PhlixPlayerView.kt`, add a `Player.Listener` that emits `onBuffer` via `RCTEventEmitter`; remove the listener in `onDropViewInstance()`.
6. Consume `onBuffer` in `src/screens/PlayerScreen.tsx` to drive a loading spinner.
7. Run `grep -rn onBuffer src/native ios/LocalPods android/app/src/main` — confirm hits in each layer.

**Result**: Identical buffering event fires on both platforms; `PlayerScreen` shows the spinner consistently.

## Common Issues

- **`Unrecognized selector sent to instance` on iOS at runtime**: The Swift property is missing `@objc`, or `PhlixPlayerViewManager.m` lacks the matching `RCT_EXPORT_VIEW_PROPERTY`. Add `@objc var` and the macro line; re-run `pod install`.
- **`Module 'PhlixPlayerView' is not registered` (Android logcat)**: The new view manager was added but not included in the package list. Register it in `MainApplication.kt` inside the `getPackages()`/`PhlixPackage` `createViewManagers()` return list.
- **Event handler in JS never fires, no errors**: Event name mismatch between layers. Run `grep -rn "on<EventName>" src/native ios/LocalPods android/app/src/main` — must appear in all three. On Android specifically, missing from `getExportedCustomBubblingEventTypeConstants()` silently drops the event.
- **`TypeError: undefined is not an object (evaluating 'PhlixPlayer.getMetadata')`**: Native method exists on one platform only, or the module hasn't been added to the package's `createNativeModules()`. Re-check `MainApplication.kt` / `PhlixPackage.kt` and the Obj-C `RCT_EXTERN_METHOD` declaration.
- **Memory leak / crash on view recycle (Android)**: `Player.Listener` not removed in `onDropViewInstance()`. Add `player?.removeListener(listener)` and `player?.release()`.
- **iOS works in Debug, crashes in Release**: Swift property without `@objc` is stripped by the Swift→Obj-C bridge under optimization. Add `@objc` to every property `RCT_EXPORT_VIEW_PROPERTY` references.
- **Build fails with `pod install` complaining about PhlixPlayer.podspec`**: After editing native files in `ios/LocalPods/PhlixPlayer/`, run `cd ios && pod install && cd ..` — Xcode caches headers and won't see new methods until pods are reinstalled.
- **Prop change doesn't apply on view update (Android)**: `@ReactProp` setter doesn't actually push the value into the underlying player. Inside the setter, call the view's apply method (e.g. `view.setPaused(paused)`), not just store the field.
- **TS callback receives `undefined` for payload fields**: Native is emitting different keys than TS expects. Native dictionary/`WritableMap` keys MUST match the TS event payload field names exactly (case-sensitive).