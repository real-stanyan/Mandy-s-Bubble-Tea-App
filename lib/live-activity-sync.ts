// Live Activity lifecycle manager — the one place that talks to the
// OrderLiveActivity native bridge.
//
// Ownership model (matches the pinned cross-端 contract):
//   • START: the app starts the activity right after checkout succeeds.
//   • PUSH: the server drives the card via APNs liveactivity pushes once the
//     app uploads the per-activity token (handled here on every token
//     emission, including rotations).
//   • LOCAL SYNC (belt & braces while the app is foregrounded):
//       – delivery: the 5s tracking poll (use-delivery-tracking) feeds
//         syncDeliveryTracking() — full ContentState incl. rider GPS.
//       – pickup: the orders-store refresh feeds syncFromOrderHistory().
//       – terminal states end the activity locally as a fallback.
//
// The native side persists orderId → activity.id in the App Group, so after
// an app relaunch update/end still reach a lock-screen card started by a
// previous session; updates for unknown orders resolve false and are dropped.

import { Platform } from 'react-native'
import {
  addOrderActivityPushTokenListener,
  endOrderActivity,
  startOrderActivity,
  updateOrderActivity,
  type OrderActivityContentState,
  type OrderActivityPushTokenEvent,
} from '@/modules/order-live-activity'
import {
  activityOrderNumber,
  buildDeliveryContentState,
  buildPickupContentState,
  deliveryActivityStatus,
  DELIVERY_TERMINAL,
  fetchWaitText,
  pickupActivityStatus,
  PICKUP_TERMINAL,
  uploadActivityToken,
} from '@/lib/live-activity'
import { hasUsableMapCoords } from '@/lib/live-activity-geo'
import { DELIVERY_DRIVER, STORE_LAT, STORE_LNG } from '@/lib/delivery'
import type { DispatchStatus } from '@/lib/dispatch-steps'
import { isDeliveryOrder, isUnfinished, useOrdersStore, type OrderHistoryItem } from '@/store/orders'
import type { Tracking } from '@/components/delivery/TrackingMap'

const DRIVER_FIRST_NAME = DELIVERY_DRIVER.name.split(' ')[0] || DELIVERY_DRIVER.name

// Orders the native side told us it has no activity for — stop syncing them.
const gone = new Set<string>()
// Last uploaded token per order (rotation → different token → re-upload).
const uploadedTokens = new Map<string, string>()
// Wall-clock-free fingerprint of the last pushed content per order.
const lastSyncKey = new Map<string, string>()

let initialized = false

/** Idempotent bootstrap: token upload listener + pickup/terminal sync from
 *  the orders store. Called once from the root layout. */
export function initLiveActivities(): void {
  if (initialized || Platform.OS !== 'ios') return
  initialized = true
  addOrderActivityPushTokenListener((event) => {
    void handleActivityPushToken(event)
  })
  useOrdersStore.subscribe((s) => {
    void syncFromOrderHistory(s.orders)
  })
}

/** Exported for tests. Uploads the APNs liveactivity token; re-uploads on
 *  rotation, dedupes identical emissions, and leaves the slot dirty on
 *  failure so the next emission (or rotation) retries. */
export async function handleActivityPushToken(
  event: OrderActivityPushTokenEvent,
): Promise<void> {
  const { orderId, token } = event
  if (!orderId || !token) return
  if (uploadedTokens.get(orderId) === token) return
  try {
    await uploadActivityToken(orderId, token)
    uploadedTokens.set(orderId, token)
  } catch {
    // Server unreachable / auth hiccup — the activity still works locally;
    // the next token emission retries the upload.
  }
}

/** Starts the lock-screen activity for a just-placed order. Fire-and-forget
 *  from checkout — never throws. */
export async function startActivityForPlacedOrder(params: {
  orderId: string
  referenceId: string | null | undefined
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  destLat?: number | null
  destLng?: number | null
}): Promise<void> {
  if (Platform.OS !== 'ios') return
  const { orderId, referenceId, fulfillmentType, destLat, destLng } = params
  try {
    const orderNumber = activityOrderNumber(referenceId, orderId)
    let activityId: string | null
    if (fulfillmentType === 'DELIVERY') {
      const mappable = hasUsableMapCoords(STORE_LAT, STORE_LNG, destLat, destLng)
      activityId = await startOrderActivity(
        orderId,
        {
          kind: 'delivery',
          orderNumber,
          // Coordinates power the S5 map (native snapshot + widget pin
          // projection); withheld when unusable so the widget stays on the
          // honest stepper layout.
          storeLat: mappable ? STORE_LAT : null,
          storeLng: mappable ? STORE_LNG : null,
          destLat: mappable ? destLat : null,
          destLng: mappable ? destLng : null,
        },
        buildDeliveryContentState({ status: 'pending' }),
      )
    } else {
      const waitText = await fetchWaitText(orderId)
      activityId = await startOrderActivity(
        orderId,
        { kind: 'pickup', orderNumber, waitText },
        buildPickupContentState('preparing'),
      )
    }
    if (activityId) {
      gone.delete(orderId)
      lastSyncKey.delete(orderId)
    }
  } catch {
    // Live Activity is enhancement-only — checkout success never surfaces
    // an error because the lock-screen card couldn't start.
  }
}

