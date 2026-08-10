import { apiFetch } from '@/lib/api'

/** The proposal exactly as the web's /api/chat serializes it — amounts are
 *  decimal STRINGS (BigInt does not survive JSON on the server side).
 *  Field-for-field match to src/lib/chat/proposal-to-cart.ts in the web
 *  repo; keep in sync by hand. */
export type ApiProposal = {
  itemId: string
  itemName: string
  imageUrl: string | null
  categorySlug: string
  variationId: string
  variationName: string
  variationPriceCents: string
  modifiers: { id: string; name: string; priceCents: string }[]
  quantity: number
  unitPriceCents: string
  totalCents: string
}

export type ChatResponse = {
  reply: string
  proposal: ApiProposal | null
  proposals?: ApiProposal[]
  action: 'checkout' | null
  suggestions: { itemId: string; itemName: string; categorySlug: string }[]
}

/** Mirrors the route's own limits (web src/app/api/chat/route.ts) so the
 *  client trims itself instead of drawing an avoidable 400. */
export const MAX_HISTORY = 20
export const MAX_CHARS = 500

export async function sendChat(
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: history
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) })),
    }),
  })
}
