import { create } from 'zustand'
import { apiFetch } from '@/lib/api'

interface WelcomeDiscountState {
  phone: string | null
  customerId: string | null
  available: boolean
  percentage: number
  loading: boolean
  dismissed: boolean
  refresh: (phone: string | null) => Promise<void>
  markConsumed: () => void
  dismiss: () => void
  clear: () => void
}

export const useWelcomeDiscountStore = create<WelcomeDiscountState>((set, get) => ({
  phone: null,
  customerId: null,
  available: false,
  percentage: 30,
  loading: false,
  dismissed: false,

  refresh: async (phone) => {
    if (!phone) {
      set({ phone: null, customerId: null, available: false })
      return
    }
    if (phone !== get().phone) {
      set({ phone, customerId: null, available: false, dismissed: false })
    }
    set({ loading: true })
    try {
      const lookup = await apiFetch<{
        ok: boolean
        found: boolean
        customerId?: string
      }>('/api/customer/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      })
      if (!lookup.found || !lookup.customerId) {
        set({ customerId: null, available: false })
        return
      }
      set({ customerId: lookup.customerId })
      const status = await apiFetch<{
        ok: boolean
        available: boolean
        percentage?: number
      }>(`/api/welcome-discount/status?customerId=${encodeURIComponent(lookup.customerId)}`)
      set({
        available: !!status.available,
        percentage: status.percentage ?? 30,
      })
    } catch {
      set({ available: false })
    } finally {
      set({ loading: false })
    }
  },

  markConsumed: () => set({ available: false }),
  dismiss: () => set({ dismissed: true }),
  clear: () =>
    set({
      phone: null,
      customerId: null,
      available: false,
      percentage: 30,
      dismissed: false,
    }),
}))
