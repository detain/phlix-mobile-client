// android/app/src/main/java/com/phlixmobile/player/PhlixPlayerViewManager.kt
package com.phlixmobile.player

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class PhlixPlayerViewManager : SimpleViewManager<PhlixPlayerView>() {
    override fun getName(): String = "PhlixPlayerView"

    override fun createViewInstance(reactContext: ThemedReactContext): PhlixPlayerView {
        return PhlixPlayerView(reactContext)
    }

    @ReactProp(name = "src")
    fun setSrc(view: PhlixPlayerView, src: String?) {
        view.setSrc(src ?: "")
    }

    @ReactProp(name = "autoPlay", defaultBoolean = true)
    fun setAutoPlay(view: PhlixPlayerView, autoPlay: Boolean) {
        view.setAutoPlay(autoPlay)
    }

    @ReactProp(name = "startPosition", defaultDouble = 0.0)
    fun setStartPosition(view: PhlixPlayerView, startPosition: Double) {
        view.setStartPosition(startPosition)
    }

    @ReactProp(name = "volume", defaultFloat = 1.0f)
    fun setVolume(view: PhlixPlayerView, volume: Float) {
        view.setVolume(volume)
    }

    @ReactProp(name = "muted", defaultBoolean = false)
    fun setMuted(view: PhlixPlayerView, muted: Boolean) {
        view.setMuted(muted)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put("onPlaybackEvent", MapBuilder.of("phasedRegistrationNames", MapBuilder.of("bubbled", "onPlaybackEvent")))
            .put("onProgress", MapBuilder.of("phasedRegistrationNames", MapBuilder.of("bubbled", "onProgress")))
            .put("onError", MapBuilder.of("phasedRegistrationNames", MapBuilder.of("bubbled", "onError")))
            .build()
    }

    override fun receiveCommand(view: PhlixPlayerView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "play" -> view.play()
            "pause" -> view.pause()
            "seekTo" -> {
                if (args != null && args.size() > 0) {
                    view.seekTo(args.getDouble(0))
                }
            }
            "setVolume" -> {
                if (args != null && args.size() > 0) {
                    view.setVolume(args.getDouble(0).toFloat())
                }
            }
            "setMuted" -> {
                if (args != null && args.size() > 0) {
                    view.setMuted(args.getBoolean(0))
                }
            }
        }
    }

    override fun onDropViewInstance(view: PhlixPlayerView) {
        view.onDropViewInstance()
        super.onDropViewInstance(view)
    }
}
