import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { MembershipTier } from '@/lib/membership-tier'

/**
 * Diamond only: how many free paid-topping units remain this month.
 * Mirrors the web checkout/account fetch of GET /api/tier/toppings.
 *
 * `remaining` is null while unknown (not diamond, in flight, or the
 * request failed) — consumers that need a number should `?? 0`, which
 * matches the spec's "failure → silently treat as 0" rule and never
 * blocks checkout.
 */
export function useTierToppings(tier: MembershipTier): { remaining: number | null } {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (tier !== 'diamond') {
      setRemaining(null)
      return
    }
    let cancelled = false
    apiFetch<{ ok: boolean; remaining?: number; limit?: number; monthKey?: string }>(
      '/api/tier/toppings',
    )
      .then((json) => {
        if (cancelled) return
        if (json.ok && typeof json.remaining === 'number') {
          setRemaining(json.remaining)
        } else {
          setRemaining(null)
        }
      })
      .catch(() => {
        // Best-effort decoration — never block checkout on this endpoint.
        // Stays null so the account card omits the toppings line (web
        // parity); checkout maps null → 0 for the discount math.
        if (!cancelled) setRemaining(null)
      })
    return () => {
      cancelled = true
    }
  }, [tier])

  return { remaining }
}
