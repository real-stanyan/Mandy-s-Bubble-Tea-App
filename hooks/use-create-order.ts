import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CartItem, Order } from '@/types/square'

interface CreateOrderParams {
  items: CartItem[]
  applyWelcomeDiscount?: boolean
}

interface CreateOrderResult {
  orderId: string
  order: Order
}

interface CreateOrderHook {
  createOrder: (params: CreateOrderParams) => Promise<CreateOrderResult>
  loading: boolean
  error: string | null
}

// Customer identity (customerId / phone / name) is derived server-side
// from the Supabase session. The client only sends the cart.
export function useCreateOrder(): CreateOrderHook {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = async ({
    items,
    applyWelcomeDiscount,
  }: CreateOrderParams): Promise<CreateOrderResult> => {
    setLoading(true)
    setError(null)
    try {
      const lines = items.map((item) => {
        const modifierTotal = (item.modifiers ?? []).reduce(
          (sum, m) => sum + (m.priceCents ?? 0),
          0,
        )
        return {
          itemName: item.name,
          variationId: item.variationId,
          variationName: item.variationName,
          variationPriceCents: Math.max(0, item.price - modifierTotal),
          modifiers: (item.modifiers ?? []).map((m) => ({
            id: m.id,
            name: m.name,
            priceCents: m.priceCents ?? 0,
          })),
          quantity: item.quantity,
        }
      })

      const orderRes = await apiFetch<{
        ok: boolean
        orderId: string
        order: Order
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          lines,
          applyWelcomeDiscount: !!applyWelcomeDiscount,
        }),
      })

      return { orderId: orderRes.orderId, order: orderRes.order }
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
