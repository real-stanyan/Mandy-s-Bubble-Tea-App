// store/cart-replace.test.ts
//
// replaceItem: the checkout page's Edit swaps a line for a re-customised
// version of itself. Uses zustand getState/setState directly, like the
// sibling cart tests.

import { useCart, buildLineId } from './cart'
import type { CartItem, CartModifier } from '@/types/square'

const PEARLS: CartModifier = { id: 'PEARL', name: 'Pearls', listName: 'TOPPING', priceCents: 80 }
const PUDDING: CartModifier = { id: 'PUDDING', name: 'Pudding', listName: 'TOPPING', priceCents: 80 }

function drink(modifiers: CartModifier[]): Omit<CartItem, 'quantity' | 'lineId'> {
  return {
    id: 'ITEM_TARO',
    variationId: 'VAR1',
    name: 'Taro Milk Tea',
    price: 800 + modifiers.reduce((s, m) => s + m.priceCents, 0),
    variationName: 'Regular',
    modifiers,
  }
}

function inBag(modifiers: CartModifier[], quantity: number): CartItem {
  return { ...drink(modifiers), quantity, lineId: buildLineId('VAR1', modifiers) }
}

const PLAIN_ID = buildLineId('VAR1', [])
const PEARLS_ID = buildLineId('VAR1', [PEARLS])
const PUDDING_ID = buildLineId('VAR1', [PUDDING])
const BOTH_ID = buildLineId('VAR1', [PEARLS, PUDDING])

beforeEach(() => {
  useCart.setState({ items: [], labelSelections: {} })
})

describe('useCart.replaceItem', () => {
  it('changes the quantity in place when the drink itself is unchanged', () => {
    useCart.setState({
      items: [inBag([PEARLS], 3)],
      labelSelections: {
        [`${PEARLS_ID}:0`]: { kind: 'preset', hash: 'a' },
        [`${PEARLS_ID}:2`]: { kind: 'preset', hash: 'c' },
      },
    })

    useCart.getState().replaceItem(PEARLS_ID, drink([PEARLS]), 2)

    const s = useCart.getState()
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ lineId: PEARLS_ID, quantity: 2 })
    // Cup 2 no longer exists; cup 0 keeps its sticker.
    expect(s.labelSelections).toEqual({ [`${PEARLS_ID}:0`]: { kind: 'preset', hash: 'a' } })
  })

  it('swaps the line where it sits and carries its labels to the new key', () => {
    useCart.setState({
      items: [inBag([], 1), inBag([PEARLS], 2), inBag([PUDDING], 1)],
      labelSelections: {
        [`${PEARLS_ID}:1`]: { kind: 'preset', hash: 'keep' },
        [`${PUDDING_ID}:0`]: { kind: 'preset', hash: 'other' },
      },
    })

    // Pearls → Pearls + Pudding, still two cups.
    useCart.getState().replaceItem(PEARLS_ID, drink([PEARLS, PUDDING]), 2)

    const s = useCart.getState()
    expect(s.items.map((i) => i.lineId)).toEqual([PLAIN_ID, BOTH_ID, PUDDING_ID])
    expect(s.items[1].quantity).toBe(2)
    expect(s.labelSelections).toEqual({
      [`${BOTH_ID}:1`]: { kind: 'preset', hash: 'keep' },
      [`${PUDDING_ID}:0`]: { kind: 'preset', hash: 'other' },
    })
  })

  it('folds into an identical line already in the bag, labels after its own cups', () => {
    useCart.setState({
      items: [inBag([PEARLS], 1), inBag([PUDDING], 2)],
      labelSelections: {
        [`${PEARLS_ID}:0`]: { kind: 'preset', hash: 'twin-own' },
        [`${PUDDING_ID}:0`]: { kind: 'preset', hash: 'moved-0' },
        [`${PUDDING_ID}:1`]: { kind: 'preset', hash: 'moved-1' },
      },
    })

    // The Pudding line is edited into Pearls — which is already in the bag.
    useCart.getState().replaceItem(PUDDING_ID, drink([PEARLS]), 2)

    const s = useCart.getState()
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ lineId: PEARLS_ID, quantity: 3 })
    expect(s.labelSelections).toEqual({
      [`${PEARLS_ID}:0`]: { kind: 'preset', hash: 'twin-own' },
      [`${PEARLS_ID}:1`]: { kind: 'preset', hash: 'moved-0' },
      [`${PEARLS_ID}:2`]: { kind: 'preset', hash: 'moved-1' },
    })
  })

  it('adds the drink when the edited line has already gone', () => {
    useCart.setState({ items: [inBag([], 1)] })

    useCart.getState().replaceItem('VAR1::GONE', drink([PEARLS]), 1)

    expect(useCart.getState().items.map((i) => i.lineId)).toEqual([PLAIN_ID, PEARLS_ID])
  })
})
