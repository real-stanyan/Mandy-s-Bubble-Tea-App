// store/cart-selection.test.ts
//
// Tests for CupLabelSelection union + setLabel/clearLabel actions.
// Uses zustand getState/setState directly (no @testing-library/react-native needed).

import { useCart, cupKey } from './cart'

const baseItem = {
  id: 'ITEM1',
  variationId: 'VAR1',
  name: 'Pearl Milk Tea',
  price: 800,
  modifiers: [] as never[],
  quantity: 1,
  lineId: 'LINE_A',
}

beforeEach(() => {
  useCart.setState({ items: [], labelSelections: {} })
})

describe('useCart label selections', () => {
  it('setLabel writes a selection at cupKey', () => {
    useCart.getState().setLabel('LINE_A:0', { kind: 'preset', hash: 'abc' })
    expect(useCart.getState().labelSelections['LINE_A:0']).toEqual({ kind: 'preset', hash: 'abc' })
  })

  it('clearLabel removes a selection', () => {
    useCart.setState({ labelSelections: { 'X:0': { kind: 'preset', hash: 'h1' } } })
    useCart.getState().clearLabel('X:0')
    expect(useCart.getState().labelSelections['X:0']).toBeUndefined()
  })

  it('clear() wipes labelSelections', () => {
    useCart.setState({ labelSelections: { 'X:0': { kind: 'preset', hash: 'h1' } } })
    useCart.getState().clear()
    expect(useCart.getState().labelSelections).toEqual({})
  })

  it('removeLine prunes labelSelections matching the lineId prefix', () => {
    useCart.setState({
      items: [{ ...baseItem, lineId: 'LINE_A', quantity: 2 }],
      labelSelections: {
        'LINE_A:0': { kind: 'preset', hash: 'h1' },
        'LINE_A:1': { kind: 'preset', hash: 'h2' },
        'LINE_B:0': { kind: 'preset', hash: 'h3' },
      },
    })
    useCart.getState().removeLine('LINE_A')
    const s = useCart.getState().labelSelections
    expect(s['LINE_A:0']).toBeUndefined()
    expect(s['LINE_A:1']).toBeUndefined()
    expect(s['LINE_B:0']).toEqual({ kind: 'preset', hash: 'h3' })
  })
})

describe('cupKey', () => {
  it('joins lineId and cupIdx with a colon', () => {
    expect(cupKey('LINE_X', 3)).toBe('LINE_X:3')
  })
})
