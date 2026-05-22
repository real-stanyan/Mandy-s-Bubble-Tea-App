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

  it('fills default preset selection from gallery when none provided', () => {
    const slots = cartToSlots([item({ lineId: 'A', quantity: 1 })], {})
    expect(slots[0]!.selection?.kind).toBe('preset')
    if (slots[0]!.selection?.kind === 'preset') {
      expect(slots[0]!.selection.hash).toMatch(/^[0-9a-f]{32}$|^Screenshot|^sticker_|^hat_/)
    }
  })

  it('default is deterministic by lineId+cupIdx', () => {
    const a = cartToSlots([item({ lineId: 'STABLE', quantity: 1 })], {})
    const b = cartToSlots([item({ lineId: 'STABLE', quantity: 1 })], {})
    expect(a[0]!.selection).toEqual(b[0]!.selection)
  })

  it('different lineIds get (usually) different default hashes', () => {
    const a = cartToSlots([item({ lineId: 'LINE_A', quantity: 1 })], {})
    const b = cartToSlots([item({ lineId: 'LINE_B', quantity: 1 })], {})
    if (a[0]!.selection?.kind === 'preset' && b[0]!.selection?.kind === 'preset') {
      expect(a[0]!.selection.hash).not.toBe(b[0]!.selection.hash)
    }
  })

  it('drinkName is preserved from cart item', () => {
    const slots = cartToSlots([item({ name: 'Mango Tea' })], {})
    expect(slots[0]!.drinkName).toBe('Mango Tea')
  })
})
