import type { Point } from './fly-path'

// The bottom dock: the floating tab pill and, while the bag holds anything,
// the bag capsule beside it — one row, one height, one radius, one lift.
// The mini cart used to be a second, wider, solid bar stacked over the glass
// pill, and the two read as unrelated objects (Rick, 2026-09-11). Now the
// pill gives up the capsule's width on the right and the capsule slides in
// to fill it; empty the bag and it slides out and the pill spans the row
// again. One shared value, `open` (0 → 1), drives both, so they always
// agree. The arithmetic is here so it can be tested and so the fly-to-bag
// dot knows where the bag will be before the capsule has even mounted.

/** Between the pill and the capsule. */
export const DOCK_GAP = 10
/** The capsule's own padding, the bag glyph, and the gap to the total. */
export const CAPSULE_PAD = 16
export const CAPSULE_BAG = 20
export const CAPSULE_TEXT_GAP = 10
/** JetBrains Mono at 14pt: 0.6em advance. The total is set in it. */
export const MONO_CH = 8.4

/** How wide the capsule is for a total set as `label`. */
export function capsuleWidth(label: string): number {
  return CAPSULE_PAD * 2 + CAPSULE_BAG + CAPSULE_TEXT_GAP + Math.ceil(label.length * MONO_CH)
}

/** The pill's width in a row `rowW` wide with the capsule `open` (0..1) of the way in. */
export function pillWidth(rowW: number, capsuleW: number, open: number): number {
  'worklet'
  return rowW - open * (capsuleW + DOCK_GAP)
}

/** One tab's slot inside a pill `pillW` wide with `pad` at each end. */
export function slotWidth(pillW: number, pad: number, count: number): number {
  'worklet'
  return count > 0 ? Math.max(0, (pillW - pad * 2) / count) : 0
}

/** How far right of its resting place the capsule sits while `open` of the
 *  way in: at 0 it is past the row's edge, off the screen. */
export function capsuleSlide(open: number, capsuleW: number): number {
  'worklet'
  return (1 - open) * (capsuleW + DOCK_GAP + 8)
}

/** The capsule fades in over the first part of the slide, out over the last. */
export function capsuleOpacity(open: number): number {
  'worklet'
  const o = open * 1.6
  return o < 0 ? 0 : o > 1 ? 1 : o
}

export type BagCenterInput = {
  windowWidth: number
  windowHeight: number
  /** The row's margin from the screen's sides (the pill's). */
  margin: number
  /** The row's lift off the bottom edge and its height (the pill's). */
  lift: number
  height: number
  capsuleW: number
}

/**
 * Resting centre of the bag glyph in the capsule, in window coordinates —
 * where the fly-to-bag dot lands. From the dock's own constants rather than
 * a measurement: an empty bag has no capsule until the item lands in it.
 */
export function cartDockBagCenter({ windowWidth, windowHeight, margin, lift, height, capsuleW }: BagCenterInput): Point {
  return {
    x: windowWidth - margin - capsuleW + CAPSULE_PAD + CAPSULE_BAG / 2,
    y: windowHeight - lift - height / 2,
  }
}
