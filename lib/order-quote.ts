// The shape of `/api/orders/quote`'s answer, and the two accessors every
// checkout row goes through.
//
// Split out from the hook so it stays importable without pulling in the API
// client (and, through it, half of Expo) — these are pure functions and the
// tests should be able to say so.
//
// Amounts are decimal STRINGS of cents: server-side they're BigInt and JSON
// has no BigInt. Parse them here, never inline, so a malformed field can't
// reach the UI as "$NaN".

export type QuoteAmount = {
  uid: string
  name: string
  amountCents: string
}

export type OrderQuote = {
  subtotalCents: string
  discounts: QuoteAmount[]
  serviceCharges: QuoteAmount[]
  discountTotalCents: string
  serviceChargeTotalCents: string
  /** Estimated money a loyalty reward will cover (cheapest N cups). */
  rewardCupsSumCents: string
  /** Order total as Square computes it, BEFORE the loyalty reward. */
  totalCents: string
  /** What the card is actually charged: total minus the reward, floored at 0. */
  netTotalCents: string
  /** True when the server couldn't reach Square and estimated the percentages. */
  estimated: boolean
}

export function quoteCents(value: string | undefined): number {
  const n = Number(value ?? '0')
  return Number.isFinite(n) ? n : 0
}

/** The amount of one service charge, 0 when it isn't attached to the order. */
export function serviceChargeCents(
  quote: OrderQuote | null,
  uid: string,
): number {
  return quoteCents(quote?.serviceCharges.find((sc) => sc.uid === uid)?.amountCents)
}

/**
 * Does the quote on hand answer for the cart on screen?
 *
 * `settledKey` moves on *every* settled request, including the failures the
 * hook deliberately swallows. A swallowed failure leaves the old quote up on
 * purpose (checkout falls back to the bare cart subtotal, which is too high
 * rather than too low) — but it has still answered, so it must not leave the
 * pay button disabled forever.
 */
export function isQuoteStale(
  currentKey: string | null,
  settledKey: string | null,
): boolean {
  // Nothing to price: an empty or disabled cart is never "waiting".
  if (currentKey === null) return false
  return settledKey !== currentKey
}

/**
 * Nothing will be charged for this order.
 *
 * Taken straight off the server-priced net total rather than re-deriving it
 * from `isFreeRedeem` plus a delivery-fee rule: the reward covers the drinks
 * but a DELIVERY redeem still pays its delivery + service fees, and a second
 * copy of that rule on the client is the exact shape of bug ADR-0005 exists
 * to prevent.
 *
 * `quoteAnswersCart` is required rather than left to the caller because
 * "settled" and "answers this cart" are not the same thing, and the gap
 * between them is invisible at a call site. A re-quote that fails is
 * deliberately swallowed — the hook keeps the *previous* cart's quote on
 * screen and reports itself settled, so the pay button doesn't stay disabled
 * through an outage. Read `netTotalCents` off that quote and a cart that
 * happened to be free a moment ago claims to still be free.
 */
export function nothingToPay(
  quote: OrderQuote | null,
  rewardCount: number,
  quoteAnswersCart: boolean,
): boolean {
  if (!quoteAnswersCart) return false
  if (rewardCount <= 0 || quote === null) return false
  return quoteCents(quote.netTotalCents) <= 0
}
