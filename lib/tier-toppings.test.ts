import { collectPaidToppingUnits, coverFreeToppings, type CupRecord } from './tier-toppings'

const cup = (unitPrice: number, toppingPrices: number[]): CupRecord => ({
  unitPrice,
  toppingPrices,
})

describe('collectPaidToppingUnits', () => {
  it('collects paid toppings from all cups, most expensive first', () => {
    const cups = [cup(900, [80, 100]), cup(750, [60])]
    expect(collectPaidToppingUnits(cups, 0)).toEqual([100, 80, 60])
  })

  it('drops zero-price toppings (included/free modifiers are not quota)', () => {
    const cups = [cup(900, [0, 80, 0])]
    expect(collectPaidToppingUnits(cups, 0)).toEqual([80])
  })

  it('excludes the cheapest N cups (loyalty-reward cups, already free)', () => {
    const cups = [cup(900, [100]), cup(500, [60]), cup(700, [80])]
    expect(collectPaidToppingUnits(cups, 1)).toEqual([100, 80])
  })

  it('excludeRewardCount >= cup count -> empty pool', () => {
    expect(collectPaidToppingUnits([cup(900, [100])], 5)).toEqual([])
  })
})

describe('coverFreeToppings', () => {
  it('covers up to remaining, most expensive first', () => {
    const r = coverFreeToppings([100, 80, 60], 2)
    expect(r.coveredCount).toBe(2)
    expect(r.amount).toBe(180)
  })

  it('covers all when remaining exceeds pool', () => {
    const r = coverFreeToppings([100, 80], 10)
    expect(r.coveredCount).toBe(2)
    expect(r.amount).toBe(180)
  })

  it('zero remaining or empty pool -> zero', () => {
    expect(coverFreeToppings([100], 0)).toEqual({ coveredCount: 0, amount: 0 })
    expect(coverFreeToppings([], 5)).toEqual({ coveredCount: 0, amount: 0 })
    expect(coverFreeToppings([100], -3)).toEqual({ coveredCount: 0, amount: 0 })
  })
})
