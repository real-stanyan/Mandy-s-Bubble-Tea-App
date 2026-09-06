import { computeOrderAgain, computeYourUsual } from './helpers'
import type { OrderHistoryItem, OrderHistoryLine } from '@/store/orders'

const line = (name: string, variationId: string, mods: string[] = [], quantity = 1): OrderHistoryLine => ({
  variationId,
  itemId: `item-${name}`,
  imageUrl: null,
  name,
  variationName: 'Regular',
  quantity,
  basePriceCents: '620',
  modifiers: mods.map((m) => ({ id: `mod-${m}`, name: m, listName: 'TOPPING', priceCents: '80' })),
})

const order = (id: string, lines: OrderHistoryLine[], state = 'COMPLETED'): OrderHistoryItem => ({
  id,
  referenceId: null,
  createdAt: null,
  updatedAt: null,
  state,
  fulfillmentState: null,
  totalCents: '0',
  itemSummary: '',
  lineCount: lines.length,
  firstItemName: lines[0]?.name ?? '',
  firstItemImageUrl: null,
  lineItems: lines,
})

// Newest first, like the store keeps them.
const HISTORY = [
  order('o4', [line('Mango Slushy', 'v-mango')]),
  order('o3', [line('Taro Milk Tea', 'v-taro', ['Pudding'])]),
  order('o2', [line('Taro Milk Tea', 'v-taro', ['Pudding']), line('Lychee Iced Green Tea', 'v-lychee')]),
  order('o1', [line('Brown Sugar Milk Tea', 'v-bsugar', ['Pearls'], 2)]),
  order('o0', [line('Taro Milk Tea', 'v-taro', ['Pearls'])], 'CANCELED'),
]

describe('order again', () => {
  it('leads with the most-ordered build, then the rest by recency', () => {
    const rail = computeOrderAgain(HISTORY, 4)
    expect(rail.map((u) => u.name)).toEqual(['Taro Milk Tea', 'Mango Slushy', 'Lychee Iced Green Tea', 'Brown Sugar Milk Tea'])
    expect(rail[0].count).toBe(2)
    expect(rail[0].modifiers.map((m) => m.name)).toEqual(['Pudding'])
  })

  it('treats a different build of the same drink as a different card, and ignores cancelled orders', () => {
    const rail = computeOrderAgain(HISTORY, 10)
    expect(rail.filter((u) => u.name === 'Taro Milk Tea')).toHaveLength(1)
    expect(rail.some((u) => u.modifiers.some((m) => m.name === 'Pearls') && u.name === 'Taro Milk Tea')).toBe(false)
  })

  it('counts quantity, respects the limit, and agrees with the old "your usual" pick', () => {
    expect(computeOrderAgain(HISTORY, 2)).toHaveLength(2)
    expect(computeOrderAgain(HISTORY, 10).find((u) => u.name === 'Brown Sugar Milk Tea')?.count).toBe(2)
    expect(computeOrderAgain(HISTORY, 1)[0].key).toBe(computeYourUsual(HISTORY)?.key)
  })

  it('is empty with no history', () => {
    expect(computeOrderAgain([], 4)).toEqual([])
  })
})
