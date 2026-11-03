// android/app/src/main/java/com/phlixmobile/random/PhlixRandomModule.kt
//
// M7 (deferred lane): CSPRNG-backed random bytes for device identity. The
// device id used to be Math.random()-shaped (predictable under a known PRNG
// seed); RN core ships no crypto.getRandomValues, so instead of pulling a
// third-party crypto package we expose the OS CSPRNG directly:
// Android java.security.SecureRandom / iOS SecRandomCopyBytes (see the iOS
// twin, ios/LocalPods/PhlixPlayer/PhlixRandom.swift).
//
// Method name + arg order + the hex-string out shape MUST match
// src/native/types.ts (PhlixRandomInterface) and the iOS module.
//
// E3-native convention: compile is CI-gated (Build Android), untested on
// device in this venue.
package com.phlixmobile.random

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.SecureRandom

class PhlixRandomModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PhlixRandom"

    companion object {
        private const val MAX_BYTES = 4096
        // SecureRandom is thread-safe and reseeds itself; one instance for
        // the process is the documented usage.
        private val secureRandom = SecureRandom()
        private val HEX = "0123456789abcdef".toCharArray()
    }

    @ReactMethod
    fun randomHex(byteCount: Int, promise: Promise) {
        if (byteCount <= 0 || byteCount > MAX_BYTES) {
            promise.reject("E_RANDOM_ARGS", "byteCount must be within 1..$MAX_BYTES, got $byteCount")
            return
        }
        try {
            val bytes = ByteArray(byteCount)
            secureRandom.nextBytes(bytes)
            val hex = CharArray(byteCount * 2)
            var i = 0
            var o = 0
            while (i < byteCount) {
                val b = bytes[i].toInt()
                hex[o] = HEX[(b shr 4) and 0x0F]
                hex[o + 1] = HEX[b and 0x0F]
                i += 1
                o += 2
            }
            promise.resolve(String(hex))
        } catch (e: Exception) {
            promise.reject("E_RANDOM_NATIVE", "SecureRandom failed: ${e.message}", e)
        }
    }
}
