import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CartItem, Order } from '@/types/square'

interface CreateOrderHook {
  createOrder: (items: CartItem[]) => Promise<Order>
  loading: boolean
  error: string | null
}

export function useCreateOrder(): CreateOrderHook {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = async (items: CartItem[]): Promise<Order> => {
    setLoading(true)
    setError(null)
    try {
      const order = await apiFetch<Order>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      return order
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create order'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { createOrder, loading, error }
}
