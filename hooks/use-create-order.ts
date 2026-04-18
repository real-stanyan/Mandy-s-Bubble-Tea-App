import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CartItem, Order } from '@/types/square'

interface CreateOrderParams {
  items: CartItem[]
  name: string
  phone: string
  applyWelcomeDiscount?: boolean
}

interface CreateOrderResult {
  orderId: string
  customerId: string
  order: Order
}

interface CreateOrderHook {
  createOrder: (params: CreateOrderParams) => Promise<CreateOrderResult>
  loading: boolean
  error: string | null
}

export function useCreateOrder(): CreateOrderHook {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = async ({
    items,
    name,
    phone,
    applyWelcomeDiscount,
  }: CreateOrderParams): Promise<CreateOrderResult> => {
    setLoading(true)
    setError(null)
    try {
      // 1) Lookup/create customer to get customerId
      const customerRes = await apiFetch<{
        ok: boolean
        customerId: string
      }>('/api/customer', {
        method: 'POST',
        body: JSON.stringify({ name, phone }),
      })

      // 2) Create order with proper format
      const lines = items.map((item) => ({
        itemName: item.name,
        variationId: item.variationId,
        variationName: item.variationName,
        modifiers: (item.modifiers ?? []).map((m) => ({
          id: m.id,
          name: m.name,
        })),
        quantity: item.quantity,
      }))

      const orderRes = await apiFetch<{
        ok: boolean
        orderId: string
        order: Order
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customerRes.customerId,
          recipientName: name.trim(),
          recipientPhone: phone.trim(),
          lines,
          applyWelcomeDiscount: !!applyWelcomeDiscount,
        }),
      })

      return { orderId: orderRes.orderId, customerId: customerRes.customerId, order: orderRes.order }
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
