// android/app/src/main/java/com/phlixmobile/download/PhlixDownloaderModule.kt
//
// UNTESTED-in-CI: no device/emulator build runs in this environment. The JS
// layer (src/services/DownloadService.ts) falls back to a simulated downloader
// when this native module is absent, so the app stays functional without it.
//
// Method signatures, event names and payload keys are kept IDENTICAL to the iOS
// module (ios/LocalPods/PhlixPlayer/PhlixDownloader.swift) and the TS interface
// (src/native/types.ts: PhlixDownloaderInterface + DOWNLOAD_EVENTS).
package com.phlixmobile.download

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class PhlixDownloaderModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        // Event names — MUST match DOWNLOAD_EVENTS in src/native/types.ts.
        private const val EVENT_PROGRESS = "PhlixDownloadProgress"
        private const val EVENT_COMPLETE = "PhlixDownloadComplete"
        private const val EVENT_ERROR = "PhlixDownloadError"
        private const val EVENT_PAUSED = "PhlixDownloadPaused"
        private const val PROGRESS_THROTTLE_BYTES = 512 * 1024L
    }

    override fun getName(): String = "PhlixDownloader"

    // taskId -> control flags for the running download thread.
    private val controls = ConcurrentHashMap<String, Control>()

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private class Control {
        @Volatile var cancelled = false
        @Volatile var paused = false
        @Volatile var downloadedBytes = 0L
    }

    override fun getConstants(): MutableMap<String, Any> {
        val docs = reactContext.filesDir?.absolutePath ?: ""
        return hashMapOf("documentsPath" to docs)
    }

    private fun emit(name: String, body: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, body)
    }

    @ReactMethod
    fun startDownload(
        taskId: String,
        url: String,
        localPath: String,
        resumeOffset: Double,
        totalBytesHint: Double
    ) {
        // Replace any prior control for this taskId.
        controls[taskId]?.cancelled = true
        val control = Control().apply { downloadedBytes = resumeOffset.toLong() }
        controls[taskId] = control

        thread(name = "phlix-dl-$taskId") {
            try {
                val dest = File(localPath)
                dest.parentFile?.mkdirs()
                val offset = if (resumeOffset.toLong() > 0 && dest.exists()) dest.length() else 0L

                val builder = Request.Builder().url(url)
                if (offset > 0) {
                    builder.header("Range", "bytes=$offset-")
                }

                httpClient.newCall(builder.build()).execute().use { response ->
                    if (!response.isSuccessful) {
                        finishError(taskId, "HTTP ${response.code}")
                        return@thread
                    }
                    val body = response.body ?: run {
                        finishError(taskId, "Empty response body")
                        return@thread
                    }
                    val bodyLength = body.contentLength()
                    // Total = (bytes already on disk) + (bytes the server will send).
                    val totalBytes = when {
                        totalBytesHint.toLong() > 0 -> totalBytesHint.toLong()
                        bodyLength > 0 -> offset + bodyLength
                        else -> 0L
                    }

                    var written = offset
                    control.downloadedBytes = written
                    var lastEmitted = written

                    RandomAccessFile(dest, "rw").use { raf ->
                        raf.seek(offset)
                        body.byteStream().use { input ->
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                if (control.cancelled) {
                                    return@thread
                                }
                                if (control.paused) {
                                    control.downloadedBytes = written
                                    emit(EVENT_PAUSED, Arguments.createMap().apply {
                                        putString("taskId", taskId)
                                        putDouble("downloadedBytes", written.toDouble())
                                    })
                                    return@thread
                                }
                                val read = input.read(buffer)
                                if (read < 0) break
                                raf.write(buffer, 0, read)
                                written += read
                                control.downloadedBytes = written
                                if (written - lastEmitted >= PROGRESS_THROTTLE_BYTES) {
                                    lastEmitted = written
                                    emit(EVENT_PROGRESS, Arguments.createMap().apply {
                                        putString("taskId", taskId)
                                        putDouble("downloadedBytes", written.toDouble())
                                        putDouble("totalBytes", totalBytes.toDouble())
                                    })
                                }
                            }
                        }
                    }

                    controls.remove(taskId)
                    emit(EVENT_PROGRESS, Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putDouble("downloadedBytes", written.toDouble())
                        putDouble("totalBytes", totalBytes.toDouble())
                    })
                    emit(EVENT_COMPLETE, Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("localPath", localPath)
                    })
                }
            } catch (e: Exception) {
                if (controls[taskId]?.cancelled != true && controls[taskId]?.paused != true) {
                    finishError(taskId, e.message ?: "Download failed")
                }
            }
        }
    }

    private fun finishError(taskId: String, message: String) {
        controls.remove(taskId)
        emit(EVENT_ERROR, Arguments.createMap().apply {
            putString("taskId", taskId)
            putString("error", message)
        })
    }

    @ReactMethod
    fun pauseDownload(taskId: String) {
        controls[taskId]?.paused = true
    }

    @ReactMethod
    fun resumeDownload(taskId: String) {
        // Resume is driven by the JS layer re-issuing startDownload with the
        // resumeOffset; no-op here beyond clearing a lingering pause flag.
        controls[taskId]?.paused = false
    }

    @ReactMethod
    fun cancelDownload(taskId: String) {
        controls[taskId]?.cancelled = true
        controls.remove(taskId)
    }

    @ReactMethod
    fun deleteFile(localPath: String, promise: Promise) {
        try {
            val file = File(localPath)
            if (file.exists()) {
                file.delete()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("delete_failed", e.message, e)
        }
    }

    // Required for RN's NativeEventEmitter on Android (no-op listener counters).
    @ReactMethod
    fun addListener(eventName: String) { /* no-op: events are fire-and-forget */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }
}
