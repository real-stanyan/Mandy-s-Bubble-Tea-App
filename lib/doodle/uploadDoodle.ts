import { apiFetch } from '@/lib/api'
import type { SvgPath } from './cartToSlots'

export interface UploadResult { doodleId: string }

export async function uploadDoodle(paths: SvgPath[]): Promise<UploadResult> {
  const res = await apiFetch<{ ok: boolean; doodleId?: string; error?: string }>(
    '/api/doodle/upload',
    { method: 'POST', body: JSON.stringify({ paths }) },
  )
  if (!res.ok || !res.doodleId) {
    throw new Error(res.error ?? 'Doodle upload failed')
  }
  return { doodleId: res.doodleId }
}
