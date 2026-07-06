// Pure mapping + payload construction for the order Live Activity.
//
// Cross-platform contract (pinned; the web repo pushes the same shapes via
// APNs `aps.content-state`):
//   pickup  status: "preparing" | "ready" | "completed" | "canceled"
//   delivery status: "pending" | "accepted" | "picked_up" | "delivered" | "canceled"
//
// Status derivation mirrors lib/dispatch-steps.ts deriveDeliverySteps() —
// dispatch lifecycle first, Square fulfillment as fallback/terminal signal.

import { apiFetch } from '@/lib/api'
import type { DispatchStatus } from '@/lib/dispatch-steps'
import type { OrderActivityContentState } from '@/modules/order-live-activity'

export type PickupActivityStatus = 'preparing' | 'ready' | 'completed' | 'canceled'
export type DeliveryActivityStatus =
  | 'pending'
  | 'accepted'
  | 'picked_up'
  | 'delivered'
  | 'canceled'

export const PICKUP_TERMINAL: ReadonlySet<PickupActivityStatus> = new Set([
  'completed',
  'canceled',
])
export const DELIVERY_TERMINAL: ReadonlySet<DeliveryActivityStatus> = new Set([
  'delivered',
  'canceled',
])

/** Square fulfillment state → pickup activity status. */
export function pickupActivityStatus(
  fulfillmentState: string | null | undefined,
): PickupActivityStatus {
  switch (fulfillmentState) {
    case 'PREPARED':
      return 'ready'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELED':
    case 'FAILED':
      return 'canceled'
    default:
      // PROPOSED / RESERVED / unknown — still being made.
      return 'preparing'
  }
}

/** Square fulfillment + dispatch lifecycle → delivery activity status.
 *  Same precedence as deriveDeliverySteps(): COMPLETED/'delivered' win,
 *  CANCELED/FAILED cancel, and a PREPARED fulfillment recovers 'picked_up'
 *  when the dispatch row is missing/stale. */
export function deliveryActivityStatus(
  fulfillmentState: string | null | undefined,
  dispatchStatus: DispatchStatus | null | undefined,
): DeliveryActivityStatus {
  if (fulfillmentState === 'COMPLETED' || dispatchStatus === 'delivered') {
    return 'delivered'
  }
  if (fulfillmentState === 'CANCELED' || fulfillmentState === 'FAILED') {
    return 'canceled'
  }
  let effective: DispatchStatus | null = dispatchStatus ?? null
  if ((!effective || effective === 'pending') && fulfillmentState === 'PREPARED') {
    effective = 'picked_up'
  }
  return effective ?? 'pending'
}

/** Unix seconds for ContentState.updatedAt. Prefers the server's GPS
 *  timestamp; falls back to the local clock. */
export function contentUpdatedAt(
  locationUpdatedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (locationUpdatedAt) {
    const parsed = Date.parse(locationUpdatedAt)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }
  return Math.floor(nowMs / 1000)
}

export function buildPickupContentState(
  status: PickupActivityStatus,
  nowMs: number = Date.now(),
): OrderActivityContentState {
  return { status, updatedAt: Math.floor(nowMs / 1000) }
}

export function buildDeliveryContentState(params: {
  status: DeliveryActivityStatus
  driverName?: string | null
  driverLat?: number | null
  driverLng?: number | null
  locationUpdatedAt?: string | null
  nowMs?: number
}): OrderActivityContentState {
  const { status, driverName, driverLat, driverLng, locationUpdatedAt, nowMs } = params
  // Driver identity only once a driver exists; GPS only while it's live
  // (a delivered/canceled final frame shouldn't pin a stale dot).
  const hasDriver = status === 'accepted' || status === 'picked_up'
  return {
    status,
    driverName: hasDriver ? (driverName ?? null) : null,
    driverLat: status === 'picked_up' ? (driverLat ?? null) : null,
    driverLng: status === 'picked_up' ? (driverLng ?? null) : null,
    updatedAt: contentUpdatedAt(locationUpdatedAt, nowMs),
  }
}

/** Display order number for the card, e.g. "OL123"; falls back to the last
 *  3 digits of the order id (same fallback checkout.tsx uses for the pickup
 *  number). Strips any leading '#(s)' — the widget renders its own '#'. */
export function activityOrderNumber(
  referenceId: string | null | undefined,
  orderId: string,
): string {
  const ref = (referenceId ?? '').replace(/^#+/, '').trim()
  if (ref) return ref
  return orderId.slice(-3).replace(/\D/g, '').padStart(3, '0')
}

/** Uploads the activity's APNs push token so the server can drive the card.
 *  Same authenticated apiFetch pipeline as device-push-token registration. */
export async function uploadActivityToken(orderId: string, tokenHex: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/api/orders/${encodeURIComponent(orderId)}/live-activity-token`,
    {
      method: 'POST',
      body: JSON.stringify({ activityToken: tokenHex }),
    },
  )
}

/** Pickup wait estimate ("~8–12 min") for attributes.waitText. Resolves null
 *  on any failure — the card simply hides the wait pill. */
export async function fetchWaitText(orderId: string): Promise<string | null> {
  try {
    const data = await apiFetch<{ ok: boolean; text?: string }>(
      `/api/orders/${encodeURIComponent(orderId)}/wait`,
    )
    return data.ok && data.text ? data.text : null
  } catch {
    return null
  }
}
