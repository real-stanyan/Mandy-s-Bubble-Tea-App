package expo.modules.googlewallet

import android.app.Activity
import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.LinearLayout
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayApiAvailabilityStatus
import com.google.android.gms.pay.PayClient
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

// Google Wallet on Android: the member card the iPhone side has had since
// April 2026 (Apple Wallet pass), now for Play installs.
//
// Two things live here, both of which Google requires to be theirs:
//
//  1. The "Add to Google Wallet" button. Google's brand guidelines forbid a
//     hand-drawn button, so this view inflates the layout + vector drawables
//     from Google's own asset pack (res/, 70+ locales), unmodified.
//  2. The save itself. PayClient.savePassesJwt opens Google's save sheet and
//     reports the outcome through onActivityResult — that result is the only
//     way to know the member actually tapped "Add", so it is surfaced to JS
//     as "saved" / "canceled" / "error:<message>".
//
// The pass content is never built here: the backend signs a JWT that
// carries (or references) the loyalty object, and this module hands it to
// Google verbatim.

private const val SAVE_REQUEST_CODE = 0x6057

class GoogleWalletButtonView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val onPress by EventDispatcher()

  // ExpoView is a LinearLayout; Yoga sizes this view from JS, Android lays
  // out Google's RelativeLayout inside it (same trick as the Pay button).
  override val shouldUseAndroidLayout = true

  private val button = LayoutInflater.from(context)
    .inflate(R.layout.add_to_googlewallet_button, this, false)
    .also { v ->
      v.layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
      v.setOnClickListener { if (isEnabled) onPress(mapOf()) }
      addView(v)
    }

  // Google's overlay drawable already renders the disabled state (a 50%
  // white veil, state_enabled=false); we only have to propagate the flag.
  override fun setEnabled(enabled: Boolean) {
    super.setEnabled(enabled)
    button.isEnabled = enabled
  }
}

class GoogleWalletModule : Module() {
  private var pendingSave: Promise? = null

  private fun client(): PayClient {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    return Pay.getClient(context)
  }

  override fun definition() = ModuleDefinition {
    Name("GoogleWallet")

    // Google Wallet installed + this account/device can save passes. Rejects
    // never: an unavailable API is a normal "hide the row" answer.
    AsyncFunction("isAvailable") { promise: Promise ->
      client()
        .getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES)
        .addOnSuccessListener { status ->
          promise.resolve(status == PayApiAvailabilityStatus.AVAILABLE)
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    // Opens Google's save sheet for the signed JWT. Resolves once the sheet
    // closes: "saved", "canceled", or "error:<message>".
    AsyncFunction("savePassJwt") { jwt: String, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      if (pendingSave != null) {
        promise.reject("E_SAVE_IN_PROGRESS", "A Google Wallet save is already open", null)
        return@AsyncFunction
      }
      pendingSave = promise
      client().savePassesJwt(jwt, activity, SAVE_REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != SAVE_REQUEST_CODE) return@OnActivityResult
      val promise = pendingSave ?: return@OnActivityResult
      pendingSave = null
      when (payload.resultCode) {
        Activity.RESULT_OK -> promise.resolve("saved")
        Activity.RESULT_CANCELED -> promise.resolve("canceled")
        PayClient.SavePassesResult.SAVE_ERROR -> {
          val message = payload.data?.getStringExtra(PayClient.EXTRA_API_ERROR_MESSAGE) ?: "unknown"
          promise.resolve("error:$message")
        }
        else -> promise.resolve("error:result=${payload.resultCode}")
      }
    }

    View(GoogleWalletButtonView::class) {
      Events("onPress")
      Prop("enabled") { view: GoogleWalletButtonView, value: Boolean ->
        view.isEnabled = value
      }
    }
  }
}
