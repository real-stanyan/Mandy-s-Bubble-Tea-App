import { useMemo } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useOrdersStore, type OrderHistoryItem } from '@/store/orders'

export type OrderEventState = 'PLACED' | 'READY' | 'COMPLETED'

export type InboxEntry =
  | {
      kind: 'order'
      orderId: string
      referenceId: string | null
      timestamp: string
      state: OrderEventState
      totalCents: string
      firstItemName: string
      lineCount: number
    }
  | {
      kind: 'promo'
      promoId: 'welcome-discount'
      percentage: number
      drinksRemaining: number
    }

function deriveOrderState(o: OrderHistoryItem): OrderEventState | null {
  if (o.state === 'OPEN' && o.fulfillmentState === 'PREPARED') return 'READY'
  if (o.state === 'OPEN') return 'PLACED'
  if (o.state === 'COMPLETED') return 'COMPLETED'
  return null
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function useMessageEvents(): {
  entries: InboxEntry[]
  promo: Extract<InboxEntry, { kind: 'promo' }> | null
  orderEntries: Extract<InboxEntry, { kind: 'order' }>[]
  hasTodayEvent: boolean
} {
  const { welcomeDiscount } = useAuth()
  const orders = useOrdersStore((s) => s.orders)

  return useMemo(() => {
    const orderEntries: Extract<InboxEntry, { kind: 'order' }>[] = []

    for (const o of orders) {
      const state = deriveOrderState(o)
      if (!state) continue
      const timestamp = o.updatedAt ?? o.createdAt
      if (!timestamp) continue
      orderEntries.push({
        kind: 'order',
        orderId: o.id,
        referenceId: o.referenceId,
        timestamp,
        state,
        totalCents: o.totalCents,
        firstItemName: o.firstItemName,
        lineCount: o.lineCount,
      })
    }

    orderEntries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

    const promo: Extract<InboxEntry, { kind: 'promo' }> | null =
      welcomeDiscount.available
        ? {
            kind: 'promo',
            promoId: 'welcome-discount',
            percentage: welcomeDiscount.percentage,
            drinksRemaining: welcomeDiscount.drinksRemaining,
          }
        : null

    const entries: InboxEntry[] = promo ? [promo, ...orderEntries] : orderEntries
    const hasTodayEvent = orderEntries.some((e) => isToday(e.timestamp))

    return { entries, promo, orderEntries, hasTodayEvent }
  }, [orders, welcomeDiscount])
}
