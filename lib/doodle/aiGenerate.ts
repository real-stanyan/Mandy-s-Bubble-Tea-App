// lib/doodle/aiGenerate.ts
//
// Submit-and-forget AI doodle. Hits POST /api/cup-label/ai-submit which
// returns immediately with an aiDoodleId; the real Doubao + binarize
// pipeline runs server-side in the background. The customer never
// sees a preview — the image is revealed on the printed cup label
// ("Surprise on your cup" mode).
//
// Per-cup-slot 1× quota is enforced server-side via the
// cup_label_ai_jobs UNIQUE(user_id, slot_key) constraint. Re-submitting
// for the same slot returns the original aiDoodleId (response includes
// reused=true) — no extra Doubao charge.

import { apiFetch } from '@/lib/api'

export interface AiSubmitResult {
  aiDoodleId: string
  status: 'pending' | 'ready' | 'failed'
  reused: boolean
}

export async function submitAiCupLabel(args: {
  slotKey: string
  prompt: string
  sourceImageBase64?: string
  /**
   * Cart-session id from the local cart store. Scoping the server-side
   * 1×/slot quota to this id is what stops a fresh cart from inheriting
   * the AI image of a previous cart for the same drink+modifier combo
   * — see web /api/cup-label/ai-submit.
   */
  cartSessionId: string
}): Promise<AiSubmitResult> {
  const trimmed = args.prompt.trim()
  if (trimmed.length === 0) throw new Error('Prompt is empty')
  if (!args.slotKey) throw new Error('slotKey is required')
  if (!args.cartSessionId) throw new Error('cartSessionId is required')

  const res = await apiFetch<{
    ok: boolean
    aiDoodleId?: string
    status?: 'pending' | 'ready' | 'failed'
    reused?: boolean
    error?: string
  }>('/api/cup-label/ai-submit', {
    method: 'POST',
    body: JSON.stringify({
      slotKey: args.slotKey,
      prompt: trimmed,
      sourceImageBase64: args.sourceImageBase64,
      cartSessionId: args.cartSessionId,
    }),
  })

  if (!res.ok || !res.aiDoodleId) {
    throw new Error(res.error ?? 'AI submit failed')
  }
  return {
    aiDoodleId: res.aiDoodleId,
    status: res.status ?? 'pending',
    reused: res.reused ?? false,
  }
}
