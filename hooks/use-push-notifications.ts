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

export function usePushNotifications() {
  const { profile } = useAuth()
  const hasRegistered = useRef(false)

  useEffect(() => {
    if (!profile || hasRegistered.current) return
    hasRegistered.current = true
    registerForPushAndUpload().then((result) => {
      if (!result.ok) console.log(`[push] skipped: ${result.reason}`)
    })
  }, [profile])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { orderId?: string; kind?: string }
        | undefined
      if (data?.kind === 'ready' && data.orderId) {
        router.push(`/order-detail?id=${data.orderId}`)
      }
    })
    return () => sub.remove()
  }, [])
}
