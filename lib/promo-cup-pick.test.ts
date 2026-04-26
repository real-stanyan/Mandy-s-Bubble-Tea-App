import { pickPromoCups } from './promo-cup-pick'

describe('pickPromoCups', () => {
  it('welcome takes cheapest 2, IG takes next 1', () => {
    const result = pickPromoCups({ unitPrices: [1000, 800, 600], welcomeK: 2, igFollowK: 1 })
    expect(result.welcomeCups).toEqual([600, 800])
    expect(result.igFollowCups).toEqual([1000])
  })

  it('welcome only — IG empty when igFollowK=0', () => {
    const result = pickPromoCups({ unitPrices: [1000, 800, 600], welcomeK: 2, igFollowK: 0 })
    expect(result.welcomeCups).toEqual([600, 800])
    expect(result.igFollowCups).toEqual([])
  })

  it('IG only — welcome empty when welcomeK=0', () => {
    const result = pickPromoCups({ unitPrices: [1000, 800, 600], welcomeK: 0, igFollowK: 1 })
    expect(result.welcomeCups).toEqual([])
    expect(result.igFollowCups).toEqual([600])
  })

  it('one-cup welcome-priority rule: welcome wins when both promos active', () => {
    const result = pickPromoCups({ unitPrices: [800], welcomeK: 1, igFollowK: 1 })
    expect(result.welcomeCups).toEqual([800])
    expect(result.igFollowCups).toEqual([])
  })

  it('clamps welcomeK to available cup count', () => {
    const result = pickPromoCups({ unitPrices: [600, 800], welcomeK: 5, igFollowK: 1 })
    expect(result.welcomeCups).toEqual([600, 800])
    expect(result.igFollowCups).toEqual([])
  })

  it('IG gets fewer cups when welcomeK consumes most cups', () => {
    const result = pickPromoCups({ unitPrices: [600, 800, 1000], welcomeK: 2, igFollowK: 2 })
    expect(result.welcomeCups).toEqual([600, 800])
    expect(result.igFollowCups).toEqual([1000])
  })

  it('empty unitPrices → both empty', () => {
    const result = pickPromoCups({ unitPrices: [], welcomeK: 1, igFollowK: 1 })
    expect(result.welcomeCups).toEqual([])
    expect(result.igFollowCups).toEqual([])
  })

  it('does not mutate input array', () => {
    const prices = [1000, 800, 600]
    pickPromoCups({ unitPrices: prices, welcomeK: 2, igFollowK: 1 })
    expect(prices).toEqual([1000, 800, 600])
  })
})
