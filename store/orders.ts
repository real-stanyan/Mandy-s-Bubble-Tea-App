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
export function isUnfinished(order: Pick<OrderHistoryItem, 'state'>): boolean {
  return order.state === 'OPEN'
}

interface OrdersState {
  orders: OrderHistoryItem[]
  phone: string | null
  customerId: string | null
  loading: boolean
  error: string | null
  refresh: (phone?: string | null) => Promise<void>
  clear: () => void
}

// De-duplicate concurrent refreshes: two screens can both fire one on
// focus (order-detail + account tab). Without this, duplicate in-flight
// requests fight for `loading` and leave navigation briefly janky when
// popping back. Tracked outside state to avoid re-render on assign.
let inFlight: Promise<void> | null = null

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  phone: null,
  customerId: null,
  loading: false,
  error: null,

  refresh: (phoneArg) => {
    const nextPhone = phoneArg === undefined ? get().phone : phoneArg
    if (phoneArg !== undefined && phoneArg !== get().phone) {
      set({ phone: phoneArg, customerId: null })
    }
    if (!nextPhone) {
      set({ orders: [], customerId: null, error: null })
      return Promise.resolve()
    }
    if (inFlight) return inFlight
    set({ loading: true, error: null })
    inFlight = (async () => {
      try {
        const customerRes = await apiFetch<{
          ok: boolean
          found: boolean
          customerId?: string
        }>('/api/customer/lookup', {
          method: 'POST',
          body: JSON.stringify({ phone: nextPhone }),
        })
        if (!customerRes.found || !customerRes.customerId) {
          set({ orders: [], customerId: null })
          return
        }
        set({ customerId: customerRes.customerId })
        const historyRes = await apiFetch<{
          ok: boolean
          orders: OrderHistoryItem[]
        }>('/api/orders/history', {
          method: 'POST',
          body: JSON.stringify({ customerId: customerRes.customerId }),
        })
        set({ orders: historyRes.orders ?? [] })
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'Failed to load orders' })
      } finally {
        set({ loading: false })
        inFlight = null
      }
    })()
    return inFlight
  },

  clear: () => set({ orders: [], phone: null, customerId: null, error: null }),
}))
