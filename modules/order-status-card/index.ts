import { Platform } from 'react-native'
import { requireNativeModule } from 'expo-modules-core'

// Android-only native bridge: one ongoing notification per active order,
// the platform counterpart of the iOS Live Activity (see
// modules/order-live-activity). No-ops everywhere else so callers can be
// platform-agnostic.

export interface OrderCardParams {
  title: string
  body: string
  orderNumber?: string | null
  /** 0-based current step. */
  stepIndex: number
  /** Total steps (pickup 3, delivery 4). */
  stepCount: number
  /** false renders a dismissible final card instead of an ongoing one. */
  ongoing: boolean
}

interface NativeModuleShape {
  upsert(orderId: string, params: OrderCardParams): void
  cancel(orderId: string): void
}

function nativeModule(): NativeModuleShape | null {
  if (Platform.OS !== 'android') return null
  try {
    return requireNativeModule<NativeModuleShape>('OrderStatusCard')
  } catch {
    // Expo Go / bridge unavailable — behave like iOS's null activity path.
    return null
  }
}

export function upsertOrderCard(orderId: string, params: OrderCardParams): boolean {
  const mod = nativeModule()
  if (!mod) return false
  mod.upsert(orderId, params)
  return true
}

export function cancelOrderCard(orderId: string): boolean {
  const mod = nativeModule()
  if (!mod) return false
  mod.cancel(orderId)
  return true
}
