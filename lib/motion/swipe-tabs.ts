import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'
import { SLIDE_MS } from './slide'

// The four tab pages sit side by side and the finger drags them: Home slides
// left and Menu comes in from the right, 1:1 under the thumb (Rick,
// 2026-09-11). Everything here is the arithmetic of that pager — where the
// pages settle when the finger lets go, how the ends give, how the page
// being left fogs over as it goes — kept pure so it can be tested on the
// JS thread and called from the gesture worklet on the UI one. Positions
// are in page units: 0 is Home resting, 0.5 is halfway to Menu.

/** A flick faster than this (pages per second) turns the page whatever the
 *  distance — a short, quick swipe is a clear instruction. Slower than it,
 *  the page that is more than half in view wins. */
export const FLICK = 0.75

/** How far past the first or last page the finger can pull, in page units,
 *  before the rubber band goes stiff. */
export const OVERDRAG = 0.18

/** Settling after a release: a spring with a little give — it runs a
 *  couple of percent past the page and eases back, so the page lands like
 *  something with weight instead of stopping on a line (Rick, on the phone:
 *  the page going away should feel elastic). The row is not clamped; what
 *  the overshoot would expose fades out instead (see fringeOpacity). */
export const SWIPE_SNAP: WithSpringConfig = {
  damping: 24,
  stiffness: 220,
  mass: 1,
}

/** The most speed a flick may hand the spring, in pages per second —
 *  faster would throw the page past its mark by more than the bounce is
 *  meant to show. */
export const SNAP_MAX_VELOCITY = 1.2

/** Travel when a tab is tapped instead of swiped: the pill window's own
 *  curve (Slide) so the two move as one thing. */
export const SWIPE_TRAVEL: WithTimingConfig = {
  duration: SLIDE_MS,
  easing: Easing.out(Easing.exp),
}

/** Extra travel time per page crossed beyond the first when a tap jumps
 *  more than one tab over — the far pages sweep past rather than blink. */
export const TRAVEL_PER_EXTRA_PAGE_MS = 90

/** How far, in pages, a page is from the pager when it is wholly fogged:
 *  the page being left is whole fog once it has gone this far, and the page
 *  coming in stays whole fog until it is this close, then clears. */
export const HAZE_FULL_AT = 0.85

/** expo-blur intensity of a page at full haze. */
export const HAZE_BLUR = 36

/** A page more than this far from the pager, in pages, begins to fade;
 *  by FRINGE_GONE it is not drawn. Only the last sliver of a page is ever
 *  in that band — what the bounce past a mark would otherwise show of the
 *  page beyond, and the last points of the page going away. */
export const FRINGE_FADE = 0.94
export const FRINGE_GONE = 0.985

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

/** The speed the spring is allowed to start with. */
export function snapVelocity(velocity: number): number {
  'worklet'
  return Math.max(-SNAP_MAX_VELOCITY, Math.min(SNAP_MAX_VELOCITY, velocity))
}

/** Where page `index` sits for the current position. */
export function pageX(index: number, position: number, width: number): number {
  'worklet'
  return (index - position) * width
}

/** How fogged page `index` is: nothing while the pager rests on it, whole
 *  when it is HAZE_FULL_AT or further away. So the page being left fogs
 *  over as it goes — and stays fogged through a bounce past its mark — and
 *  the page coming in arrives out of the fog, clearing as it lands (Rick:
 *  the page sliding in should go from blurred to sharp too). Pulling a
 *  page back thins its fog again. */
export function hazeStrength(position: number, index: number): number {
  'worklet'
  return Math.min(1, Math.abs(position - index) / HAZE_FULL_AT)
}

/** Which edge of page `index` faces the seam — the join with the page it
 *  is leaving for or arriving from: 1 for its right edge (the pager is
 *  beyond it, toward higher indices), -1 for its left. */
export function seamSide(position: number, index: number): 1 | -1 {
  'worklet'
  return position >= index ? 1 : -1
}

/** The least a fog sheet is ever scaled to: a zero scale is a matrix
 *  nobody can invert. */
const FOG_SHEET_MIN = 0.001

/**
 * How the fog sheet sits over a page. The sheet is the page's width,
 * anchored to the page's seam edge, opaque at that edge and fading to
 * nothing at its other end; it is scaled from the seam by the haze, so at
 * no haze it is nothing, and at full haze it reaches across the page. The
 * seam edge is always whole fog on both pages, so the join between them
 * is one colour — no line — and each page emerges from the fog with
 * distance from it: the page being left has the fog spread over it as it
 * goes, the page coming in has it drain back into the join as it lands
 * (Rick: dissolve the boundary, let the two pages fuse). Returns the
 * transform that keeps the seam edge fixed while scaling: React Native
 * scales about the centre, so the sheet is shifted half the lost width
 * toward its anchored edge.
 */
export function fogSheet(haze: number, side: 1 | -1, width: number): { translateX: number; scaleX: number } {
  'worklet'
  const scaleX = Math.max(FOG_SHEET_MIN, Math.min(1, haze))
  const shift = ((1 - scaleX) * width) / 2
  return { translateX: side === 1 ? shift : -shift, scaleX }
}

/** How much of page `index` to draw for a pager at `position`: whole until
 *  only its last sliver is on screen, then gone — see FRINGE_FADE. */
export function fringeOpacity(index: number, position: number): number {
  'worklet'
  const away = Math.abs(index - position)
  if (away <= FRINGE_FADE) return 1
  if (away >= FRINGE_GONE) return 0
  return 1 - (away - FRINGE_FADE) / (FRINGE_GONE - FRINGE_FADE)
}

/** Travel time for a tap that jumps `pages` tabs over. */
export function travelDuration(pages: number): number {
  const extra = Math.max(0, Math.abs(pages) - 1)
  return SLIDE_MS + extra * TRAVEL_PER_EXTRA_PAGE_MS
}
