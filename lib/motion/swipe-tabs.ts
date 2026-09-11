import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'
import { SLIDE_MS } from './slide'

// The four tab pages sit side by side and the finger drags them: Home slides
// left and Menu comes in from the right, 1:1 under the thumb (Rick,
// 2026-09-11). Everything here is the arithmetic of that pager — where the
// pages settle when the finger lets go, how the ends give, how strong the
// frosted seam between two pages is — kept pure so it can be tested on the
// JS thread and called from the gesture worklet on the UI one. Positions
// are in page units: 0 is Home resting, 0.5 is halfway to Menu.

/** A flick faster than this (pages per second) turns the page whatever the
 *  distance — a short, quick swipe is a clear instruction. Slower than it,
 *  the page that is more than half in view wins. */
export const FLICK = 0.75

/** How far past the first or last page the finger can pull, in page units,
 *  before the rubber band goes stiff. */
export const OVERDRAG = 0.18

/** Settling after a release: a spring that follows the finger's speed and
 *  stops dead on the page — a pager that bounces past and back reads as
 *  a mistake, not a flourish. */
export const SWIPE_SNAP: WithSpringConfig = {
  damping: 32,
  stiffness: 320,
  mass: 1,
  overshootClamping: true,
}

/** Travel when a tab is tapped instead of swiped: the pill window's own
 *  curve (Slide) so the two move as one thing. */
export const SWIPE_TRAVEL: WithTimingConfig = {
  duration: SLIDE_MS,
  easing: Easing.out(Easing.exp),
}

/** Extra travel time per page crossed beyond the first when a tap jumps
 *  more than one tab over — the far pages sweep past rather than blink. */
export const TRAVEL_PER_EXTRA_PAGE_MS = 90

/** Half the width of the frosted seam that rides between two pages while
 *  they move, in points. */
export const SEAM_HALF = 30

/**
 * Where the pages settle once the finger lets go. `position` is where the
 * pager is now, `velocity` its speed in pages per second (positive toward
 * higher indices), `from` the page the drag started on. Never more than one
 * page from `from` — one swipe is one page — and always a real page.
 */
export function settleTarget(position: number, velocity: number, from: number, count: number): number {
  'worklet'
  const last = Math.max(0, count - 1)
  let target: number
  if (velocity > FLICK) target = Math.ceil(position)
  else if (velocity < -FLICK) target = Math.floor(position)
  else target = Math.round(position)
  target = Math.min(from + 1, Math.max(from - 1, target))
  return Math.min(last, Math.max(0, target))
}

/** Resistance past an end: starts out following the finger 1:1 and never
 *  gets further than OVERDRAG, like a scroll view's bounce. */
export function overdrag(x: number): number {
  'worklet'
  return (OVERDRAG * x) / (x + OVERDRAG)
}

/** The raw finger position, with the ends giving instead of stopping. */
export function rubberBand(raw: number, count: number): number {
  'worklet'
  const last = Math.max(0, count - 1)
  if (raw < 0) return -overdrag(-raw)
  if (raw > last) return last + overdrag(raw - last)
  return raw
}

/** How present the frosted seam is: nothing while the pager rests on a page,
 *  full at the halfway point between two, and nothing again past either end
 *  (there is no second page there to meet). */
export function seamStrength(position: number, count: number): number {
  'worklet'
  const last = Math.max(0, count - 1)
  if (position <= 0 || position >= last) return 0
  const f = position - Math.floor(position)
  return 4 * f * (1 - f)
}

/** The x of the seam — the left edge of the page the pager is moving
 *  toward — in points from the left of the viewport. Pages sit at
 *  (index − position) × width. */
export function seamX(position: number, width: number): number {
  'worklet'
  return (Math.ceil(position) - position) * width
}

/** Where page `index` sits for the current position. */
export function pageX(index: number, position: number, width: number): number {
  'worklet'
  return (index - position) * width
}

/** Travel time for a tap that jumps `pages` tabs over. */
export function travelDuration(pages: number): number {
  const extra = Math.max(0, Math.abs(pages) - 1)
  return SLIDE_MS + extra * TRAVEL_PER_EXTRA_PAGE_MS
}
