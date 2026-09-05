// Slide: one highlight that travels between options instead of each option
// repainting itself. Filters, category rails, segmented controls all share
// it. The component measures its options with onLayout; this picks the
// slot the highlight should be on.

export type Slot = { x: number; y: number; width: number; height: number }

/** Highlight travel — expo-out, 400ms: quick to leave, soft to arrive. */
export const SLIDE_MS = 400

export function slotFor<K extends string>(
  slots: Partial<Record<K, Slot>>,
  key: K | null | undefined,
): Slot | null {
  if (key == null) return null
  const s = slots[key]
  if (!s) return null
  if (![s.x, s.y, s.width, s.height].every(Number.isFinite)) return null
  return s
}

/** Layout event → slot, so every caller rounds the same way. */
export function slotFromLayout(l: { x: number; y: number; width: number; height: number }): Slot {
  return { x: l.x, y: l.y, width: l.width, height: l.height }
}
