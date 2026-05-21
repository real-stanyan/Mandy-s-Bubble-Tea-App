// store/cart-migration.test.ts
import { createMigrate } from './cart'

describe('cart persist migration', () => {
  it('v2 state: items retained, labelSelections initialized empty', () => {
    const old = {
      items: [
        { lineId: 'LINE_A', id: 'I1', variationId: 'V1', name: 'X', price: 800, quantity: 1, modifiers: [] },
      ],
      cartSessionId: 'sess-old',
      isOpen: false,
      hydrated: true,
    }
    const migrated = createMigrate(old, 2)
    expect(migrated.items).toHaveLength(1)
    expect(migrated.items[0]!.lineId).toBe('LINE_A')
    expect(migrated.labelSelections).toEqual({})
    expect(migrated.cartSessionId).toBe('sess-old')
  })

  it('v1 state: raw items get lineId synthesized AND labelSelections initialized', () => {
    const old = {
      items: [
        { id: 'I1', variationId: 'V1', name: 'X', price: 800, quantity: 1, modifiers: [] },
      ],
    }
    const migrated = createMigrate(old, 1)
    expect(migrated.items).toHaveLength(1)
    expect(migrated.items[0]!.lineId).toBeDefined()
    expect(migrated.labelSelections).toEqual({})
  })

  it('v3 state passes through with labelSelections preserved', () => {
    const current = {
      items: [],
      labelSelections: { 'X:0': { kind: 'preset' as const, hash: 'abc' } },
      cartSessionId: 'sess',
      isOpen: false,
      hydrated: true,
    }
    const migrated = createMigrate(current, 3)
    expect(migrated.labelSelections).toEqual({ 'X:0': { kind: 'preset', hash: 'abc' } })
  })
})
