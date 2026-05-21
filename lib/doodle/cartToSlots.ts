// lib/doodle/cartToSlots.ts
//
// Derive a flat list of cup-level slots from cart lines + persisted
// label selections. Selection-less cups get a deterministic default
// preset hash (mirrors server-side tarot draw, but resolved client-side
// so the cup row UI has something stable to render before the user
// opens the picker).

import type { CartItem } from '@/types/square'
import type { CupLabelSelection } from '@/store/cart'
import { cupKey } from '@/store/cart'
import { pickDeterministicHash } from './preset-default'
import { GALLERY_HASHES } from './gallery-manifest.generated'

export type DoodleSlot = {
  lineId: string
  cupIdx: number
  cupKey: string
  drinkName: string
  selection: CupLabelSelection
}

export function cartToSlots(
  items: CartItem[],
  selections: Record<string, CupLabelSelection>,
): DoodleSlot[] {
  const slots: DoodleSlot[] = []
  for (const item of items) {
    for (let cupIdx = 0; cupIdx < item.quantity; cupIdx++) {
      const k = cupKey(item.lineId, cupIdx)
      const selection: CupLabelSelection =
        selections[k] ?? {
          kind: 'preset',
          hash: pickDeterministicHash(item.lineId, cupIdx, GALLERY_HASHES),
        }
      slots.push({ lineId: item.lineId, cupIdx, cupKey: k, drinkName: item.name, selection })
    }
  }
  return slots
}
