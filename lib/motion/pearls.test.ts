import { LAUNCH_CUP, LAUNCH_PEARLS, LAUNCH_PEARL_R, launchCupInnerHalfWidth, pearlStack } from './pearls'
import { LAUNCH } from './launch-timeline'

describe('pearl stack', () => {
  const stack = pearlStack({ rows: [4, 3], gap: 14, centerX: 60, floorY: 152 })

  it('lays the floor row out evenly, centred', () => {
    const floor = stack.slice(0, 4)
    expect(floor.map((p) => p.cx)).toEqual([39, 53, 67, 81])
    expect(new Set(floor.map((p) => p.cy)).size).toBe(1)
    expect((39 + 81) / 2).toBe(60)
  })

  it('nests the next row in the gaps, one hex row up', () => {
    const top = stack.slice(4)
    expect(top.map((p) => p.cx)).toEqual([46, 60, 74])
    expect(top[0]!.cy).toBeCloseTo(152 - 14 * Math.sin(Math.PI / 3), 1)
    // Each upper pearl sits exactly between two floor pearls.
    expect(top[0]!.cx).toBe((39 + 53) / 2)
    expect(top[2]!.cx).toBe((67 + 81) / 2)
  })

  it('never lets two pearls overlap', () => {
    for (let i = 0; i < stack.length; i++) {
      for (let j = i + 1; j < stack.length; j++) {
        const a = stack[i]!, b = stack[j]!
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy)
        expect(d).toBeGreaterThanOrEqual(14 - 0.11)
      }
    }
  })

  it('drops the floor row first', () => {
    const cys = stack.map((p) => p.cy)
    for (let i = 1; i < cys.length; i++) expect(cys[i]).toBeLessThanOrEqual(cys[i - 1]!)
  })
})

describe('launch cup pearls', () => {
  it('has as many pearls as the timeline staggers', () => {
    expect(LAUNCH_PEARLS.length).toBe(LAUNCH.pearlCount)
  })

  it('all sit inside the cup wall at their height, and on or above the floor', () => {
    for (const p of LAUNCH_PEARLS) {
      const half = launchCupInnerHalfWidth(p.cy)
      expect(p.cx - LAUNCH_PEARL_R).toBeGreaterThanOrEqual(LAUNCH_CUP.centerX - half)
      expect(p.cx + LAUNCH_PEARL_R).toBeLessThanOrEqual(LAUNCH_CUP.centerX + half)
      expect(p.cy + LAUNCH_PEARL_R).toBeLessThanOrEqual(LAUNCH_CUP.floor - LAUNCH_CUP.stroke / 2)
    }
  })

  it('stay under the liquid surface, not floating', () => {
    // Surface rests at 86 once poured (LiquidCup: SURFACE_Y + FULL_OFFSET).
    for (const p of LAUNCH_PEARLS) expect(p.cy - LAUNCH_PEARL_R).toBeGreaterThan(86)
  })

  it('wall tapers from rim to floor', () => {
    expect(launchCupInnerHalfWidth(44)).toBeCloseTo(36.5)
    expect(launchCupInnerHalfWidth(160)).toBeCloseTo(28.5)
  })
})
