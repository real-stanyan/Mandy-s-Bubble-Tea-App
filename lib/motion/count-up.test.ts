import { COUNT_UP_MS, countUpFrame, easeOutCubic } from './count-up'

describe('count up', () => {
  it('starts where it was and lands exactly where it is going', () => {
    expect(countUpFrame(0, 48, 0)).toBe(0)
    expect(countUpFrame(0, 48, 1)).toBe(48)
    expect(countUpFrame(0, 48, 1.7)).toBe(48)
    expect(countUpFrame(6, 8, 1)).toBe(8)
  })

  it('front-loads the motion (ease-out): past half the value by a quarter of the time', () => {
    expect(countUpFrame(0, 100, 0.25)).toBeGreaterThan(50)
    expect(countUpFrame(0, 100, 0.5)).toBeGreaterThan(80)
  })

  it('never overshoots and only ever moves toward the target', () => {
    let prev = 0
    for (let i = 0; i <= 40; i++) {
      const v = countUpFrame(0, 37, i / 40)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeLessThanOrEqual(37)
      prev = v
    }
  })

  it('counts down as happily as up (a redeemed reward lowers the balance)', () => {
    expect(countUpFrame(9, 0, 0)).toBe(9)
    expect(countUpFrame(9, 0, 0.5)).toBeLessThan(9)
    expect(countUpFrame(9, 0, 1)).toBe(0)
  })

  it('shows integers only', () => {
    for (let i = 0; i <= 10; i++) {
      expect(Number.isInteger(countUpFrame(0, 7, i / 10))).toBe(true)
    }
  })

  it('treats a missing number as zero rather than NaN on screen', () => {
    expect(countUpFrame(NaN, 5, 0.5)).not.toBeNaN()
    expect(countUpFrame(0, NaN, 1)).toBe(0)
  })

  it('easing is clamped and monotonic', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(COUNT_UP_MS).toBe(900)
  })
})
