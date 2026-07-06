// JS surface of the OrderLiveActivity native module (iOS-only).
//
// Every function is a safe no-op (null/false) when the native module is
// unavailable — Android, web, Expo Go, jest — so callers don't need their
// own platform gates. iOS <16.2 no-ops inside the native module itself.

import { Platform } from 'react-native'
import { requireNativeModule } from 'expo-modules-core'

/** Mirrors MandysOrderAttributes (pinned cross-platform contract) minus
 *  mapImageFilename, which the native side fills after rendering. */
export type OrderActivityAttributes = {
  kind: 'pickup' | 'delivery'
  /** e.g. "OL123" / "DE045" (no leading '#'). */
  orderNumber: string
  waitText?: string | null
  storeLat?: number | null
  storeLng?: number | null
  destLat?: number | null
  destLng?: number | null
}

/** Mirrors MandysOrderAttributes.ContentState. */
export type OrderActivityContentState = {
  status: string
  driverName?: string | null
  driverLat?: number | null
  driverLng?: number | null
  /** Unix seconds. */
  updatedAt: number
}

export type OrderActivityPushTokenEvent = {
  orderId: string
  /** APNs liveactivity token, hex-encoded. */
  token: string
}

type Subscription = { remove: () => void }

type NativeOrderLiveActivity = {
  areLiveActivitiesEnabled(): boolean
  startOrderActivity(
    orderId: string,
    attributes: OrderActivityAttributes,
    initialState: OrderActivityContentState,
  ): Promise<string | null>
  updateOrderActivity(orderId: string, state: OrderActivityContentState): Promise<boolean>
  endOrderActivity(
    orderId: string,
    finalState: OrderActivityContentState | null,
    immediateDismissal: boolean,
  ): Promise<boolean>
  addListener(
    eventName: 'onOrderActivityPushToken',
    listener: (event: OrderActivityPushTokenEvent) => void,
  ): Subscription
}

let cached: NativeOrderLiveActivity | null | undefined

function native(): NativeOrderLiveActivity | null {
  if (cached !== undefined) return cached
  if (Platform.OS !== 'ios') {
    cached = null
    return cached
  }
  try {
    cached = requireNativeModule<NativeOrderLiveActivity>('OrderLiveActivity')
  } catch {
    // Not linked in this runtime (Expo Go / tests / older binaries).
    cached = null
  }
  return cached
}

export function areLiveActivitiesEnabled(): boolean {
  try {
    return native()?.areLiveActivitiesEnabled() ?? false
  } catch {
    return false
  }
}

/** Starts (or idempotently refreshes) the order's Live Activity.
 *  Resolves to the ActivityKit activity id, or null when unsupported. */
export async function startOrderActivity(
  orderId: string,
  attributes: OrderActivityAttributes,
  initialState: OrderActivityContentState,
): Promise<string | null> {
  const mod = native()
  if (!mod) return null
  return mod.startOrderActivity(orderId, attributes, initialState)
}

/** Resolves false when no live activity exists for the order. */
export async function updateOrderActivity(
  orderId: string,
  state: OrderActivityContentState,
): Promise<boolean> {
  const mod = native()
  if (!mod) return false
  return mod.updateOrderActivity(orderId, state)
}

/** Ends the activity with a final frame. `immediateDismissal` for canceled
 *  orders; delivered/completed linger with the system default policy. */
export async function endOrderActivity(
  orderId: string,
  finalState: OrderActivityContentState | null,
  options?: { immediateDismissal?: boolean },
): Promise<boolean> {
  const mod = native()
  if (!mod) return false
  return mod.endOrderActivity(orderId, finalState, options?.immediateDismissal ?? false)
}

/** Fires for every APNs liveactivity token emission, including rotations. */
export function addOrderActivityPushTokenListener(
  listener: (event: OrderActivityPushTokenEvent) => void,
): Subscription {
  const mod = native()
  if (!mod) return { remove: () => {} }
  return mod.addListener('onOrderActivityPushToken', listener)
}
