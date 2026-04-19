import type { OrderHistoryItem, OrderHistoryLine } from '@/store/orders'

// Signature carved from the existing useCartStore addItem. Kept local to
// this module so consumers don't have to import CartStore's internal
// types just to call reorder().
interface AddItemInput {
  id: string
  variationId: string
  name: string
  variationName?: string
  price: number
  imageUrl?: string
  modifiers: {
    id: string
    name: string
    listName: string
    priceCents: number
  }[]
}

type AddItem = (item: AddItemInput) => void
type ClearCart = () => void

function addItemLine(add: AddItem, line: OrderHistoryLine): void {
  const modPrice = line.modifiers.reduce(
    (sum, m) => sum + Number(m.priceCents || '0'),
    0,
  )
  const unitPrice = Number(line.basePriceCents || '0') + modPrice
  const item: AddItemInput = {
    id: line.itemId,
    variationId: line.variationId,
    name: line.name,
    variationName: line.variationName || undefined,
    price: unitPrice,
    imageUrl: line.imageUrl ?? undefined,
    modifiers: line.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      listName: m.listName,
      priceCents: Number(m.priceCents || '0'),
    })),
  }
  const qty = Math.max(1, line.quantity)
  for (let i = 0; i < qty; i++) add(item)
}

// Replays every line item from `order` into the cart and invokes the
// caller's navigation hook. Returns:
//   'ok'      → cart was replaced, caller should route to /checkout
//   'empty'   → none of the line items had a variationId (items pulled
//               from the catalog) — caller should show an alert
export function reorder(
  clearCart: ClearCart,
  addItem: AddItem,
  order: OrderHistoryItem,
): 'ok' | 'empty' {
  const usable = order.lineItems.filter((l) => l.variationId)
  if (usable.length === 0) return 'empty'
  clearCart()
  for (const line of usable) addItemLine(addItem, line)
  return 'ok'
}
