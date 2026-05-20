// android/app/src/main/java/com/phlixmobile/player/PhlixPlayerPackage.kt
package com.phlixmobile.player

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeArray
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PhlixPlayerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return emptyList()
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(PhlixPlayerViewManager())
    }
}
