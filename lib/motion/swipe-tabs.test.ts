import {
  FLICK,
  FRINGE_FADE,
  FRINGE_GONE,
  HAZE_FULL_AT,
  OVERDRAG,
  SNAP_MAX_VELOCITY,
  SWIPE_SNAP,
  fogSheetX,
  fringeOpacity,
  hazeStrength,
  overdrag,
  pageX,
  rubberBand,
  seamSide,
  settleTarget,
  snapVelocity,
  travelDuration,
} from './swipe-tabs'
import { SLIDE_MS } from './slide'

const COUNT = 4
const W = 390

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

describe('the landing spring', () => {
  it('has a little give rather than stopping dead', () => {
    // Under-damped: damping below the critical 2·sqrt(k·m).
    const { damping, stiffness, mass } = SWIPE_SNAP
    expect(damping!).toBeLessThan(2 * Math.sqrt(stiffness! * mass!))
    expect(SWIPE_SNAP.overshootClamping).toBeUndefined()
  })

  it('is handed no more than a bounded speed', () => {
    expect(snapVelocity(0.4)).toBe(0.4)
    expect(snapVelocity(9)).toBe(SNAP_MAX_VELOCITY)
    expect(snapVelocity(-9)).toBe(-SNAP_MAX_VELOCITY)
  })
})

describe('hazeStrength', () => {
  it('is nothing while the pager rests on the page being left', () => {
    expect(hazeStrength(0, 0)).toBe(0)
    expect(hazeStrength(2, 2)).toBe(0)
  })

  it('grows with the distance gone, either way', () => {
    expect(hazeStrength(0.2, 0)).toBeGreaterThan(0)
    expect(hazeStrength(0.4, 0)).toBeGreaterThan(hazeStrength(0.2, 0))
    expect(hazeStrength(1.6, 2)).toBeCloseTo(hazeStrength(2.4, 2))
  })

  it('is whole by HAZE_FULL_AT and stays whole through a bounce', () => {
    expect(hazeStrength(HAZE_FULL_AT, 0)).toBe(1)
    expect(hazeStrength(1.03, 0)).toBe(1)
  })
})

describe('seamSide', () => {
  it('names the edge that meets the page coming in', () => {
    expect(seamSide(0.3, 0)).toBe(1)
    expect(seamSide(1.7, 2)).toBe(-1)
  })
})

describe('fogSheetX', () => {
  it('keeps the sheet wholly beyond the seam edge while there is no haze', () => {
    // Sheet laid out from x=0, 2W wide: at W it starts at the right edge.
    expect(fogSheetX(0, 1, W)).toBe(W)
    // From the left: its right end sits at the left edge.
    expect(fogSheetX(0, -1, W)).toBe(-2 * W)
  })

  it('has the solid half over the page at full haze', () => {
    expect(fogSheetX(1, 1, W)).toBe(-W)
    expect(fogSheetX(1, -1, W)).toBe(0)
  })

  it('rolls the soft front in from the seam', () => {
    // Halfway: the fading half covers the page, solid at the seam edge.
    expect(fogSheetX(0.5, 1, W)).toBe(0)
    expect(fogSheetX(0.5, -1, W)).toBe(-W)
    // Monotonic: more haze, further in.
    expect(fogSheetX(0.7, 1, W)).toBeLessThan(fogSheetX(0.3, 1, W))
    expect(fogSheetX(0.7, -1, W)).toBeGreaterThan(fogSheetX(0.3, -1, W))
  })
})

describe('fringeOpacity', () => {
  it('draws a page whole until only its last sliver is left', () => {
    expect(fringeOpacity(1, 1)).toBe(1)
    expect(fringeOpacity(1, 0.5)).toBe(1)
    expect(fringeOpacity(1, 1 - FRINGE_FADE)).toBe(1)
  })

  it('has the page beyond gone before a bounce could show it', () => {
    // Landing on Menu with a 1.5% overshoot: Orders is 0.985 away.
    expect(fringeOpacity(2, 1.015)).toBe(0)
    expect(fringeOpacity(2, 1 + (1 - FRINGE_GONE))).toBeCloseTo(0, 6)
  })

  it('fades between the two marks', () => {
    const mid = (FRINGE_FADE + FRINGE_GONE) / 2
    expect(fringeOpacity(1, 1 + mid)).toBeCloseTo(0.5)
  })
})

describe('pageX', () => {
  it('rests on the current page', () => {
    expect(pageX(2, 2, 100)).toBe(0)
    expect(pageX(3, 2, 100)).toBe(100)
    expect(pageX(1, 2, 100)).toBe(-100)
    expect(pageX(1, 0.3, 100)).toBeCloseTo(70)
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
