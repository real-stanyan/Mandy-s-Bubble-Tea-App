import { tierCheckoutPreview } from './tier-checkout-preview'
import type { CupRecord } from './tier-toppings'

const cup = (unitPrice: number, toppingPrices: number[]): CupRecord => ({
  unitPrice,
  toppingPrices,
})

describe('tierCheckoutPreview', () => {
  it('silver → all zeros regardless of cart contents', () => {
    const result = tierCheckoutPreview({
      tier: 'silver',
      cups: [cup(900, [100, 80]), cup(750, [60])],
      rewardCount: 0,
      toppingsRemaining: 10,
      subtotal: 1890,
      rewardDiscount: 0,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result).toEqual({
      tierDiscountCents: 0,
      toppingCoveredCents: 0,
      toppingCoveredCount: 0,
    })
  })

  it('gold → 5% of (subtotal − welcome), no topping coverage even with cups+remaining', () => {
    // subtotal 1890, welcomeDiscount 200 → base = 1690 → 5% = 84
    const result = tierCheckoutPreview({
      tier: 'gold',
      cups: [cup(900, [100, 80]), cup(750, [60])],
      rewardCount: 0,
      toppingsRemaining: 10,
      subtotal: 1890,
      rewardDiscount: 0,
      welcomeDiscount: 200,
      igFollowDiscount: 0,
    })
    expect(result.toppingCoveredCents).toBe(0)
    expect(result.toppingCoveredCount).toBe(0)
    // base = 1890 - 200 = 1690; 5% = 84 (1690*5/100 = 84.5 → floor 84)
    expect(result.tierDiscountCents).toBe(84)
  })

  it('diamond → toppings covered then 5% of remainder', () => {
    // pool = [100, 80, 60]; covered: min(10, 3) = 3, amount = 240
    // base = 1890 - 240 = 1650; tier discount = floor(1650*5/100) = 82
    const result = tierCheckoutPreview({
      tier: 'diamond',
      cups: [cup(900, [100, 80]), cup(750, [60])],
      rewardCount: 0,
      toppingsRemaining: 10,
      subtotal: 1890,
      rewardDiscount: 0,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.toppingCoveredCents).toBe(240)
    expect(result.toppingCoveredCount).toBe(3)
    expect(result.tierDiscountCents).toBe(82)
  })

  it('base floors at 0 when rewardDiscount ≥ subtotal', () => {
    const result = tierCheckoutPreview({
      tier: 'gold',
      cups: [cup(500, [])],
      rewardCount: 1,
      toppingsRemaining: 0,
      subtotal: 500,
      rewardDiscount: 600,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.tierDiscountCents).toBe(0)
    expect(result.toppingCoveredCents).toBe(0)
  })

  it('rewardCount excludes cheapest cup toppings (mirror server case)', () => {
    // rewardCount 1 excludes cheapest (750) cup → pool [100, 80] = 180
    // base = 1890 - 810 - 180 = 900 → floor(900*5/100) = 45
    const result = tierCheckoutPreview({
      tier: 'diamond',
      cups: [cup(900, [100, 80]), cup(750, [60])],
      rewardCount: 1,
      toppingsRemaining: 10,
      subtotal: 1890,
      rewardDiscount: 810,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.toppingCoveredCents).toBe(180)
    expect(result.toppingCoveredCount).toBe(2)
    expect(result.tierDiscountCents).toBe(45)
  })
})

/**
 * Amount-consistency tests: local preview must equal a hand computation of
 * the server formula in /api/orders —
 *   base = drinksSubtotal − welcome − ig − rewardCups − toppingCovered (min 0)
 *   tierDiscount = floor(base × 5%)
 * (web computes `(base * 5n) / 100n` in bigint = truncation = floor for the
 * non-negative base; Math.floor matches exactly).
 */
describe('amount consistency vs server formula', () => {
  it('gold cart: paid toppings + 1 reward cup', () => {
    // Cart: cup A 950 (toppings 100, 80), cup B 700 (topping 50), cup C 650 (no toppings)
    // subtotal = 2300; rewardCount 1 → cheapest cup (650) free → rewardDiscount 650
    // welcome 30% on one cup (700) = 210; ig 0
    const cups = [cup(950, [100, 80]), cup(700, [50]), cup(650, [])]
    const subtotal = 950 + 700 + 650
    const rewardDiscount = 650
    const welcomeDiscount = 210
    const result = tierCheckoutPreview({
      tier: 'gold',
      cups,
      rewardCount: 1,
      toppingsRemaining: 0, // irrelevant for gold
      subtotal,
      rewardDiscount,
      welcomeDiscount,
      igFollowDiscount: 0,
    })
    // Server: gold covers no toppings.
    expect(result.toppingCoveredCents).toBe(0)
    // Server: base = 2300 − 210 − 0 − 650 − 0 = 1440 → floor(1440 * 0.05) = 72
    const base = subtotal - welcomeDiscount - 0 - rewardDiscount - 0
    expect(result.tierDiscountCents).toBe(Math.floor((base * 5) / 100))
    expect(result.tierDiscountCents).toBe(72)
  })

  it('diamond cart: paid toppings + 1 reward cup + quota truncation', () => {
    // Cart: cup A 990 (toppings 90, 70), cup B 850 (toppings 60, 0), cup C 640 (topping 40)
    // rewardCount 1 → cheapest cup C (640) excluded from topping pool
    // pool = [90, 70, 60] desc; remaining quota 2 → cover 90 + 70 = 160
    const cups = [cup(990, [90, 70]), cup(850, [60, 0]), cup(640, [40])]
    const subtotal = 990 + 850 + 640 // 2480
    const rewardDiscount = 640
    const result = tierCheckoutPreview({
      tier: 'diamond',
      cups,
      rewardCount: 1,
      toppingsRemaining: 2,
      subtotal,
      rewardDiscount,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.toppingCoveredCount).toBe(2)
    expect(result.toppingCoveredCents).toBe(160)
    // Server: base = 2480 − 0 − 0 − 640 − 160 = 1680 → floor(1680 * 0.05) = 84
    const base = subtotal - 0 - 0 - rewardDiscount - result.toppingCoveredCents
    expect(result.tierDiscountCents).toBe(Math.floor((base * 5) / 100))
    expect(result.tierDiscountCents).toBe(84)
  })

  it('floor (not round) on a .5-cent-adjacent base', () => {
    // base = 1690 → 5% = 84.5 → server bigint truncation yields 84
    const result = tierCheckoutPreview({
      tier: 'gold',
      cups: [],
      rewardCount: 0,
      toppingsRemaining: 0,
      subtotal: 1690,
      rewardDiscount: 0,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.tierDiscountCents).toBe(84)
  })

  it('diamond remaining=0 → no topping row, 5% still applies', () => {
    const result = tierCheckoutPreview({
      tier: 'diamond',
      cups: [cup(900, [100])],
      rewardCount: 0,
      toppingsRemaining: 0,
      subtotal: 900,
      rewardDiscount: 0,
      welcomeDiscount: 0,
      igFollowDiscount: 0,
    })
    expect(result.toppingCoveredCents).toBe(0)
    expect(result.toppingCoveredCount).toBe(0)
    expect(result.tierDiscountCents).toBe(45)
  })
})
