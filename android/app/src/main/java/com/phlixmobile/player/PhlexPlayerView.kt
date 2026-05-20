// android/app/src/main/java/com/phlixmobile/player/PhlixPlayerView.kt
package com.phlixmobile.player

import android.content.Context
import android.net.Uri
import android.view.LayoutInflater
import android.widget.FrameLayout
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.PlaybackException
import com.google.android.exoplayer2.Player
import com.google.android.exoplayer2.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter

class PhlixPlayerView(context: Context) : FrameLayout(context) {
    private var playerView: PlayerView? = null
    private var player: ExoPlayer? = null
    private var currentSrc: String = ""
    private var currentAutoPlay: Boolean = true
    private var currentStartPosition: Double = 0.0
    private var currentVolume: Float = 1.0f
    private var currentMuted: Boolean = false

    // Event callbacks
    var onPlaybackEvent: ((WritableMap) -> Unit)? = null
    var onProgress: ((WritableMap) -> Unit)? = null
    var onError: ((WritableMap) -> Unit)? = null

    private val progressRunnable = object : Runnable {
        override fun run() {
            player?.let { p ->
                if (p.isPlaying) {
                    val map = Arguments.createMap().apply {
                        putDouble("currentTime", p.currentPosition / 1000.0)
                        putDouble("duration", p.duration.coerceAtLeast(0) / 1000.0)
                    }
                    onProgress?.invoke(map)
                }
            }
            handler.postDelayed(this, 1000)
        }
    }

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_READY -> {
                    val map = Arguments.createMap().apply {
                        putString("event", "ready")
                    }
                    onPlaybackEvent?.invoke(map)
                }
                Player.STATE_ENDED -> {
                    val map = Arguments.createMap().apply {
                        putString("event", "ended")
                    }
                    onPlaybackEvent?.invoke(map)
                }
                Player.STATE_BUFFERING -> {
                    val map = Arguments.createMap().apply {
                        putString("event", "buffering")
                    }
                    onPlaybackEvent?.invoke(map)
                }
                Player.STATE_IDLE -> {
                    // Do nothing
                }
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
                val map = Arguments.createMap().apply {
                    putString("event", "play")
                }
                onPlaybackEvent?.invoke(map)
            } else {
                val map = Arguments.createMap().apply {
                    putString("event", "pause")
                }
                onPlaybackEvent?.invoke(map)
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            val map = Arguments.createMap().apply {
                putString("error", error.message ?: "Unknown playback error")
            }
            onError?.invoke(map)
        }
    }

    init {
        setupPlayerView()
    }

    private fun setupPlayerView() {
        playerView = PlayerView(context).apply {
            useController = false
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        }
        addView(playerView)
    }

    private fun initializePlayer() {
        if (player != null) return

        player = ExoPlayer.Builder(context).build().apply {
            playerView?.player = this
            addListener(playerListener)
        }

        updatePlayerState()
    }

    private fun updatePlayerState() {
        player?.let { p ->
            if (currentMuted) {
                p.volume = 0f
            } else {
                p.volume = currentVolume.coerceIn(0f, 1f)
            }
        }
    }

    fun setSrc(src: String) {
        if (src == currentSrc) return
        currentSrc = src

        // Clean up existing player
        releasePlayer()

        if (src.isEmpty()) return

        // Initialize new player
        initializePlayer()

        val uri = Uri.parse(src)
        val mediaItem = MediaItem.fromUri(uri)
        player?.setMediaItem(mediaItem)
        player?.prepare()

        if (currentAutoPlay) {
            player?.play()
        }

        if (currentStartPosition > 0) {
            player?.seekTo((currentStartPosition * 1000).toLong())
        }

        // Start progress updates
        handler.post(progressRunnable)
    }

    fun setAutoPlay(autoPlay: Boolean) {
        currentAutoPlay = autoPlay
        if (autoPlay && player != null) {
            player?.play()
        }
    }

    fun setStartPosition(startPosition: Double) {
        currentStartPosition = startPosition
        if (player != null && startPosition > 0) {
            player?.seekTo((startPosition * 1000).toLong())
        }
    }

    fun setVolume(volume: Float) {
        currentVolume = volume.coerceIn(0f, 1f)
        if (!currentMuted) {
            player?.volume = currentVolume
        }
    }

    fun setMuted(muted: Boolean) {
        currentMuted = muted
        if (muted) {
            player?.volume = 0f
        } else {
            player?.volume = currentVolume.coerceIn(0f, 1f)
        }
    }

    fun play() {
        player?.play()
    }

    fun pause() {
        player?.pause()
    }

    fun seekTo(position: Double) {
        player?.seekTo((position * 1000).toLong())
    }

    fun setPlayerVolume(volume: Float) {
        setVolume(volume)
    }

    fun setPlayerMuted(muted: Boolean) {
        setMuted(muted)
    }

    private fun releasePlayer() {
        handler.removeCallbacks(progressRunnable)
        player?.removeListener(playerListener)
        player?.release()
        player = null
    }

    fun onDropViewInstance() {
        releasePlayer()
        playerView?.player = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        releasePlayer()
    }
}
