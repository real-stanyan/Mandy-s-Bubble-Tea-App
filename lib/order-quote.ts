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
