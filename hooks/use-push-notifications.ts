import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { registerForPushAndUpload } from '@/lib/push-registration'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function handleResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return
  const data = response.notification.request.content.data as
    | { orderId?: string; kind?: string }
    | undefined
  if (data?.kind === 'ready' && data.orderId) {
    router.push(`/order-detail?id=${data.orderId}`)
  }
}

export function usePushNotifications() {
  const { profile } = useAuth()
  const hasRegistered = useRef(false)
  const cameFromColdStart = useRef(false)

  useEffect(() => {
    if (!profile || hasRegistered.current) return
    hasRegistered.current = true
    registerForPushAndUpload().then((result) => {
      if (!result.ok) console.log(`[push] skipped: ${result.reason}`)
    })
  }, [profile])

  useEffect(() => {
    // Cold-start tap: the initial response was fired before this listener
    // attached, so query it explicitly once. Use a ref so we don't reprocess
    // it on hot reloads / fast refresh.
    if (!cameFromColdStart.current) {
      cameFromColdStart.current = true
      Notifications.getLastNotificationResponseAsync()
        .then(handleResponse)
        .catch(() => {})
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse)
    return () => sub.remove()
  }, [])
}
