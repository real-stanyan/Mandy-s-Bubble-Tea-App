import { useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { useOrdersStore } from '@/store/orders'

// Buzz the phone once when any order transitions to READY
// (state=OPEN + fulfillmentState=PREPARED). Seeds on first load so
// pre-existing READY orders don't trigger a retroactive buzz on app
// launch. Works while the app is in foreground on any tab — Haptics
// needs no permissions or native rebuild.
export function useReadyVibration() {
  const readySeen = useRef<Set<string>>(new Set())
  const seeded = useRef(false)

  useEffect(() => {
    return useOrdersStore.subscribe((state) => {
      const currentReadyIds = state.orders
        .filter((o) => o.state === 'OPEN' && o.fulfillmentState === 'PREPARED')
        .map((o) => o.id)

      if (!seeded.current) {
        if (state.orders.length > 0) {
          readySeen.current = new Set(currentReadyIds)
          seeded.current = true
        }
        return
      }

      for (const id of currentReadyIds) {
        if (!readySeen.current.has(id)) {
          readySeen.current.add(id)
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {})
        }
      }
    })
  }, [])
}
