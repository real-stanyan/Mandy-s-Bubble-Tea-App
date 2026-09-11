import {
  FLICK,
  OVERDRAG,
  overdrag,
  pageX,
  rubberBand,
  seamStrength,
  seamX,
  settleTarget,
  travelDuration,
} from './swipe-tabs'
import { SLIDE_MS } from './slide'

const COUNT = 4

describe('settleTarget', () => {
  it('rests on the page that is more than half in view', () => {
    expect(settleTarget(0.3, 0, 0, COUNT)).toBe(0)
    expect(settleTarget(0.6, 0, 0, COUNT)).toBe(1)
    expect(settleTarget(1.4, 0, 1, COUNT)).toBe(1)
    expect(settleTarget(0.5, 0, 0, COUNT)).toBe(1)
  })

  it('a flick turns the page whatever the distance', () => {
    expect(settleTarget(0.15, FLICK + 0.1, 0, COUNT)).toBe(1)
    expect(settleTarget(0.85, -(FLICK + 0.1), 1, COUNT)).toBe(0)
  })

  it('a flick back to where the drag started is honoured', () => {
    // Pulled most of the way to Menu, then flicked back toward Home.
    expect(settleTarget(0.7, -(FLICK + 0.5), 0, COUNT)).toBe(0)
  })

  it('a slow release below the flick speed goes by distance', () => {
    expect(settleTarget(0.2, FLICK - 0.1, 0, COUNT)).toBe(0)
  })

  it('never lands more than one page from where the drag started', () => {
    expect(settleTarget(1.9, 3, 0, COUNT)).toBe(1)
    expect(settleTarget(0.1, -3, 2, COUNT)).toBe(1)
  })

  it('never lands off the ends', () => {
    expect(settleTarget(-0.15, -2, 0, COUNT)).toBe(0)
    expect(settleTarget(3.15, 2, 3, COUNT)).toBe(3)
    expect(settleTarget(0.4, 0, 0, 1)).toBe(0)
  })
})

describe('rubberBand', () => {
  it('follows the finger between the ends', () => {
    expect(rubberBand(0, COUNT)).toBe(0)
    expect(rubberBand(1.37, COUNT)).toBeCloseTo(1.37)
    expect(rubberBand(3, COUNT)).toBe(3)
  })

  it('gives past the ends, but never more than OVERDRAG', () => {
    const pulls = [0.05, 0.2, 0.5, 2, 50]
    let prev = 0
    for (const p of pulls) {
      const over = overdrag(p)
      expect(over).toBeGreaterThan(prev)
      expect(over).toBeLessThan(OVERDRAG)
      expect(over).toBeLessThanOrEqual(p)
      prev = over
    }
    expect(rubberBand(-0.5, COUNT)).toBeCloseTo(-overdrag(0.5))
    expect(rubberBand(3.5, COUNT)).toBeCloseTo(3 + overdrag(0.5))
  })

  it('starts out 1:1 so the first points of an over-pull do not feel stuck', () => {
    expect(overdrag(0.001) / 0.001).toBeGreaterThan(0.99)
  })
})

describe('seamStrength', () => {
  it('is nothing while the pager rests on a page', () => {
    for (let i = 0; i < COUNT; i++) expect(seamStrength(i, COUNT)).toBe(0)
  })

  it('peaks halfway between two pages and is symmetric', () => {
    expect(seamStrength(0.5, COUNT)).toBe(1)
    expect(seamStrength(0.25, COUNT)).toBeCloseTo(seamStrength(0.75, COUNT))
    expect(seamStrength(0.25, COUNT)).toBeCloseTo(0.75)
  })

  it('is nothing past either end, where there is no second page to meet', () => {
    expect(seamStrength(-0.1, COUNT)).toBe(0)
    expect(seamStrength(3.1, COUNT)).toBe(0)
  })
})

describe('seamX and pageX', () => {
  it('put the seam on the left edge of the page being moved toward', () => {
    expect(seamX(0.3, 100)).toBeCloseTo(70)
    expect(seamX(0.3, 100)).toBeCloseTo(pageX(1, 0.3, 100))
    expect(seamX(1.75, 100)).toBeCloseTo(pageX(2, 1.75, 100))
  })

  it('rest on the current page', () => {
    expect(seamX(2, 100)).toBe(0)
    expect(pageX(2, 2, 100)).toBe(0)
    expect(pageX(3, 2, 100)).toBe(100)
    expect(pageX(1, 2, 100)).toBe(-100)
  })
})

describe('travelDuration', () => {
  it('is the Slide for one page and grows a little per extra page', () => {
    expect(travelDuration(1)).toBe(SLIDE_MS)
    expect(travelDuration(-1)).toBe(SLIDE_MS)
    expect(travelDuration(3)).toBeGreaterThan(SLIDE_MS)
    expect(travelDuration(3)).toBeLessThan(SLIDE_MS * 2)
  })
})
