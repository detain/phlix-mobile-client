// android/app/src/main/java/com/phlixmobile/random/PhlixRandomPackage.kt
//
// M7 (deferred lane): registration package for the CSPRNG module — same
// manual-add pattern as PhlixWebAuthnPackage (this app registers its local
// modules explicitly in MainApplication, not via autolinking).
package com.phlixmobile.random

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PhlixRandomPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PhlixRandomModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
