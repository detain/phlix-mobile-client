# Add project specific ProGuard rules here.
-keepattributes *Annotation*

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Native Modules
-keep class com.phlixmobile.** { *; }

# Navigation
-keepnames class * extends android.os.Parcelable
-keepnames class * extends java.io.Serializable
