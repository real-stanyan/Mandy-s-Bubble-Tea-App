import {
  quoteCents,
  serviceChargeCents,
  isQuoteStale,
  nothingToPay,
  type OrderQuote,
} from '@/lib/order-quote'

// The quote arrives as decimal strings — cents are BigInt server-side and JSON
// has no BigInt. Everything the checkout screen reads goes through these two,
// so a silent NaN here would render "$NaN" on the Total line.

const quote: OrderQuote = {
  subtotalCents: '5600',
  discounts: [
    { uid: 'app-download-discount', name: 'App Download 20% Off', amountCents: '1120' },
  ],
  serviceCharges: [
    { uid: 'platform-fee', name: 'Platform Fee', amountCents: '22' },
    { uid: 'service-fee', name: 'Service Fee (5%)', amountCents: '224' },
  ],
  discountTotalCents: '1120',
  serviceChargeTotalCents: '246',
  rewardCupsSumCents: '0',
  totalCents: '4726',
  netTotalCents: '4726',
  estimated: false,
}

describe('quoteCents', () => {
  it('parses a decimal cents string', () => {
    expect(quoteCents('4726')).toBe(4726)
  })

  it('treats a missing amount as zero', () => {
    expect(quoteCents(undefined)).toBe(0)
  })

  it('never returns NaN', () => {
    expect(quoteCents('not-a-number')).toBe(0)
  })
})

describe('serviceChargeCents', () => {
  it('finds a charge by uid', () => {
    expect(serviceChargeCents(quote, 'service-fee')).toBe(224)
  })

  // A zero delivery fee is attached as no charge at all, so an absent row is
  // how "free delivery" reaches the client.
  it('returns 0 for a charge that was not attached', () => {
    expect(serviceChargeCents(quote, 'delivery-fee')).toBe(0)
  })

  it('returns 0 before the first quote lands', () => {
    expect(serviceChargeCents(null, 'platform-fee')).toBe(0)
  })
})

/**
 * The rule this pins: checkout may only act on a quote priced for the cart
 * currently on screen, and "is anything owed" comes from the server's number
 * rather than a second copy of the delivery-fee rule.
 *
 * Web's version of this went wrong at the sharp end (mandys_bubble_tea #147):
 * a reward tapped and Pay hit inside the 250ms debounce opened a payment sheet
 * for an order the server priced at $0.
 */
describe('isQuoteStale', () => {
  it('is not stale when there is nothing to price', () => {
    expect(isQuoteStale(null, null)).toBe(false)
    expect(isQuoteStale(null, 'older-cart')).toBe(false)
  })

  it('is stale before the first answer lands', () => {
    expect(isQuoteStale('cart-a', null)).toBe(true)
  })

  it('is not stale once this cart has been answered', () => {
    expect(isQuoteStale('cart-a', 'cart-a')).toBe(false)
  })

  it('is stale while the previous cart is the one on hand', () => {
    // Reward count is part of the key, so the moment it changes the quote on
    // screen is answering the wrong question.
    expect(isQuoteStale('cart-a|reward-1', 'cart-a|reward-0')).toBe(true)
  })
})

describe('nothingToPay', () => {
  const quote = (netTotalCents: string): OrderQuote =>
    ({
      subtotalCents: '620',
      discounts: [],
      serviceCharges: [],
      discountTotalCents: '0',
      serviceChargeTotalCents: '0',
      rewardCupsSumCents: '620',
      totalCents: '620',
      netTotalCents,
      estimated: false,
    }) as OrderQuote

  it('is false with no reward applied', () => {
    expect(nothingToPay(quote('0'), 0, true)).toBe(false)
  })

  it('is false before a quote exists — "don\'t know" is not "free"', () => {
    expect(nothingToPay(null, 1, true)).toBe(false)
  })

  it('is true when the server prices the order at zero', () => {
    expect(nothingToPay(quote('0'), 1, true)).toBe(true)
  })

  it('is false when a delivery redeem still owes its fees', () => {
    // The reward covers the drinks; delivery + service fees are still charged
    // (the 2026-07-10 rule). Reading the server total instead of re-deriving
    // it is what keeps this correct without a second copy of that rule.
    expect(nothingToPay(quote('845'), 1, false)).toBe(false)
    expect(nothingToPay(quote('845'), 1, true)).toBe(false)
  })

  it('refuses to answer off a quote priced for a different cart', () => {
    // The gap this closes: a re-quote that fails is swallowed, so the request
    // has "settled" (the pay button un-disables, by design — an outage must
    // not strand it) while the quote on hand is still the PREVIOUS cart's.
    // That quote saying $0 says nothing about the cart on screen.
    expect(nothingToPay(quote('0'), 1, false)).toBe(false)
  })
})
