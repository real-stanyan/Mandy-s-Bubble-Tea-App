import type { CartItem } from '@/types/square'

// The cart, in the wire shape `/api/orders` and `/api/orders/quote` both take.
//
// Shared because the quote is only worth trusting if it prices the SAME lines
// the create call will send. `variationPriceCents` is the base price with
// modifier upcharges backed out — CartItem.price bundles them together, the
// server wants them apart. (The server re-prices everything from the Square
// catalog anyway; these numbers only matter as a fallback when its menu cache
// is down.)

export type OrderLine = {
  itemName: string
  variationId: string
  variationName?: string
  variationPriceCents: number
  modifiers: { id: string; name?: string; priceCents: number }[]
  quantity: number
}

export function buildOrderLines(items: CartItem[]): OrderLine[] {
  return items.map((item) => {
    const modifierTotal = (item.modifiers ?? []).reduce(
      (sum, m) => sum + (m.priceCents ?? 0),
      0,
    )
    return {
      itemName: item.name,
      variationId: item.variationId,
      variationName: item.variationName,
      variationPriceCents: Math.max(0, item.price - modifierTotal),
      modifiers: (item.modifiers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        priceCents: m.priceCents ?? 0,
      })),
      quantity: item.quantity,
    }
  })
}
