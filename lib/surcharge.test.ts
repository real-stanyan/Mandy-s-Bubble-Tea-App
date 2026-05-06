import { cardSurcharge, platformFee, publicHolidaySurcharge } from './surcharge'

describe('cardSurcharge (1.9%)', () => {
  it('rounds half-up (matches Square SUBTOTAL_PHASE)', () => {
    // 1.9% of 620 = 11.78 → round 12
    expect(cardSurcharge(620)).toBe(12)
    // 1.9% of 100 = 1.9 → round 2
    expect(cardSurcharge(100)).toBe(2)
    // 1.9% of 0 = 0
    expect(cardSurcharge(0)).toBe(0)
  })

  it('clamps negative inputs to 0', () => {
    expect(cardSurcharge(-1)).toBe(0)
  })
})

describe('platformFee (0.5%)', () => {
  it('rounds half-up', () => {
    // 0.5% of 620 = 3.1 → round 3
    expect(platformFee(620)).toBe(3)
    // 0.5% of 1240 = 6.2 → round 6
    expect(platformFee(1240)).toBe(6)
    // 0.5% of 125 = 0.625 → round 1 (Math.round half-up matches Square)
    expect(platformFee(125)).toBe(1)
    expect(platformFee(0)).toBe(0)
  })

  it('clamps negative inputs to 0', () => {
    expect(platformFee(-1)).toBe(0)
  })

  it('handles large amounts', () => {
    // 0.5% of $10,000.00 = $50.00
    expect(platformFee(1_000_000)).toBe(5_000)
  })
})

describe('publicHolidaySurcharge (10%)', () => {
  it('rounds half-up', () => {
    expect(publicHolidaySurcharge(620)).toBe(62)
    expect(publicHolidaySurcharge(125)).toBe(13) // 12.5 → round 13
    expect(publicHolidaySurcharge(0)).toBe(0)
  })

  it('clamps negative inputs to 0', () => {
    expect(publicHolidaySurcharge(-1)).toBe(0)
  })
})
