import {
  CAPSULE_BAG,
  CAPSULE_PAD,
  DOCK_GAP,
  capsuleOpacity,
  capsuleSlide,
  capsuleWidth,
  cartDockBagCenter,
  pillWidth,
  slotWidth,
} from './cart-dock'

describe('the bag capsule', () => {
  it('is as wide as its total needs, and no wider', () => {
    const small = capsuleWidth('A$6.20')
    const big = capsuleWidth('A$120.00')
    expect(big).toBeGreaterThan(small)
    expect(small).toBeGreaterThan(CAPSULE_PAD * 2 + CAPSULE_BAG)
    expect(small).toBeLessThan(140)
  })

  it('takes its width and the gap from the pill as it opens', () => {
    expect(pillWidth(335, 120, 0)).toBe(335)
    expect(pillWidth(335, 120, 1)).toBe(335 - 120 - DOCK_GAP)
    expect(pillWidth(335, 120, 0.5)).toBe(335 - (120 + DOCK_GAP) / 2)
  })

  it('leaves every tab a slot, and never a negative one', () => {
    expect(slotWidth(335, 4, 4)).toBeCloseTo((335 - 8) / 4)
    expect(slotWidth(0, 4, 4)).toBe(0)
    expect(slotWidth(200, 4, 0)).toBe(0)
  })

  it('sits past the edge when shut and in its place when open', () => {
    expect(capsuleSlide(1, 120)).toBe(0)
    expect(capsuleSlide(0, 120)).toBeGreaterThan(120)
    expect(capsuleSlide(0.5, 120)).toBeCloseTo(capsuleSlide(0, 120) / 2)
  })

  it('is whole well before the slide ends, and gone at the start', () => {
    expect(capsuleOpacity(0)).toBe(0)
    expect(capsuleOpacity(0.7)).toBe(1)
    expect(capsuleOpacity(1.1)).toBe(1)
    expect(capsuleOpacity(0.25)).toBeCloseTo(0.4)
  })

  it('tells the fly-to-bag dot where the bag glyph will be', () => {
    const w = capsuleWidth('A$6.20')
    const c = cartDockBagCenter({ windowWidth: 393, windowHeight: 852, margin: 20, lift: 26, height: 52, capsuleW: w })
    expect(c.x).toBe(393 - 20 - w + CAPSULE_PAD + CAPSULE_BAG / 2)
    expect(c.y).toBe(852 - 26 - 26)
    // The glyph is inside the capsule, on its left.
    expect(c.x).toBeGreaterThan(393 - 20 - w)
    expect(c.x).toBeLessThan(393 - 20 - w / 2)
  })
})
