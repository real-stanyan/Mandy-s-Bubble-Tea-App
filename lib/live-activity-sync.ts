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
  type DeliveryActivityStatus,
  type PickupActivityStatus,
} from '@/lib/live-activity'
import { hasUsableMapCoords } from '@/lib/live-activity-geo'
import { cancelOrderCard, upsertOrderCard } from '@/modules/order-status-card'
import { deliveryCardParams, pickupCardParams } from '@/lib/order-status-card'
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
// Android: ticket label captured at start so later card updates keep the
// subtext (the history/tracking payloads don't always carry it).
const orderNumbers = new Map<string, string>()

let initialized = false

const CARD_PLATFORMS = new Set(['ios', 'android'])

/** Idempotent bootstrap: token upload listener (iOS) + pickup/terminal sync
 *  from the orders store (both platforms). Called once from the root
 *  layout. On Android the "activity" is the ongoing order-status
 *  notification (modules/order-status-card) — same lifecycle, different
 *  renderer. */
export function initLiveActivities(): void {
  if (initialized || !CARD_PLATFORMS.has(Platform.OS)) return
  initialized = true
  if (Platform.OS === 'ios') {
    addOrderActivityPushTokenListener((event) => {
      void handleActivityPushToken(event)
    })
  }
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
  /** First drink's catalog name — picks the cartoon cup on the card. */
  drinkName?: string | null
  /** Distinct drink names in order (max 3) — 2/3 stack cups on the card. */
  drinkNames?: string[] | null
  /** Total cups when the order is one distinct drink — "×N" badge. */
  drinkQuantity?: number | null
}): Promise<void> {
  if (!CARD_PLATFORMS.has(Platform.OS)) return
  const {
    orderId,
    referenceId,
    fulfillmentType,
    destLat,
    destLng,
    drinkName,
    drinkNames,
    drinkQuantity,
  } = params
  if (Platform.OS === 'android') {
    try {
      const orderNumber = activityOrderNumber(referenceId, orderId)
      orderNumbers.set(orderId, orderNumber)
      const card =
        fulfillmentType === 'DELIVERY'
          ? deliveryCardParams('pending', orderNumber)
          : pickupCardParams('received', orderNumber)
      if (card && !upsertOrderCard(orderId, card)) {
        console.warn('[order-card] start returned false for order', orderId)
      }
      gone.delete(orderId)
      lastSyncKey.delete(orderId)
    } catch (err) {
      console.warn('[order-card] start failed for order', orderId, err)
    }
    return
  }
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
          drinkName,
          drinkNames,
          drinkQuantity,
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
        { kind: 'pickup', orderNumber, waitText, drinkName, drinkNames, drinkQuantity },
        // Contract initial state: the order is placed but staff haven't
        // accepted it yet — the server's RESERVED push flips it to
        // "preparing" (or straight to "ready" when the shop skips accept).
        buildPickupContentState('received'),
      )
    }
    if (activityId) {
      gone.delete(orderId)
      lastSyncKey.delete(orderId)
    } else {
      // null = bridge unavailable or ActivityKit refused (disabled in
      // Settings, activity-count limit, …). Worth a breadcrumb.
      console.warn('[live-activity] start returned null for order', orderId)
    }
  } catch (err) {
    // Live Activity is enhancement-only — checkout success never surfaces
    // an error because the lock-screen card couldn't start. But do leave a
    // breadcrumb: a silent catch here cost us a day of blind debugging.
    console.warn('[live-activity] start failed for order', orderId, err)
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
  if (!CARD_PLATFORMS.has(Platform.OS) || !orderId || gone.has(orderId)) return
  const status = deliveryActivityStatus(data.state, data.dispatchStatus)
  const content = buildDeliveryContentState({
    status,
    driverName: DRIVER_FIRST_NAME,
    driverLat: data.tracking?.driverLat,
    driverLng: data.tracking?.driverLng,
    locationUpdatedAt: data.tracking?.locationUpdatedAt,
  })
  // Android has no map on the card — keying on GPS would redraw the
  // notification every 5s for an identical stepper.
  const key =
    Platform.OS === 'android'
      ? syncKey('delivery', { ...content, driverLat: undefined, driverLng: undefined }, null)
      : syncKey('delivery', content, data.tracking?.locationUpdatedAt)
  if (lastSyncKey.get(orderId) === key) return
  await pushContent(orderId, 'delivery', content, DELIVERY_TERMINAL.has(status), key)
}

