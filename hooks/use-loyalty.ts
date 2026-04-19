import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/components/auth/AuthProvider'
import type { LoyaltyAccount, LoyaltyEvent } from '@/types/square'

interface LoyaltyData {
  account: LoyaltyAccount | null
  events: LoyaltyEvent[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Loyalty account + event history, scoped to the signed-in Supabase
// user. Identity is auth-derived — no phone param needed.
export function useLoyalty(): LoyaltyData {
  const { profile } = useAuth()
  const [events, setEvents] = useState<LoyaltyEvent[]>([])
  const [accountOverride, setAccountOverride] = useState<LoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLoyalty = useCallback(async () => {
    if (!profile) {
      setAccountOverride(null)
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const accData = await apiFetch<{
        ok: boolean
        account: LoyaltyAccount | null
      }>('/api/loyalty/account')
      setAccountOverride(accData.account ?? null)
      if (accData.account) {
        const evtData = await apiFetch<{ events: LoyaltyEvent[] }>(
          '/api/loyalty/events',
        )
        setEvents(evtData.events ?? [])
      } else {
        setEvents([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loyalty')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    fetchLoyalty()
  }, [fetchLoyalty])

  return { account: accountOverride, events, loading, error, refresh: fetchLoyalty }
}
