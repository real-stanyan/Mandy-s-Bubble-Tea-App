import { useState } from 'react'
import { apiFetch } from '@/lib/api'

// Mirror web /api/payment PaymentBody:
//   ~/Github/mandys_bubble_tea/src/app/api/payment/route.ts
// Field names MUST match — server's isValidBody silently drops unknown
// fields (no schema error), which masks bugs as "tarot fallback printed
// instead of user's cup label". Don't invent new field names here without
// adding them to the web route first.
interface PaymentParams {
  sourceId?: string
  orderId: string
  verificationToken?: string
  /** cupKey → md5/named hash from public/cup-label/gallery */
  presetStickerHashes?: Record<string, string>
  /** cupKey → aiDoodleId. Server treats photo uploads and AI generations
   *  identically — both land here as pre-uploaded image references. */
  aiDoodleIds?: Record<string, string>
  /** cupKey → doodleId for drawn doodles (uploaded via /api/doodle/upload) */
  doodleIds?: Record<string, string>
}

interface PaymentResult {
  ok: boolean
  paymentId?: string
  status?: string
  loyaltyAccrued?: boolean
  welcomeDiscountConsumed?: boolean
  welcomeDiscountConsumedCount?: number
  welcomeDrinksRemaining?: number
  igFollowDiscountConsumed?: boolean
  igFollowDrinksRemaining?: number
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