/** Pickup progress + terminal 兜底 for both kinds — fed by every orders-store
 *  refresh. Delivery non-terminal states are left to the tracking poll (the
 *  history payload has no dispatch/GPS granularity). */
export async function syncFromOrderHistory(orders: OrderHistoryItem[]): Promise<void> {
  if (!CARD_PLATFORMS.has(Platform.OS)) return
  for (const order of orders) {
    if (!order.id || gone.has(order.id)) continue
    if (!isRecentEnough(order)) continue
    if (Platform.OS === 'android' && order.referenceId && !orderNumbers.has(order.id)) {
      orderNumbers.set(order.id, activityOrderNumber(order.referenceId, order.id))
    }
    if (isDeliveryOrder(order)) {
      const status = deliveryActivityStatus(
        order.state === 'CANCELED' ? 'CANCELED' : order.fulfillmentState,
        null,
      )
      // iOS leaves non-terminal delivery to the 5s tracking poll (better
      // granularity); the Android card takes the coarse fulfillment-derived
      // status too so a backgrounded-then-reopened app still catches up.
      if (Platform.OS === 'ios' && !DELIVERY_TERMINAL.has(status)) continue
      const content = buildDeliveryContentState({ status, driverName: DRIVER_FIRST_NAME })
      const key = syncKey('delivery', content, null)
      if (lastSyncKey.get(order.id) === key) continue
      await pushContent(order.id, 'delivery', content, DELIVERY_TERMINAL.has(status), key)
    } else {
      const status =
        order.state === 'CANCELED' ? 'canceled' : pickupActivityStatus(order.fulfillmentState)
      const content = buildPickupContentState(status)
      const key = syncKey('pickup', content, null)
      if (lastSyncKey.get(order.id) === key) continue
      await pushContent(order.id, 'pickup', content, PICKUP_TERMINAL.has(status), key)
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
  kind: 'pickup' | 'delivery',
  content: OrderActivityContentState,
  terminal: boolean,
  key: string,
): Promise<void> {
  if (Platform.OS === 'android') {
    pushCardAndroid(orderId, kind, content, terminal, key)
    return
  }
  try {
    const found = terminal
      ? await endOrderActivity(orderId, content, {
          // Terminal orders (picked up / delivered / canceled) leave the Lock
          // Screen right away — product decision 2026-07-07 (was: canceled
          // only, others lingered on the system default policy).
          immediateDismissal: true,
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

/** Android renderer for the same lifecycle: ongoing notification while the
 *  order is live, removed instantly on terminal (mirrors iOS immediate
 *  dismissal). */
function pushCardAndroid(
  orderId: string,
  kind: 'pickup' | 'delivery',
  content: OrderActivityContentState,
  terminal: boolean,
  key: string,
): void {
  try {
    const orderNumber = orderNumbers.get(orderId) ?? null
    const params = terminal
      ? null
      : kind === 'pickup'
        ? pickupCardParams(content.status as PickupActivityStatus, orderNumber)
        : deliveryCardParams(
            content.status as DeliveryActivityStatus,
            orderNumber,
            content.driverName,
          )
    if (!params) {
      cancelOrderCard(orderId)
      gone.add(orderId)
      lastSyncKey.delete(orderId)
      orderNumbers.delete(orderId)
      return
    }
    upsertOrderCard(orderId, params)
    lastSyncKey.set(orderId, key)
  } catch {
    // Native hiccup — next store refresh retries.
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
  orderNumbers.clear()
  initialized = false
}
