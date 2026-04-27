import type { CartItem } from '@/types/square'
import { pickDefaultForCup } from './pool'

export type SvgPath = { d: string; stroke: string; width: number }

export type DoodleSlot = {
  lineId: string
  cupIdx: number
  drinkName: string
  defaultKey: string
  userPaths: SvgPath[] | null
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
      })
    }
  }
  return slots
}
