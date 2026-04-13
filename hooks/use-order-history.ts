import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export interface OrderHistoryItem {
  id: string
  createdAt: string | null
  state: string | null
  totalCents: string
  itemSummary: string
  lineCount: number
}

interface OrderHistoryData {
  orders: OrderHistoryItem[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useOrderHistory(phone: string | null): OrderHistoryData {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    setError(null)
    try {
      // First get customerId from phone
      const customerRes = await apiFetch<{
        ok: boolean
        found: boolean
        customerId?: string
      }>('/api/customer/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      })
      if (!customerRes.found || !customerRes.customerId) {
        setOrders([])
        return
      }

      // Then fetch order history
      const historyRes = await apiFetch<{
        ok: boolean
        orders: OrderHistoryItem[]
      }>('/api/orders/history', {
        method: 'POST',
        body: JSON.stringify({ customerId: customerRes.customerId }),
      })
      setOrders(historyRes.orders ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  return { orders, loading, error, refresh: fetchOrders }
}
