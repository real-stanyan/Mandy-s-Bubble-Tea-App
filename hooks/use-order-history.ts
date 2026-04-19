import { useCallback, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useOrdersStore } from '@/store/orders'

export type {
  OrderHistoryItem,
  OrderHistoryLine,
  OrderHistoryLineModifier,
} from '@/store/orders'

interface OrderHistoryData {
  orders: import('@/store/orders').OrderHistoryItem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Order history, scoped to the signed-in Supabase user. Identity is
// auth-derived server-side — no phone/customerId passed from the client.
export function useOrderHistory(): OrderHistoryData {
  const { profile } = useAuth()
  const signedIn = !!profile
  const orders = useOrdersStore((s) => s.orders)
  const loading = useOrdersStore((s) => s.loading)
  const error = useOrdersStore((s) => s.error)
  const storeRefresh = useOrdersStore((s) => s.refresh)
  const clear = useOrdersStore((s) => s.clear)

  useEffect(() => {
    if (signedIn) storeRefresh()
    else clear()
  }, [signedIn, storeRefresh, clear])

  const refresh = useCallback(async () => {
    if (signedIn) await storeRefresh()
  }, [signedIn, storeRefresh])

  return { orders, loading, error, refresh }
}
