import { FLY_DOT, FLY_MS, flightFrame } from './fly-path'

const from = { x: 200, y: 780 }
const to = { x: 42, y: 690 }

describe('fly-to-bag arc', () => {
  it('starts on the button and lands on the bag', () => {
    const a = flightFrame(0, from, to)
    expect(a.x).toBe(from.x)
    expect(a.y).toBe(from.y)
    expect(a.scale).toBe(1)
    const b = flightFrame(1, from, to)
    expect(b.x).toBe(to.x)
    expect(b.y).toBe(to.y)
    expect(b.scale).toBeCloseTo(0.3)
    expect(b.opacity).toBeCloseTo(0)
  })

  it('arcs above both endpoints in the middle', () => {
    const mid = flightFrame(0.5, from, to)
    expect(mid.y).toBeLessThan(Math.min(from.y, to.y))
    expect(mid.scale).toBeGreaterThan(1)
  })

  it('moves horizontally at a steady rate', () => {
    expect(flightFrame(0.25, from, to).x).toBeCloseTo(from.x + (to.x - from.x) * 0.25)
  })

  it('clamps progress outside 0..1', () => {
    expect(flightFrame(-1, from, to)).toEqual(flightFrame(0, from, to))
    expect(flightFrame(2, from, to)).toEqual(flightFrame(1, from, to))
  })

  it('lifts a long flight more than a short one, but not by much', () => {
    const shortMid = flightFrame(0.5, { x: 100, y: 500 }, { x: 120, y: 500 })
    const longMid = flightFrame(0.5, { x: 100, y: 500 }, { x: 400, y: 500 })
    expect(longMid.y).toBeLessThan(shortMid.y)
    expect(shortMid.y).toBeLessThan(500 - 80)
    expect(longMid.y).toBeGreaterThan(500 - 160)
  })

  it('stays fully visible until the last stretch', () => {
    expect(flightFrame(0.9, from, to).opacity).toBe(1)
  })

  it('has the timing the design board promises', () => {
    expect(FLY_MS).toBe(720)
    expect(FLY_DOT).toBe(14)
  })
})
