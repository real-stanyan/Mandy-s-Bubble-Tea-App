import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { AppliedPrize } from '@/hooks/use-create-order'

export type { AppliedPrize }

export interface PrizeReveal {
  rollId: string
  tier_id: string
  prize_type: 'thank_you' | 'digital' | 'physical'
  label: string
  payload: Record<string, unknown>
  claim_code?: string
  expires_at: string | null
}

interface PaymentParams {
  sourceId?: string
  orderId: string
  verificationToken?: string
}

interface PaymentResult {
  ok: boolean
  paymentId?: string
  loyaltyAccrued?: boolean
  welcomeDiscountConsumed?: boolean
  payment?: unknown
  prize?: PrizeReveal | null
  appliedPrize?: AppliedPrize | null
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
