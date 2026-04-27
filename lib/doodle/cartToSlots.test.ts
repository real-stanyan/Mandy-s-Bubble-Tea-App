import { cartToSlots } from './cartToSlots'
import type { CartItem } from '@/types/square'

const item = (over: Partial<CartItem>): CartItem => ({
  lineId: 'VAR1::MOD_A',
  id: 'ITEM1',
  variationId: 'VAR1',
  name: 'Pearl Milk Tea',
  price: 800,
  quantity: 1,
  modifiers: [],
  ...over,
})

describe('cartToSlots', () => {
  it('expands quantity into one slot per cup', () => {
    const slots = cartToSlots([item({ quantity: 3 })])
    expect(slots).toHaveLength(3)
    expect(slots.map(s => s.cupIdx)).toEqual([0, 1, 2])
  })

  it('uses cart lineId verbatim as DoodleSlot.lineId', () => {
    const slots = cartToSlots([item({ lineId: 'X::Y,Z' })])
    expect(slots[0].lineId).toBe('X::Y,Z')
  })

  it('assigns a defaultKey from the pool', () => {
    const slots = cartToSlots([item({ quantity: 2 })])
    expect(['bunny', 'flower', 'star', 'cloud']).toContain(slots[0].defaultKey)
  })

  it('initialises userPaths as null', () => {
    const slots = cartToSlots([item({ quantity: 1 })])
    expect(slots[0].userPaths).toBeNull()
  })
})
