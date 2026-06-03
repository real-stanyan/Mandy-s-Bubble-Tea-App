import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { Tracking } from '@/components/delivery/TrackingMap'

type StatusResponse = { ok: boolean; state: string | null; tracking: Tracking | null }

const POLL_MS = 5000

export function useDeliveryTracking(orderId: string, active: boolean) {
  const [state, setState] = useState<string | null>(null)
  const [tracking, setTracking] = useState<Tracking | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !orderId) return
    let cancelled = false
    const poll = async () => {
      try {
        const data = await apiFetch<StatusResponse>(`/api/orders/${orderId}/status`)
        if (cancelled) return
        setState(data.state)
        setTracking(data.tracking)
      } catch {
        /* keep last known; next tick retries */
      }
    }
    poll()
    timer.current = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
    }
  }, [orderId, active])

  return { state, tracking }
}
