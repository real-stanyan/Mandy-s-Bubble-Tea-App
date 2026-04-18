import { useCallback, useEffect } from 'react'
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

export function useOrderHistory(phone: string | null): OrderHistoryData {
  const orders = useOrdersStore((s) => s.orders)
  const loading = useOrdersStore((s) => s.loading)
  const error = useOrdersStore((s) => s.error)
  const storeRefresh = useOrdersStore((s) => s.refresh)

  useEffect(() => {
    if (phone) storeRefresh(phone)
  }, [phone, storeRefresh])

  const refresh = useCallback(async () => {
    await storeRefresh(phone)
  }, [phone, storeRefresh])

  return { orders, loading, error, refresh }
}
