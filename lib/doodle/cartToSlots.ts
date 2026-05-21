import type { CartItem } from '@/types/square'
import { pickDefaultForCup } from './pool'

import type { SvgPath } from './types'
export type { SvgPath } from './types'

export type DoodleSlot = {
  lineId: string
  cupIdx: number
  drinkName: string
  defaultKey: string
  userPaths: SvgPath[] | null
  /**
   * When set, this slot uses an AI-generated doodle (see /api/cup-label/ai-generate).
   * Takes priority over `userPaths` (drawn) and `defaultKey` (preset/hash) at checkout.
   * `aiPreviewUrl` is a 1h signed Storage URL for showing the result back to the user.
   */
  aiDoodleId: string | null
  aiPreviewUrl: string | null
  aiPrompt: string | null
  /**
   * Local-only reference image (data URI) used for image-to-image AI
   * generation. Never persisted across cart sessions — gets sent up
   * inline on /api/cup-label/ai-generate, then forgotten. Local URI is
   * kept on the side so the modal can show a thumbnail without re-
   * encoding the base64 every render.
   */
  aiSourceDataUri: string | null
  aiSourceLocalUri: string | null
  /**
   * Photo uploaded from the device library. Server-side identical to AI
   * (preprocessed PNG in storage); kept on a distinct slot field so the
   * UI can label the source correctly ("📷 Photo" vs "✨ AI"). Mutually
   * exclusive with aiDoodleId at checkout.
   */
  uploadedDoodleId: string | null
  uploadedPreviewUrl: string | null
}

export function cartToSlots(items: CartItem[]): DoodleSlot[] {
  const slots: DoodleSlot[] = []
  for (const item of items) {
    for (let cupIdx = 0; cupIdx < item.quantity; cupIdx++) {
      slots.push({
        lineId: item.lineId,
        cupIdx,
        drinkName: item.name,
        defaultKey: pickDefaultForCup(item.lineId, cupIdx).key,
        userPaths: null,
        aiDoodleId: null,
        aiPreviewUrl: null,
        aiPrompt: null,
        aiSourceDataUri: null,
        aiSourceLocalUri: null,
        uploadedDoodleId: null,
        uploadedPreviewUrl: null,
      })
    }
  }
  return slots
}
