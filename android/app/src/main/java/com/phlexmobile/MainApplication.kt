package com.phlexmobile

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.facebook.react.shell.MainReactPackage
import com.phlexmobile.player.PhlexPlayerPackage

class MainApplication : Application(), ReactApplication {

  private val newArchEnabled = false  // Hardcoded for RN 0.85 compatibility

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
            return listOf(
                MainReactPackage(),  // Main React Native package
                PhlexPlayerPackage()  // Native video player
            )
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = false  // Disabled for RN 0.85 compatibility
        override val isHermesEnabled: Boolean = true       // Hermes is enabled
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    // New architecture is disabled, no need to load
  }
}
