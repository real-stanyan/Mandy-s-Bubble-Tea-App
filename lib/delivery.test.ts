import {
  DELIVERABLE_POSTCODES,
  MIN_ORDER_CENTS,
  isDeliverablePostcode,
  isDeliveryEligible,
  deliverySubtitle,
} from './delivery'

describe('delivery zone + eligibility', () => {
  it('whitelists exactly the 6 postcodes', () => {
    expect([...DELIVERABLE_POSTCODES]).toEqual(['4211', '4214', '4215', '4216', '4217', '4218'])
  })
  it('isDeliverablePostcode trims + matches', () => {
    expect(isDeliverablePostcode('4215')).toBe(true)
    expect(isDeliverablePostcode(' 4215 ')).toBe(true)
    expect(isDeliverablePostcode('4000')).toBe(false)
    expect(isDeliverablePostcode('')).toBe(false)
    expect(isDeliverablePostcode(null)).toBe(false)
  })
  it('isDeliveryEligible gates at $12', () => {
    expect(isDeliveryEligible(1199)).toBe(false)
    expect(isDeliveryEligible(1200)).toBe(true)
    expect(isDeliveryEligible(2000)).toBe(true)
  })
  it('deliverySubtitle shows free-over when eligible, add-to-enable when not', () => {
    expect(deliverySubtitle(2000)).toBe(`free over ${require('@/lib/utils').formatPrice(3500)}`)
    expect(deliverySubtitle(1000)).toBe(`Add ${require('@/lib/utils').formatPrice(200)} to enable`)
  })
})

import {
  quoteReasonCopy,
  feeValueText,
  deliveryFeesPending,
  deliveryAddOnCents,
} from './delivery'

describe('quote reason copy (verbatim from web)', () => {
  it('maps known reasons', () => {
    expect(quoteReasonCopy('out_of_zone')).toBe("Sorry, we don't deliver to that postcode")
    expect(quoteReasonCopy('closed')).toBe('Delivery hours: 10:30am–10:30pm')
    expect(quoteReasonCopy('min_order')).toBe('Add more to qualify for delivery')
    expect(quoteReasonCopy('auth')).toBe('Sign in to get a delivery quote')
    expect(quoteReasonCopy('invalid_body')).toBe('Address looks invalid — try a fuller address')
    expect(quoteReasonCopy('invalid_json')).toBe('Address looks invalid — try a fuller address')
  })
  it('falls back for unknown', () => {
    expect(quoteReasonCopy('weird')).toBe('Delivery unavailable')
  })
})

describe('fee display', () => {
  it('pending → em dash, free → FREE, else amount', () => {
    expect(feeValueText(true, 499)).toBe('—')
    expect(feeValueText(false, 0)).toBe('FREE')
    expect(feeValueText(false, 499)).toBe(require('@/lib/utils').formatPrice(499))
  })
  it('deliveryFeesPending only when DELIVERY + not free-redeem + quote not ok', () => {
    expect(deliveryFeesPending('DELIVERY', false, 'loading')).toBe(true)
    expect(deliveryFeesPending('DELIVERY', false, 'ok')).toBe(false)
    expect(deliveryFeesPending('DELIVERY', true, 'loading')).toBe(false)
    expect(deliveryFeesPending('PICKUP', false, 'loading')).toBe(false)
  })
  it('deliveryAddOnCents adds fee+service only when applicable', () => {
    const ok = { kind: 'ok' as const, feeCents: 499, serviceFeeCents: 100 }
    expect(deliveryAddOnCents('DELIVERY', false, ok)).toBe(599)
    expect(deliveryAddOnCents('DELIVERY', true, ok)).toBe(0)
    expect(deliveryAddOnCents('PICKUP', false, ok)).toBe(0)
    expect(deliveryAddOnCents('DELIVERY', false, { kind: 'loading' })).toBe(0)
  })
})
