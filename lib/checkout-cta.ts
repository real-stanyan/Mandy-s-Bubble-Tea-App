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
