// lib/doodle/cartToSlots.test.ts
import { cartToSlots } from './cartToSlots'
import type { CartItem } from '@/types/square'
import type { CupLabelSelection } from '@/store/cart'

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
    const slots = cartToSlots([item({ quantity: 3 })], {})
    expect(slots).toHaveLength(3)
    expect(slots.map((s) => s.cupIdx)).toEqual([0, 1, 2])
  })

  it('produces cupKey = `${lineId}:${cupIdx}` for each slot', () => {
    const slots = cartToSlots([item({ lineId: 'X::Y', quantity: 2 })], {})
    expect(slots.map((s) => s.cupKey)).toEqual(['X::Y:0', 'X::Y:1'])
  })

  it('uses provided selection when present', () => {
    const sel: CupLabelSelection = { kind: 'preset', hash: 'manual-hash' }
    const slots = cartToSlots([item({ lineId: 'A', quantity: 1 })], { 'A:0': sel })
    expect(slots[0]!.selection).toEqual(sel)
  })

  it('leaves selection null (surprise tarot card) when none provided', () => {
    // Cup labels are optional: an untouched cup carries no selection and the
    // server prints a random tarot card for it. We must NOT synthesize a
    // gallery sticker here — doing so made the picker look mandatory and
    // overrode the tarot fallback.
    const slots = cartToSlots([item({ lineId: 'A', quantity: 1 })], {})
    expect(slots[0]!.selection).toBeNull()
  })

  it('leaves every untouched cup null, keeps only explicit picks', () => {
    const sel: CupLabelSelection = { kind: 'preset', hash: 'manual-hash' }
    const slots = cartToSlots([item({ lineId: 'A', quantity: 3 })], { 'A:1': sel })
    expect(slots.map((s) => s.selection)).toEqual([null, sel, null])
  })

  it('drinkName is preserved from cart item', () => {
    const slots = cartToSlots([item({ name: 'Mango Tea' })], {})
    expect(slots[0]!.drinkName).toBe('Mango Tea')
  })
})
