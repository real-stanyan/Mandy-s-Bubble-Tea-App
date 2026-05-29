import {
  TOP10_CATEGORY_SLUG,
  getTop10Preset,
  lockedToppingsFor,
  displayNameFor,
  lockedModifierIds,
  isLockedToppingName,
} from './top10-presets'

describe('top10-presets', () => {
  it('slug constant is top-10', () => {
    expect(TOP10_CATEGORY_SLUG).toBe('top-10')
  })
  it('looks up presets case-insensitively', () => {
    expect(getTop10Preset('Taro Milk Tea')?.lockedToppings).toEqual(['Pudding'])
    expect(getTop10Preset(' taro milk tea ')?.lockedToppings).toEqual(['Pudding'])
    expect(getTop10Preset('Four Seasons Fruit Tea')).toBeUndefined()
  })
  it('lockedToppingsFor only inside top-10', () => {
    expect(lockedToppingsFor('top-10', 'Original Milk Tea')).toEqual(['Pearls', 'Herbal Jelly', 'Pudding'])
    expect(lockedToppingsFor('milk-tea', 'Original Milk Tea')).toEqual([])
    expect(lockedToppingsFor(undefined, 'Original Milk Tea')).toEqual([])
    expect(lockedToppingsFor('top-10', 'Lemon Black Tea')).toEqual([])
  })
  it('displayNameFor renames only inside top-10', () => {
    expect(displayNameFor('top-10', 'Original Milk Tea')).toBe('Original Milk Tea Trio (Pearl, Grass Jelly & Pudding)')
    expect(displayNameFor('top-10', 'Taro Milk Tea')).toBe('Taro Milk Tea (with Pudding)')
    expect(displayNameFor('top-10', 'Brown Sugar Milk Tea')).toBe('Brown Sugar Milk Tea (with Pearls)')
    expect(displayNameFor('milk-tea', 'Original Milk Tea')).toBe('Original Milk Tea')
    expect(displayNameFor('milk-tea', 'Taro Milk Tea')).toBe('Taro Milk Tea')
  })
  it('isLockedToppingName trims + case-insensitive', () => {
    expect(isLockedToppingName(' pudding ', ['Pudding'])).toBe(true)
    expect(isLockedToppingName('Pearls', ['Pudding'])).toBe(false)
  })
  it('lockedModifierIds finds ids across lists', () => {
    const lists = [
      { id: 'L1', modifiers: [{ id: 'm1', name: 'Pearls' }, { id: 'm2', name: 'Pudding' }] },
      { id: 'L2', modifiers: [{ id: 'm3', name: 'Standard Sugar' }] },
    ]
    expect(lockedModifierIds(lists, ['Pearls', 'Pudding'])).toEqual([
      { listId: 'L1', modifierId: 'm1' },
      { listId: 'L1', modifierId: 'm2' },
    ])
    expect(lockedModifierIds([], ['Pearls'])).toEqual([])
    expect(lockedModifierIds(lists, ['Mango Jelly'])).toEqual([])
  })
})
