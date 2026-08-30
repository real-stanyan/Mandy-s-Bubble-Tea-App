import { create } from 'zustand'
import { ApiError, TimeoutError, apiFetchWithTimeout } from '@/lib/api'

// History fans out to Square's order search + the full catalog server-side, so
// it is the slowest read the app makes — but a customer staring at a spinner
// gives up long before any honest request takes this long.
const HISTORY_TIMEOUT_MS = 15_000

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
  /** Scheduled pickup's chosen collection time (ISO), null/absent for ASAP. */
  scheduledPickupAt?: string | null
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

// Self-delivery orders are numbered DE### (vs OL### for pickup) — the DE
// prefix is the one delivery marker the history endpoint always carries.
export function isDeliveryOrder(
  order: Pick<OrderHistoryItem, 'referenceId'>,
): boolean {
  return (order.referenceId ?? '').toUpperCase().startsWith('DE')
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
        const historyRes = await apiFetchWithTimeout<{
          ok: boolean
          orders: OrderHistoryItem[]
        }>('/api/orders/history', HISTORY_TIMEOUT_MS)
        set(withActiveCount(historyRes.orders ?? []))
      } catch (e) {
        // A signed-out caller hitting /api/orders/history gets a 401 —
        // that's not a user-facing error, it's expected. Only surface
        // real failures.
        if (e instanceof ApiError && e.status === 401) {
          set({ ...withActiveCount([]), error: null })
        } else if (e instanceof TimeoutError) {
          // The screen renders this verbatim, so it's copy, not a stack
          // trace: the customer's move is to retry, not to read a message.
          set({ error: "Couldn't reach the server. Check your connection." })
        } else {
          set({ error: e instanceof Error ? e.message : 'Failed to load orders' })
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
