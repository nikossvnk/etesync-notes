# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# expo-modules-core names this class in its manifest (meta-data), and loads it by that name, so R8
# doesn't see that it's used; without it the app stopped at startup (ClassNotFoundException)
-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { *; }

# Shrink only: keep the names, so that stack traces of errors in release builds can be read
-dontobfuscate
