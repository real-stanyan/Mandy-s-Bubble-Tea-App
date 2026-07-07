// Status → Android order-card content (title / body / stepper position).
// Copy mirrors the iOS widget vocabulary (PickupCardView / DeliveryCardView)
// so the two platforms narrate the same journey. Pure — unit-testable
// without a native renderer.

import type {
  DeliveryActivityStatus,
  PickupActivityStatus,
} from '@/lib/live-activity'
import type { OrderCardParams } from '@/modules/order-status-card'

const PICKUP_STEPS = 3 // received → preparing → ready
const DELIVERY_STEPS = 4 // placed → accepted → picked up → delivered

/** null = the card should be removed (terminal, iOS immediate-dismissal
 *  contract). */
export function pickupCardParams(
  status: PickupActivityStatus,
  orderNumber: string | null,
): OrderCardParams | null {
  const base = { orderNumber, stepCount: PICKUP_STEPS, ongoing: true }
  switch (status) {
    case 'received':
      return {
        ...base,
        title: 'Order received!',
        body: "We've got your order — the shop will confirm it shortly.",
        stepIndex: 0,
      }
    case 'preparing':
      return {
        ...base,
        title: 'Making your drinks',
        body: 'Your order is being prepared right now.',
        stepIndex: 1,
      }
    case 'ready':
      return {
        ...base,
        title: 'Ready for pickup!',
        body: 'Show your order number at the counter.',
        stepIndex: 2,
      }
    case 'completed':
    case 'canceled':
      return null
  }
}

export function deliveryCardParams(
  status: DeliveryActivityStatus,
  orderNumber: string | null,
  driverName?: string | null,
): OrderCardParams | null {
  const driver = driverName?.trim() || 'Your driver'
  const base = { orderNumber, stepCount: DELIVERY_STEPS, ongoing: true }
  switch (status) {
    case 'pending':
      return {
        ...base,
        title: 'Order received!',
        body: 'Waiting for a driver to accept your order.',
        stepIndex: 0,
      }
    case 'accepted':
      return {
        ...base,
        title: 'Driver on it',
        body: `${driver} accepted your order and is heading to the store.`,
        stepIndex: 1,
      }
    case 'picked_up':
      return {
        ...base,
        title: 'Your order is on the way',
        body: `${driver} has your order and is riding to you.`,
        stepIndex: 2,
      }
    case 'delivered':
    case 'canceled':
      return null
  }
}
