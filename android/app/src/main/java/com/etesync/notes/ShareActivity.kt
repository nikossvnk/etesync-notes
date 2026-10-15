package com.etesync.notes

import android.content.Intent
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

/**
 * The target of Android's share menu: saves a shared link as a bookmark. It's see-through, so the
 * app the link was shared from stays visible behind the sheet, and it runs in that app's task, so
 * closing it goes right back there. The JavaScript gets what was shared as the "share" prop (see
 * src/Index.tsx), and then shows only the sheet.
 */
class ShareActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"

  private fun shared(): Bundle {
    val intent = intent
    return Bundle().apply {
      putString("text", intent?.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: "")
      putString("subject", (intent?.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent?.getStringExtra(Intent.EXTRA_TITLE)) ?: "")
    }
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ) {
            override fun getLaunchOptions(): Bundle = Bundle().apply { putBundle("share", shared()) }
          })
  }

  // Closing the sheet (and the back button) finishes it, rather than putting it in the background
  override fun invokeDefaultOnBackPressed() {
    finish()
  }
}
