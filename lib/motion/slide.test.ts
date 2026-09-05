import { SLIDE_MS, slotFor, slotFromLayout } from './slide'

const slots = {
  all: { x: 16, y: 0, width: 44, height: 32 },
  active: { x: 66, y: 0, width: 88, height: 32 },
}

describe('slide slots', () => {
  it('returns the measured slot for the active key', () => {
    expect(slotFor(slots, 'active')).toEqual(slots.active)
  })

  it('has nowhere to go before layout or with no selection', () => {
    expect(slotFor(slots, 'past' as keyof typeof slots)).toBeNull()
    expect(slotFor(slots, null)).toBeNull()
    expect(slotFor({}, 'all')).toBeNull()
  })

  it('refuses a half-measured slot', () => {
    expect(slotFor({ all: { x: NaN, y: 0, width: 10, height: 10 } }, 'all')).toBeNull()
  })

  it('copies only the four numbers out of a layout event', () => {
    const s = slotFromLayout({ x: 1, y: 2, width: 3, height: 4 })
    expect(s).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('travels in 400ms', () => {
    expect(SLIDE_MS).toBe(400)
  })
})