/** Delivery fine-grained sync — fed by the 5s tracking poll. */
export async function syncDeliveryTracking(
  orderId: string,
  data: {
    state: string | null
    dispatchStatus: DispatchStatus | null
    tracking: Tracking | null
  },
): Promise<void> {
  if (Platform.OS !== 'ios' || !orderId || gone.has(orderId)) return
  const status = deliveryActivityStatus(data.state, data.dispatchStatus)
  const content = buildDeliveryContentState({
    status,
    driverName: DRIVER_FIRST_NAME,
    driverLat: data.tracking?.driverLat,
    driverLng: data.tracking?.driverLng,
    locationUpdatedAt: data.tracking?.locationUpdatedAt,
  })
  const key = syncKey('delivery', content, data.tracking?.locationUpdatedAt)
  if (lastSyncKey.get(orderId) === key) return
  await pushContent(orderId, content, DELIVERY_TERMINAL.has(status), key)
}

/** Pickup progress + terminal 兜底 for both kinds — fed by every orders-store
 *  refresh. Delivery non-terminal states are left to the tracking poll (the
 *  history payload has no dispatch/GPS granularity). */
export async function syncFromOrderHistory(orders: OrderHistoryItem[]): Promise<void> {
  if (Platform.OS !== 'ios') return
  for (const order of orders) {
    if (!order.id || gone.has(order.id)) continue
    if (!isRecentEnough(order)) continue
    if (isDeliveryOrder(order)) {
      const status = deliveryActivityStatus(
        order.state === 'CANCELED' ? 'CANCELED' : order.fulfillmentState,
        null,
      )
      if (!DELIVERY_TERMINAL.has(status)) continue
      const content = buildDeliveryContentState({ status, driverName: DRIVER_FIRST_NAME })
      const key = syncKey('delivery', content, null)
      if (lastSyncKey.get(order.id) === key) continue
      await pushContent(order.id, content, true, key)
    } else {
      const status =
        order.state === 'CANCELED' ? 'canceled' : pickupActivityStatus(order.fulfillmentState)
      const content = buildPickupContentState(status)
      const key = syncKey('pickup', content, null)
      if (lastSyncKey.get(order.id) === key) continue
      await pushContent(order.id, content, PICKUP_TERMINAL.has(status), key)
    }
  }
}

// ---------- internals ----------

function syncKey(
  kind: string,
  content: OrderActivityContentState,
  locationUpdatedAt: string | null | undefined,
): string {
  // updatedAt is wall-clock derived — fingerprint on the inputs instead so
  // an unchanged poll doesn't re-push every 5s.
  return JSON.stringify([
    kind,
    content.status,
    content.driverName ?? null,
    content.driverLat ?? null,
    content.driverLng ?? null,
    locationUpdatedAt ?? null,
  ])
}

async function pushContent(
  orderId: string,
  content: OrderActivityContentState,
  terminal: boolean,
  key: string,
): Promise<void> {
  try {
    const found = terminal
      ? await endOrderActivity(orderId, content, {
          immediateDismissal: content.status === 'canceled',
        })
      : await updateOrderActivity(orderId, content)
    if (!found || terminal) {
      gone.add(orderId)
      uploadedTokens.delete(orderId)
      lastSyncKey.delete(orderId)
    } else {
      lastSyncKey.set(orderId, key)
    }
  } catch {
    // Native hiccup — next poll retries.
  }
}

/** Only touch native for orders that could plausibly still have a live
 *  card: unfinished, or turned terminal within the last few hours. */
function isRecentEnough(order: OrderHistoryItem): boolean {
  if (isUnfinished(order)) return true
  const ts = Date.parse(order.updatedAt ?? order.createdAt ?? '')
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < 6 * 60 * 60 * 1000
}

/** Test hook — clears module-level state between cases. */
export function _resetLiveActivitySyncForTests(): void {
  gone.clear()
  uploadedTokens.clear()
  lastSyncKey.clear()
  initialized = false
}
