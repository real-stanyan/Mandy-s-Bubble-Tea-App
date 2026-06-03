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
