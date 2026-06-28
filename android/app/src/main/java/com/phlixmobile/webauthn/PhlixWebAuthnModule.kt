// android/app/src/main/java/com/phlixmobile/webauthn/PhlixWebAuthnModule.kt
//
// UNTESTED-in-CI / device-only: a passkey ceremony cannot run in CI — the
// platform shows a system biometric/PIN sheet that requires a real device with a
// configured screen lock. The JS wrapper (src/native/PhlixWebAuthn.ts) reports
// isSupported() false and the UI hides the affordances when this module is
// absent, so Jest + non-native runs stay functional.
//
// Method names + arg order + the JSON-string in / JSON-string out shape MUST
// match src/native/types.ts (PhlixWebAuthnInterface) and the iOS module
// (ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift).
//
// Uses the AndroidX Credential Manager
// (androidx.credentials:credentials + credentials-play-services-auth):
// CreatePublicKeyCredentialRequest / GetCredentialRequest take the server's
// WebAuthn options JSON as the request JSON and return the standard WebAuthn
// response JSON directly — so the bridge stays very thin (no manual base64url).
package com.phlixmobile.webauthn

import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PhlixWebAuthnModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PhlixWebAuthn"

    private val credentialManager: CredentialManager by lazy {
        CredentialManager.create(reactContext)
    }

    @ReactMethod
    fun isSupported(promise: Promise) {
        // Credential Manager is available on API 26+ via the AndroidX library +
        // Play Services. The actual passkey availability is enforced at ceremony
        // time (the system sheet); here we report capability presence.
        promise.resolve(true)
    }

    @ReactMethod
    fun register(optionsJson: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground activity for the passkey prompt.")
            return
        }

        val request = CreatePublicKeyCredentialRequest(
            requestJson = optionsJson
        )

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response = credentialManager.createCredential(
                    context = activity,
                    request = request
                ) as CreatePublicKeyCredentialResponse
                // registrationResponseJson is the standard WebAuthn attestation
                // JSON the server's verify endpoint expects.
                promise.resolve(response.registrationResponseJson)
            } catch (e: CreateCredentialCancellationException) {
                promise.reject("user_canceled", "Passkey prompt was cancelled.", e)
            } catch (e: Exception) {
                promise.reject("ceremony_failed", e.message ?: "Passkey registration failed.", e)
            }
        }
    }

    @ReactMethod
    fun authenticate(optionsJson: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground activity for the passkey prompt.")
            return
        }

        val option = GetPublicKeyCredentialOption(
            requestJson = optionsJson
        )
        val request = GetCredentialRequest(
            credentialOptions = listOf(option)
        )

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response: GetCredentialResponse = credentialManager.getCredential(
                    context = activity,
                    request = request
                )
                val credential = response.credential
                if (credential is PublicKeyCredential) {
                    // authenticationResponseJson is the standard WebAuthn
                    // assertion JSON the server's verify endpoint expects.
                    promise.resolve(credential.authenticationResponseJson)
                } else {
                    promise.reject(
                        "unexpected_credential",
                        "Unexpected credential type returned."
                    )
                }
            } catch (e: GetCredentialCancellationException) {
                promise.reject("user_canceled", "Passkey prompt was cancelled.", e)
            } catch (e: Exception) {
                promise.reject("ceremony_failed", e.message ?: "Passkey authentication failed.", e)
            }
        }
    }
}
