// Derives the customer-facing delivery status UI (heading / body / 4-step
// stepper position / tone) from the raw order signals. Semantics are aligned
// with the web repo's src/lib/order-status-ui.ts deriveStatusUi(), scoped to
// delivery orders only (pickup keeps the existing StatusTimeline path).
//
// Delivery progress is driven by the delivery_dispatch lifecycle (pending →
// accepted → picked_up → delivered), NOT the Square fulfillment state: a
// self-delivery order's fulfillment stays PROPOSED from checkout all the way
// through driver-accept (it only flips to PREPARED on pickup), so the
// fulfillment state alone cannot distinguish "waiting for a driver to accept"
// from "a driver took the job". The dispatch status can — so we read that,
// with a fulfillment-derived fallback when the dispatch row is missing/stale.

export type DispatchStatus = 'pending' | 'accepted' | 'picked_up' | 'delivered'

export type DeliveryTone = 'amber' | 'green'

// Milestones the customer waits on: 0) checkout succeeded, 1) a driver
// accepts, 2) they collect the order, 3) it's delivered.
export const DELIVERY_STEPS = ['Placed', 'Accepted', 'Picked up', 'Delivered'] as const

export type DeliveryStepsUi = {
  kind: 'active' | 'completed' | 'canceled'
  heading: string
  body: string
  tone: DeliveryTone
  // Index of the current (highest reached) step, 0-3. Steps below it render
  // as done; when kind === 'completed' every step including the last is done.
  stepIndex: 0 | 1 | 2 | 3
  // Chip copy for the list-card status pill (freshness chip takes over once
  // the driver is live, so picked_up's label is a fallback).
  pillLabel: string
}

// Per-node visual state for the 4-step stepper (DeliveryTimeline). Pure so it
// can be unit-tested without a native renderer: `done` nodes show a check,
// the `active` node shows the glow + core dot, `barLit` fills the connector
// LEFT of node i+1. When completed (S7) every node and bar is lit.
export function stepVisual(
  i: number,
  stepIndex: number,
  completed: boolean,
): { done: boolean; active: boolean; barLit: boolean } {
  return {
    done: completed ? true : i < stepIndex,
    active: i === stepIndex,
    barLit: completed ? true : i < stepIndex,
  }
}

export function deriveDeliverySteps({
  state,
  dispatchStatus = null,
  driverName,
}: {
  // Square fulfillment state as returned by /api/orders/[id]/status
  // (PROPOSED | RESERVED | PREPARED | COMPLETED | CANCELED | FAILED) — or the
  // order history's fulfillmentState before the first poll resolves.
  state: string | null
  dispatchStatus?: DispatchStatus | null
  // First name shown in the "accepted" body. Falls back to generic copy.
  driverName?: string | null
}): DeliveryStepsUi {
  // Terminal states. Square's COMPLETED is authoritative; we also honour a
  // dispatch 'delivered' in case the dispatch row leads the fulfillment write.
  if (state === 'COMPLETED' || dispatchStatus === 'delivered') {
    return {
      kind: 'completed',
      heading: 'Delivered',
      body: 'Enjoy your drink 🧋',
      tone: 'green',
      stepIndex: 3,
      pillLabel: 'Delivered',
    }
  }

  if (state === 'CANCELED' || state === 'FAILED') {
    return {
      kind: 'canceled',
      heading: 'Order Canceled',
      body: 'This order was canceled. If you were charged, please contact the store.',
      tone: 'amber',
      stepIndex: 0,
      pillLabel: 'Canceled',
    }
  }

  // Fall back to deriving from the fulfillment when the dispatch row is
  // missing/stale: a PREPARED fulfillment means the driver has already picked
  // up (accept never moves the fulfillment, so we can only recover pickup).
  let effective = dispatchStatus
  if ((!effective || effective === 'pending') && state === 'PREPARED') {
    effective = 'picked_up'
  }

  switch (effective) {
    case 'picked_up':
      return {
        kind: 'active',
        heading: 'Out for Delivery!',
        body: 'Your driver has your order and is on the way to your address.',
        tone: 'green',
        stepIndex: 2,
        pillLabel: 'Live',
      }
    case 'accepted':
      return {
        kind: 'active',
        heading: 'Driver on the way',
        body: `${driverName || 'Your driver'} is heading to the shop to collect your order.`,
        tone: 'amber',
        stepIndex: 1,
        pillLabel: 'Driver assigned',
      }
    case 'pending':
    default:
      // The order is placed (first node lit); we're now matching a driver.
      return {
        kind: 'active',
        heading: 'Finding your driver',
        body: "We're matching a nearby driver — this usually takes a couple of minutes.",
        tone: 'amber',
        stepIndex: 0,
        pillLabel: 'Finding driver',
      }
  }
}
