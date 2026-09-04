package expo.modules.googlepaybutton

import android.content.Context
import android.util.TypedValue
import android.view.ViewGroup
import android.widget.LinearLayout
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

// Google's own payment button, drawn by Google.
//
// Why this exists: the checkout used to render a brand-brown pill reading
// "Pay with Google Pay". That is a brand-guidelines violation, and it is
// what the Google Pay API review team rejected the com.mandysbubbletea.app
// integration for (2026-09-04). Their remedy is explicit — use the platform
// button API rather than drawing our own:
//   https://developers.google.com/pay/api/android/guides/resources/update-to-new-payment-button
//
// PayButton renders the mark, the wordmark, the height, the contrast and the
// clear space to spec, and updates itself if Google changes the spec. We only
// choose theme/type/corner radius and receive the tap; the payment itself
// still runs through Square's SDK (lib/square-payment.ts), which is what the
// gateway integration expects.
//
// allowedPaymentMethods is required by initialize(). It is presentational
// here — Google uses it to decide whether to draw the generic button or one
// carrying the buyer's saved card — so it must describe the same card
// networks Square accepts, and nothing about it authorizes a charge.

private const val ALLOWED_PAYMENT_METHODS = """
[
  {
    "type": "CARD",
    "parameters": {
      "allowedAuthMethods": ["PAN_ONLY", "CRYPTOGRAM_3DS"],
      "allowedCardNetworks": ["AMEX", "DISCOVER", "JCB", "MASTERCARD", "VISA"]
    },
    "tokenizationSpecification": {
      "type": "PAYMENT_GATEWAY",
      "parameters": {
        "gateway": "square",
        "gatewayMerchantId": "square"
      }
    }
  }
]
"""

class GooglePayButtonView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val onPress by EventDispatcher()

  // ExpoView is a LinearLayout. Yoga sizes THIS view from the JS style; the
  // flag hands the inside to Android's own measure/layout pass, without which
  // PayButton's requestLayout never reaches React Native and the button
  // renders as an empty box.
  override val shouldUseAndroidLayout = true

  private val button = PayButton(context).also { pay ->
    pay.layoutParams = LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    )
    pay.setOnClickListener { if (isEnabled) onPress(mapOf()) }
    addView(pay)
  }

  // initialize() must run once before the button draws anything, and again
  // whenever theme/type/radius change — Google's view rebuilds its content
  // from the options each time.
  private var theme: Int = ButtonConstants.ButtonTheme.DARK
  private var type: Int = ButtonConstants.ButtonType.PAY
  private var cornerRadiusDp: Float = 26f

  private fun dpToPx(dp: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, resources.displayMetrics).toInt()

  fun applyOptions() {
    button.initialize(
      ButtonOptions.newBuilder()
        .setButtonTheme(theme)
        .setButtonType(type)
        .setCornerRadius(dpToPx(cornerRadiusDp))
        .setAllowedPaymentMethods(ALLOWED_PAYMENT_METHODS)
        .build(),
    )
  }

  fun setTheme(value: String) {
    theme = if (value == "light") {
      ButtonConstants.ButtonTheme.LIGHT
    } else {
      ButtonConstants.ButtonTheme.DARK
    }
  }

  fun setType(value: String) {
    type = when (value) {
      "buy" -> ButtonConstants.ButtonType.BUY
      "checkout" -> ButtonConstants.ButtonType.CHECKOUT
      "order" -> ButtonConstants.ButtonType.ORDER
      "plain" -> ButtonConstants.ButtonType.PLAIN
      else -> ButtonConstants.ButtonType.PAY
    }
  }

  fun setCornerRadiusDp(value: Float) {
    cornerRadiusDp = value
  }

  // Disabled is ours to draw: PayButton has no disabled state, and dimming it
  // is the one change to Google's artwork the guidelines allow (the button is
  // never redrawn, only faded), so a not-yet-ready checkout can still show the
  // real button instead of substituting a fake one.
  override fun setEnabled(enabled: Boolean) {
    super.setEnabled(enabled)
    button.isClickable = enabled
    alpha = if (enabled) 1f else 0.4f
  }
}

class GooglePayButtonModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GooglePayButton")

    View(GooglePayButtonView::class) {
      Events("onPress")

      Prop("theme") { view: GooglePayButtonView, value: String ->
        view.setTheme(value)
      }
      Prop("type") { view: GooglePayButtonView, value: String ->
        view.setType(value)
      }
      Prop("cornerRadius") { view: GooglePayButtonView, value: Float ->
        view.setCornerRadiusDp(value)
      }
      Prop("enabled") { view: GooglePayButtonView, value: Boolean ->
        view.isEnabled = value
      }

      // Props are delivered before this runs, so the button is initialized
      // once with the final set rather than once per prop.
      OnViewDidUpdateProps { view: GooglePayButtonView ->
        view.applyOptions()
      }
    }
  }
}
