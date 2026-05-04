import { apiFetch } from '@/lib/api'

export interface ActivePrize {
  id: string
  tier_id: string
  prize_type: 'digital' | 'physical'
  label: string
  expires_at: string
  claim_code?: string
}

export async function fetchActivePrizes(): Promise<ActivePrize[]> {
  try {
    const body = await apiFetch<{ prizes: ActivePrize[] }>('/api/prizes/me')
    return body.prizes
  } catch (err) {
    // 401 / 500 / network — return empty so UI shows nothing rather than erroring
    if (
      err instanceof Error &&
      err.message.includes('API 401')
    ) {
      return []
    }
    throw err
  }
}
