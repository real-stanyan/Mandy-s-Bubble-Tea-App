import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { KitchenLoad } from '@/lib/kitchen-load'

// The live ASAP estimate from /api/store-status, polled every 30s while the
// checkout is open — the same cadence as the web checkout, and the server
// caches the Square search for 30s, so this costs nothing extra.
//
// undefined → not polled yet; null → the server couldn't measure the queue.
// Both render as KITCHEN_LOAD_FALLBACK. A network error keeps the
// last-known value rather than flashing the fallback mid-session.
export function useKitchenLoad(): KitchenLoad | null | undefined {
  const [load, setLoad] = useState<KitchenLoad | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    async function pull() {
      try {
        const data = await apiFetch<{ kitchen?: KitchenLoad | null }>('/api/store-status')
        if (!cancelled) setLoad(data.kitchen ?? null)
      } catch {
        /* keep last-known value */
      }
    }
    pull()
    const id = setInterval(pull, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
  return load
}
