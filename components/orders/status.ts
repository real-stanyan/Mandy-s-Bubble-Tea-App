import type { TimelineStatus } from '@/components/orders/StatusTimeline'
import { effectiveOrderState, type OrderHistoryItem } from '@/store/orders'

// The three-step story a pickup order tells (received → preparing → ready),
// shared by the My Orders tab and the Home tile so the two never disagree.
// A just-placed order (PROPOSED) is only "Received" — Preparing starts when
// staff accept it (RESERVED). Mirrors the lock-screen card's contract.
export function timelineStatusFor(order: Pick<OrderHistoryItem, 'state' | 'fulfillmentState'>): TimelineStatus {
  const eff = effectiveOrderState(order.state, order.fulfillmentState)
  if (eff === 'READY') return 'READY'
  if (eff === 'OPEN') return order.fulfillmentState === 'RESERVED' ? 'PREPARING' : 'OPEN'
  return 'OPEN'
}
