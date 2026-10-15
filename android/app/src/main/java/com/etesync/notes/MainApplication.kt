package com.etesync.notes

import android.app.Application
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri

import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    publishBookmarksShortcut()
  }

  /**
   * The "Bookmarks" shortcut: in the top row of the share menu (direct share) it saves the shared link
   * (see res/xml/shortcuts.xml, which sends shares to ShareActivity), and in the launcher's menu of the
   * app it opens the bookmarks.
   */
  private fun publishBookmarksShortcut() {
    try {
      val shortcut = ShortcutInfoCompat.Builder(this, "bookmarks")
        .setShortLabel(getString(R.string.shortcut_bookmarks))
        .setIcon(IconCompat.createWithResource(this, R.drawable.ic_shortcut_bookmark))
        .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse("com.etesync.notes://bookmarks"), this, MainActivity::class.java))
        .setCategories(setOf("com.etesync.notes.category.BOOKMARKS"))
        .setLongLived(true)
        .build()
      ShortcutManagerCompat.pushDynamicShortcut(this, shortcut)
    } catch (e: Exception) {
      // Only a shortcut, the app works without it
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
