// lib/doodle/cartToSlots.ts
//
// Derive a flat list of cup-level slots from cart lines + persisted
// label selections. Cup labels are OPTIONAL: a cup the customer hasn't
// touched has `selection === null` ("surprise" state). We deliberately
// do NOT synthesize a gallery-sticker default any more — an untouched
// cup submits nothing, and the server (enqueue.ts → drawTarot) gives it
// a random tarot card at print time. Showing a concrete sticker here
// made the picker look mandatory AND mis-represented the actual print
// (the cup prints a tarot card, not the sticker we used to show).

import type { CartItem } from '@/types/square'
import type { CupLabelSelection } from '@/store/cart'
import { cupKey } from '@/store/cart'

export type DoodleSlot = {
  lineId: string
  cupIdx: number
  cupKey: string
  drinkName: string
  /** null = no pick yet → prints a random surprise tarot card. */
  selection: CupLabelSelection | null
}

export function cartToSlots(
  items: CartItem[],
  selections: Record<string, CupLabelSelection>,
): DoodleSlot[] {
  const slots: DoodleSlot[] = []
  for (const item of items) {
    for (let cupIdx = 0; cupIdx < item.quantity; cupIdx++) {
      const k = cupKey(item.lineId, cupIdx)
      const selection: CupLabelSelection | null = selections[k] ?? null
      slots.push({ lineId: item.lineId, cupIdx, cupKey: k, drinkName: item.name, selection })
    }
  }
  return slots
}
