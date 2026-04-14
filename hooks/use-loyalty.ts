import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { LoyaltyAccount, LoyaltyEvent } from '@/types/square'

interface LoyaltyData {
  account: LoyaltyAccount | null
  events: LoyaltyEvent[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useLoyalty(phone: string | null): LoyaltyData {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [events, setEvents] = useState<LoyaltyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLoyalty = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    setError(null)
    try {
      const accData = await apiFetch<{ account: LoyaltyAccount | null }>(
        `/api/loyalty/account?phone=${encodeURIComponent(phone)}`
      )
      setAccount(accData.account)
      if (accData.account) {
        const evtData = await apiFetch<{ events: LoyaltyEvent[] }>(
          `/api/loyalty/events?accountId=${accData.account.id}`
        )
        setEvents(evtData.events)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loyalty')
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => {
    fetchLoyalty()
  }, [fetchLoyalty])

  return { account, events, loading, error, refresh: fetchLoyalty }
}
