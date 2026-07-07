// Android background refresh for the ongoing order-status card.
//
// The server sends DATA-ONLY Expo pushes (no title/body) to Android devices
// at every order transition. Data messages don't display anything by
// themselves — instead expo-notifications wakes this headless task (app
// backgrounded or killed) and we redraw / remove the ongoing card, exactly
// like an APNs liveactivity push updates the iOS Lock Screen.
//
// Payload contract (server: src/lib/order-card-push.ts on the web repo):
//   { type: 'order-card', orderId, orderNumber?, fulfillment: 'pickup'|'delivery',
//     status: PickupActivityStatus|DeliveryActivityStatus, driverName? }

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import {
  DELIVERY_TERMINAL,
  PICKUP_TERMINAL,
  type DeliveryActivityStatus,
  type PickupActivityStatus,
} from '@/lib/live-activity'
import { deliveryCardParams, pickupCardParams } from '@/lib/order-status-card'
import { cancelOrderCard, upsertOrderCard } from '@/modules/order-status-card'

const TASK_NAME = 'mandys-order-card-push'

type OrderCardPushData = {
  type?: string
  orderId?: string
  orderNumber?: string
  fulfillment?: string
  status?: string
  driverName?: string
}

/** Exported for tests. Applies one push payload to the notification card. */
export function applyOrderCardPush(data: OrderCardPushData): void {
  if (data.type !== 'order-card' || !data.orderId || !data.status) return
  const orderNumber = data.orderNumber ?? null
  if (data.fulfillment === 'delivery') {
    const status = data.status as DeliveryActivityStatus
    const params = DELIVERY_TERMINAL.has(status)
      ? null
      : deliveryCardParams(status, orderNumber, data.driverName)
    if (params) upsertOrderCard(data.orderId, params)
    else cancelOrderCard(data.orderId)
  } else {
    const status = data.status as PickupActivityStatus
    const params = PICKUP_TERMINAL.has(status)
      ? null
      : pickupCardParams(status, orderNumber)
    if (params) upsertOrderCard(data.orderId, params)
    else cancelOrderCard(data.orderId)
  }
}

/** The FCM data payload arrives in a couple of shapes depending on app
 *  state; dig the order-card object out of whichever one we got. */
export function extractPushData(raw: unknown): OrderCardPushData | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.type === 'order-card') return obj as OrderCardPushData
  // Killed-state delivery wraps the data map; the JSON payload sits under
  // `body` as a string.
  const body = obj.body
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as OrderCardPushData
      if (parsed?.type === 'order-card') return parsed
    } catch {
      /* not ours */
    }
  }
  if (typeof obj.data === 'object' && obj.data) return extractPushData(obj.data)
  return null
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error || Platform.OS !== 'android') return
  const payload = extractPushData(data)
  if (payload) applyOrderCardPush(payload)
})

let registered = false

/** Idempotent — called once from the root layout alongside
 *  initLiveActivities(). */
export function registerOrderCardBackgroundTask(): void {
  if (registered || Platform.OS !== 'android') return
  registered = true
  Notifications.registerTaskAsync(TASK_NAME).catch((err) => {
    console.warn('[order-card] background task registration failed:', err)
  })
}
