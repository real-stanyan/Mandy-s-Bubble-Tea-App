import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { apiFetch } from '@/lib/api'
import type { DispatchStatus } from '@/lib/dispatch-steps'
import type { Tracking } from '@/components/delivery/TrackingMap'

type StatusResponse = {
  ok: boolean
  state: string | null
  // Dispatch lifecycle, returned for everyone (not PII) — drives the 4-step
  // delivery stepper. `tracking` stays owner-gated + PREPARED-gated server-side.
  dispatchStatus?: DispatchStatus | null
  tracking: Tracking | null
}

const POLL_MS = 5000

export function useDeliveryTracking(
  orderId: string,
  active: boolean,
  pollMs: number = POLL_MS,
) {
  const [state, setState] = useState<string | null>(null)
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus | null>(null)
  const [tracking, setTracking] = useState<Tracking | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !orderId) {
      // Reset when polling stops (order went terminal / card lost the live
      // slot). Without this the last non-null tracking survives the cleanup
      // and downstream "out for delivery?" checks race the orders-store
      // refresh — a delivered order could stay stuck on the full-screen map.
      setState(null)
      setDispatchStatus(null)
      setTracking(null)
      return
    }
    let cancelled = false
    const poll = async () => {
      try {
        const data = await apiFetch<StatusResponse>(`/api/orders/${orderId}/status`)
        if (cancelled) return
        setState(data.state)
        setDispatchStatus(data.dispatchStatus ?? null)
        setTracking(data.tracking)
      } catch {
        /* keep last known; next tick retries */
      }
    }
    poll()
    timer.current = setInterval(poll, pollMs)
    // iOS suspends JS timers in the background, so a customer who locks their
    // phone while waiting comes back to a minutes-stale position. Refetch the
    // moment the app is foregrounded so the map recovers immediately instead
    // of waiting for the next (possibly long-throttled) tick. Mirrors the
    // web card's visibilitychange/focus/online wake handlers.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') poll()
    })
    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
      sub.remove()
    }
  }, [orderId, active, pollMs])

  return { state, dispatchStatus, tracking }
}
