import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiFetch } from '@/lib/api'

const PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId
const APP_VERSION = Constants.expoConfig?.version ?? null

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not-physical-device' | 'denied' | 'unsupported-platform' | 'error'; detail?: string }

export async function registerForPushAndUpload(): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, reason: 'unsupported-platform' }
  }
  if (!Device.isDevice) {
    return { ok: false, reason: 'not-physical-device' }
  }

  try {
    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    if (status !== 'granted') {
      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      })
      status = next.status
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' }

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      PROJECT_ID ? { projectId: PROJECT_ID } : undefined,
    )
    const token = tokenResp.data

    await apiFetch<{ ok: true }>('/api/device-push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'ios', appVersion: APP_VERSION }),
    })

    return { ok: true, token }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.warn('[push] registration failed:', detail)
    return { ok: false, reason: 'error', detail }
  }
}

export async function revokeCurrentPushToken(): Promise<void> {
  if (Platform.OS !== 'ios') return
  if (!Device.isDevice) return
  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      PROJECT_ID ? { projectId: PROJECT_ID } : undefined,
    )
    const token = tokenResp.data
    await apiFetch(`/api/device-push-token?token=${encodeURIComponent(token)}`, {
      method: 'DELETE',
    })
  } catch (err) {
    console.warn('[push] revoke failed:', err)
  }
}
