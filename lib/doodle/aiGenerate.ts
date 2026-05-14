// lib/doodle/aiGenerate.ts
//
// Calls POST /api/cup-label/ai-generate with the user's prompt. Server
// appends a forced line-art suffix and runs the result through the same
// 300dpi 1-bit thermal pipeline used by drawn doodles, then returns the
// stored aiDoodleId + signed preview URL. The id flows straight back at
// checkout via /api/payment → enqueueCupLabelJobs → ZD410.

import { apiFetch } from '@/lib/api'

export interface AiGenerateResult {
  aiDoodleId: string
  previewUrl: string
}

export async function aiGenerateCupLabel(
  prompt: string,
  sourceImageBase64?: string,
): Promise<AiGenerateResult> {
  const trimmed = prompt.trim()
  if (trimmed.length === 0) throw new Error('Prompt is empty')

  const res = await apiFetch<{
    ok: boolean
    aiDoodleId?: string
    previewUrl?: string
    error?: string
  }>('/api/cup-label/ai-generate', {
    method: 'POST',
    body: JSON.stringify({ prompt: trimmed, sourceImageBase64 }),
  })

  if (!res.ok || !res.aiDoodleId || !res.previewUrl) {
    throw new Error(res.error ?? 'AI generation failed')
  }
  return { aiDoodleId: res.aiDoodleId, previewUrl: res.previewUrl }
}
