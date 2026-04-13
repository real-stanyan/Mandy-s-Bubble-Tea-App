import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface PaymentParams {
  token: string
  orderId: string
  total: number
  phoneNumber?: string
}

interface PaymentResult {
  success: boolean
  payment?: unknown
  starsEarned?: number
}

interface PaymentHook {
  pay: (params: PaymentParams) => Promise<PaymentResult>
  loading: boolean
  error: string | null
}

export function usePayment(): PaymentHook {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async (params: PaymentParams): Promise<PaymentResult> => {
    setLoading(true)
    setError(null)
    try {
      const idempotencyKey = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      const result = await apiFetch<PaymentResult>('/api/payment', {
        method: 'POST',
        body: JSON.stringify({ ...params, idempotencyKey }),
      })
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { pay, loading, error }
}
