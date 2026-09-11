import { deepEqual } from '@/lib/deep-equal'
import type { CatalogCategory, CatalogItem } from '@/types/square'

// The catalog is refetched a few seconds after any screen that reads it
// mounts (hooks/use-menu's TTL is short on purpose, so a sold-out flag set
// in the Square dashboard shows within seconds). Every refetch used to hand
// every subscriber a new array of new objects, and the whole Home page and
// every mounted menu card re-rendered for a catalog that had not changed.
// This folds a fresh snapshot onto the held one: an item the server sent
// unchanged keeps its object, a list of unchanged items keeps its array,
// and a snapshot with nothing new at all is the held snapshot itself.

export type MenuSnapshot = {
  items: CatalogItem[]
  categories: CatalogCategory[]
}

export function reconcileSnapshot(held: MenuSnapshot | null, next: MenuSnapshot): MenuSnapshot {
  if (!held) return next
  const heldById = new Map<string, CatalogItem>()
  for (const item of held.items) heldById.set(item.id, item)
  let itemsChanged = held.items.length !== next.items.length
  const items = next.items.map((item, i) => {
    const old = heldById.get(item.id)
    if (old && deepEqual(old, item)) {
      if (held.items[i] !== old) itemsChanged = true
      return old
    }
    itemsChanged = true
    return item
  })
  const categories = deepEqual(held.categories, next.categories) ? held.categories : next.categories
  if (!itemsChanged && categories === held.categories) return held
  return { items: itemsChanged ? items : held.items, categories }
}
