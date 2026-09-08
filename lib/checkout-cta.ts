// What the checkout pay bar says, as a function of state.
//
// The bar is three slots — an eyebrow, a title and the amount — so the copy is
// a small state machine rather than one label, and getting the precedence
// wrong is invisible in a screenshot. Pure and separate from the screen so the
// order can be pinned in tests.
//
// Web parity (mandys_bubble_tea src/app/checkout/page.tsx): tapping the reward
// stepper repriced the order, and until the new quote lands the bar was still
// describing the old one. Web shows "Updating total…" and then flips the
// button to the redeem wording; this is the same two states fitted to the
// app's three-slot bar.

export type CheckoutCta = {
  eyebrow: string
  title: string
  /** Show a spinner where the amount goes — the number isn't trustworthy yet. */
  showSpinner: boolean
}

export type PayMethod = 'card' | 'apple' | 'google'

export type PayBar = {
  /** Draw Google's own PayButton. When false the bar draws our own pill. */
  useGoogleButton: boolean
  /** Eyebrow for our own pill — empty of Google's wordmark unless Google
   *  is drawing the button itself. */
  methodLabel: string
}

/**
 * Which button the pay bar draws.
 *
 * Google's artwork is all-or-nothing: the brand guidelines forbid altering its
 * colour and forbid "a button color that's similar to the background", so
 * there is no such thing as a greyed-out Google button on a light page. Any
 * state where we cannot take the payment therefore hands the bar back to our
 * own pill — and that pill may not say "Pay with Google Pay", which is the
 * home-made button the review team rejected on 2026-09-04.
 */
export function payBar(state: {
  method: PayMethod
  /** This binary carries the native module that draws Google's button. */
  googleButtonAvailable: boolean
  /** Server-priced net total is $0 — no payment sheet opens at all. */
  nothingToPay: boolean
  /** A gate the customer has to clear: closed, unlabelled cups, retired
   *  items, delivery not priced, Square failed to start. */
  blocked: boolean
}): PayBar {
  const useGoogleButton =
    state.method === 'google' &&
    state.googleButtonAvailable &&
    !state.nothingToPay &&
    !state.blocked

  if (state.method === 'google') {
    // Naming Google only where Google is drawing the button; everywhere else
    // the pill is ours and stays neutral.
    return {
      useGoogleButton,
      methodLabel: useGoogleButton ? 'Pay with Google Pay' : 'Payment',
    }
  }

  return {
    useGoogleButton: false,
    methodLabel: state.method === 'apple' ? 'Pay with Apple Pay' : 'Pay with Card',
  }
}

export function checkoutCta(state: {
  /** Store is taking orders right now. */
  accepting: boolean
  /** e.g. "10:30am" — only read when `accepting` is false. */
  nextOpenLabel: string
  /** An order or payment is already in flight. */
  busy: boolean
  /** The quote on hand was priced for a previous cart. */
  quoteStale: boolean
  /** Server-priced net total is $0 — see nothingToPay in lib/order-quote. */
  nothingToPay: boolean
  /** "Pay with Apple Pay" etc. */
  payMethodLabel: string
}): CheckoutCta {
  if (!state.accepting) {
    return {
      eyebrow: 'Closed',
      title: `Opens ${state.nextOpenLabel}`,
      showSpinner: false,
    }
  }

  // Ahead of the redeem wording on purpose: mid-reprice we do not yet know
  // whether this order is free, and promising "Redeem free drink" before the
  // server has said so is how the web version ended up opening an Apple Pay
  // sheet for a $0 order.
  if (state.quoteStale) {
    return {
      eyebrow: 'One moment',
      title: 'Updating total…',
      showSpinner: true,
    }
  }

  if (state.nothingToPay) {
    // No card is charged, so naming a payment method here would be a lie.
    return {
      eyebrow: 'Loyalty reward',
      title: 'Redeem free drink',
      showSpinner: state.busy,
    }
  }

  return {
    eyebrow: state.payMethodLabel,
    title: 'Place order',
    showSpinner: state.busy,
  }
}
