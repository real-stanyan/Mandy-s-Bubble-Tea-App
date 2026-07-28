import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { getOrderNonce, deriveIdempotencyKey } from '@/lib/order-nonce'
import { buildOrderLines } from '@/lib/order-lines'
import { staleCartFrom } from '@/lib/stale-cart'
import type { CartItem, Order } from '@/types/square'

interface CreateOrderParams {
  items: CartItem[]
  applyWelcomeDiscount?: boolean
  applyIgFollowDiscount?: boolean
  applyLoyaltyReward?: boolean
  loyaltyRewardCount?: number
  note?: string
  fulfillmentType?: 'PICKUP' | 'DELIVERY'
  delivery?: {
    address: string
    lat: number
    lng: number
    unit?: string
    driverNote?: string
    postcode?: string
  }
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
    applyIgFollowDiscount,
    applyLoyaltyReward,
    loyaltyRewardCount,
    note,
    fulfillmentType,
    delivery,
  }: CreateOrderParams): Promise<CreateOrderResult> => {
    setLoading(true)
    setError(null)
    try {
      const lines = buildOrderLines(items)

      // Order body WITHOUT idempotencyKey — the key is derived FROM this
      // body (sha256(nonce|body)), mirroring the web checkout, so a retry
      // of the identical order reuses the original OPEN order server-side
      // while any cart change yields a fresh key.
      const orderBody = {
        lines,
        applyWelcomeDiscount: !!applyWelcomeDiscount,
        applyIgFollowDiscount: !!applyIgFollowDiscount,
        applyLoyaltyReward: !!applyLoyaltyReward,
        loyaltyRewardCount: loyaltyRewardCount ?? 0,
        note: note?.trim() ? note.trim() : undefined,
        fulfillmentType: fulfillmentType ?? 'PICKUP',
        ...(fulfillmentType === 'DELIVERY' && delivery ? { delivery } : {}),
      }

      let idempotencyKey: string | undefined
      try {
        const nonce = await getOrderNonce()
        idempotencyKey = await deriveIdempotencyKey(nonce, orderBody)
      } catch {
        // Fail-open: a missing key just restores the old no-dedupe
        // behaviour server-side; never block order creation on it.
      }

      const orderRes = await apiFetch<{
        ok: boolean
        orderId: string
        order: Order
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(
          idempotencyKey ? { ...orderBody, idempotencyKey } : orderBody,
        ),
      })

      return { orderId: orderRes.orderId, order: orderRes.order }
    } catch (e) {
      // A cart can go stale between the quote and the tap (the catalog is
      // edited from the Square dashboard mid-session). The server says so in
      // plain English; without this the customer would read the raw
      // `API 409: {"ok":false,...}`.
      const stale = staleCartFrom(e)
      const msg = stale
        ? stale.message
        : e instanceof Error
          ? e.message
          : 'Failed to create order'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { createOrder, loading, error }
}
