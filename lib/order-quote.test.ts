import { quoteCents, serviceChargeCents, type OrderQuote } from '@/lib/order-quote'

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
