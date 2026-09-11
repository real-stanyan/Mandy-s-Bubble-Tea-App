import { reconcileSnapshot, type MenuSnapshot } from './reconcile'
import { deepEqual } from '@/lib/deep-equal'
import type { CatalogItem } from '@/types/square'

function item(id: string, extra: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    type: 'ITEM',
    imageUrl: `https://x/${id}.png`,
    itemData: {
      name: `Drink ${id}`,
      categories: [{ id: 'c1', name: 'MILK TEA' }],
      variations: [{ id: `${id}-v`, itemVariationData: { name: 'Regular', priceMoney: { amount: 750 } } }],
    },
    ...extra,
  }
}

function snapshot(items: CatalogItem[]): MenuSnapshot {
  return { items, categories: [{ id: 'c1', name: 'MILK TEA' }] }
}

describe('deepEqual', () => {
  it('compares structure, not identity', () => {
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true)
    expect(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(false)
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual(NaN, NaN)).toBe(true)
    expect(deepEqual('7', 7)).toBe(false)
  })
})

describe('reconcileSnapshot', () => {
  it('returns the held snapshot itself when nothing changed', () => {
    const held = snapshot([item('a'), item('b')])
    const next = snapshot([item('a'), item('b')])
    expect(reconcileSnapshot(held, next)).toBe(held)
  })

  it('keeps the objects of unchanged items and replaces only the changed one', () => {
    const a = item('a')
    const b = item('b')
    const held = snapshot([a, b])
    const next = snapshot([item('a'), item('b', { soldOut: true })])
    const out = reconcileSnapshot(held, next)
    expect(out).not.toBe(held)
    expect(out.items[0]).toBe(a)
    expect(out.items[1]).not.toBe(b)
    expect(out.items[1].soldOut).toBe(true)
    expect(out.categories).toBe(held.categories)
  })

  it('notices a reorder, an addition and a removal', () => {
    const a = item('a')
    const b = item('b')
    const held = snapshot([a, b])
    const reordered = reconcileSnapshot(held, snapshot([item('b'), item('a')]))
    expect(reordered.items.map((i) => i.id)).toEqual(['b', 'a'])
    expect(reordered.items[0]).toBe(b)
    expect(reconcileSnapshot(held, snapshot([item('a')])).items).toHaveLength(1)
    expect(reconcileSnapshot(held, snapshot([item('a'), item('b'), item('c')])).items).toHaveLength(3)
  })

  it('takes the fresh categories only when they differ', () => {
    const held = snapshot([item('a')])
    const same = reconcileSnapshot(held, { items: [item('a')], categories: [{ id: 'c1', name: 'MILK TEA' }] })
    expect(same.categories).toBe(held.categories)
    const renamed = reconcileSnapshot(held, { items: [item('a')], categories: [{ id: 'c1', name: 'MILKY' }] })
    expect(renamed.categories[0].name).toBe('MILKY')
    expect(renamed.items).toBe(held.items)
  })

  it('takes a first snapshot as it is', () => {
    const next = snapshot([item('a')])
    expect(reconcileSnapshot(null, next)).toBe(next)
  })
})
