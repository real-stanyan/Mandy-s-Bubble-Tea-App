import { create } from 'zustand'
import { apiFetch } from '@/lib/api'

export interface OrderHistoryLineModifier {
  id: string
  name: string
  listName: string
  priceCents: string
}

export interface OrderHistoryLine {
  variationId: string
  itemId: string
  imageUrl: string | null
  name: string
  variationName: string
  quantity: number
  basePriceCents: string
  modifiers: OrderHistoryLineModifier[]
}

export interface OrderHistoryItem {
  id: string
  referenceId: string | null
  createdAt: string | null
  updatedAt: string | null
  state: string | null
  fulfillmentState: string | null
  totalCents: string
  itemSummary: string
  lineCount: number
  firstItemName: string
  firstItemImageUrl: string | null
  lineItems: OrderHistoryLine[]
}

// Unfinished = Square order still OPEN (covers both IN PROGRESS and READY,
// since "READY" is OPEN + fulfillmentState=PREPARED). COMPLETED and CANCELED
// are terminal states that belong in Past Orders.
// Self-delivery caveat: the driver app completes the *fulfillment*
// (COMPLETED) but the Square order itself stays OPEN until staff close the
// ticket in POS — so a COMPLETED fulfillment counts as finished too.
export function isUnfinished(
  order: Pick<OrderHistoryItem, 'state' | 'fulfillmentState'>,
): boolean {
  return order.state === 'OPEN' && order.fulfillmentState !== 'COMPLETED'
}

// Single source of truth for the customer-visible order state. Square keeps
// order.state OPEN while staff (or the driver app) advance the fulfillment,
// so the lifecycle the customer cares about lives on the fulfillment:
//   OPEN + PREPARED  → READY     (at the counter / out for delivery)
//   OPEN + COMPLETED → COMPLETED (picked up / delivered, ticket not yet
//                                 closed in POS)
export function effectiveOrderState(
  state: string | null,
  fulfillmentState: string | null,
): string {
  if (state === 'OPEN' && fulfillmentState === 'COMPLETED') return 'COMPLETED'
  if (state === 'OPEN' && fulfillmentState === 'PREPARED') return 'READY'
  return state ?? ''
}

interface OrdersState {
  orders: OrderHistoryItem[]
  // Cached count of unfinished orders (state === 'OPEN'). Derived fields
  // live on state so subscribers (tab badge, etc.) don't have to filter
  // on every render — zustand skips re-render when the scalar is stable.
  activeOrderCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  clear: () => void
}

function withActiveCount(orders: OrderHistoryItem[]) {
  return { orders, activeOrderCount: orders.filter(isUnfinished).length }
}

// De-duplicate concurrent refreshes: two screens can both fire one on
// focus (order-detail + account tab). Without this, duplicate in-flight
// requests fight for `loading` and leave navigation briefly janky when
// popping back. Tracked outside state to avoid re-render on assign.
let inFlight: Promise<void> | null = null

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  activeOrderCount: 0,
  loading: false,
  error: null,

  refresh: () => {
    if (inFlight) return inFlight
    set({ loading: true, error: null })
    inFlight = (async () => {
      try {
        const historyRes = await apiFetch<{
          ok: boolean
          orders: OrderHistoryItem[]
        }>('/api/orders/history')
        set(withActiveCount(historyRes.orders ?? []))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load orders'
        // A signed-out caller hitting /api/orders/history gets a 401 —
        // that's not a user-facing error, it's expected. Only surface
        // real failures.
        if (msg.includes('401')) {
          set({ ...withActiveCount([]), error: null })
        } else {
          set({ error: msg })
        }
      } finally {
        set({ loading: false })
        inFlight = null
      }
    })()
    return inFlight
  },

  clear: () =>
    set({
      ...withActiveCount([]),
      error: null,
    }),
}))
