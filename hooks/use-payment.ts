import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface PaymentParams {
  sourceId?: string
  orderId: string
  customerId: string
  phone: string
}

interface PaymentResult {
  ok: boolean
  paymentId?: string
  loyaltyAccrued?: boolean
  welcomeDiscountConsumed?: boolean
  payment?: unknown
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
      const result = await apiFetch<PaymentResult>('/api/payment', {
        method: 'POST',
        body: JSON.stringify(params),
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
