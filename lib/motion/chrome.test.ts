import { chromeShrinkTarget } from './chrome'

describe('chromeShrinkTarget', () => {
  it('shrinks once the page moves down past the top zone', () => {
    expect(chromeShrinkTarget(200, 180, 0)).toBe(1)
  })

  it('comes back whole when the page moves up', () => {
    expect(chromeShrinkTarget(180, 200, 1)).toBe(0)
  })

  it('ignores movement inside the dead band', () => {
    expect(chromeShrinkTarget(203, 200, 0)).toBe(-1)
    expect(chromeShrinkTarget(197, 200, 1)).toBe(-1)
  })

  it('does not repeat a target it already holds', () => {
    expect(chromeShrinkTarget(260, 200, 1)).toBe(-1)
    expect(chromeShrinkTarget(140, 200, 0)).toBe(-1)
  })

  it('is always whole at the top of the page, whichever way it got there', () => {
    expect(chromeShrinkTarget(10, 40, 1)).toBe(0)
    expect(chromeShrinkTarget(10, 0, 0)).toBe(-1)
  })
})
