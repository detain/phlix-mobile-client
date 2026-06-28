// android/app/src/main/java/com/phlixmobile/webauthn/PhlixWebAuthnPackage.kt
//
// UNTESTED-in-CI / device-only: passkey ceremonies require a real device.
package com.phlixmobile.webauthn

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PhlixWebAuthnPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PhlixWebAuthnModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
