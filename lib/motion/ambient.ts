import { makeMutable, type SharedValue } from 'react-native-reanimated'

// The ambient clock. Every decorative loop in the app — the living category
// illustrations, the hero scenes, the member card's light, the breathing
// cups — used to be a Reanimated animation of its own: some sixty-five of
// them on the Home page alone, each ticking sixty times a second, each
// pushing a fresh matrix into a react-native-svg group, and every push
// re-rasterising the whole <Svg> the group sits in. Off-screen tiles, the
// tabs that were not showing, a page halfway through a swipe: all of it kept
// drawing (Rick, 2026-09-11: the app stutters, on both platforms).
//
// Now there is one clock, moved along by one frame callback
// (components/ui/AmbientClock), and every loop reads its phase off it:
//   - it ticks AMBIENT_FPS times a second, so an illustration is redrawn that
//     often and no more — ambient motion is slow, and nobody can tell;
//   - it stands still while a list scrolls, while the tab pager moves, while
//     the app is in the background, and under Reduce Motion — the loops
//     freeze where they are and pick up from there;
//   - a loop whose gate is shut (its page not focused, its tile off the
//     screen) holds frame zero, and because the mapper hands Reanimated the
//     very same props object it handed it last time, no native update is
//     sent at all (Reanimated skips a shallow-equal result).
// The arithmetic is pure and lives here so it can be tested; the React and
// UI-thread wiring is components/ui/AmbientClock and components/ui/LoopScope.

/** How often the ambient loops are redrawn. Twenty is three frames at 60Hz
 *  and six at 120Hz — an even step, no judder — and a third of the SVG
 *  rasterisations of running them at the display rate. */
export const AMBIENT_FPS = 20
export const AMBIENT_STEP_MS = 1000 / AMBIENT_FPS

/** How long after the last scroll event the loops stay frozen: a scroll
 *  reports every frame, so this is "one missed report and a bit". */
export const SCROLL_HOLD_MS = 90

/** A frame longer than this (the app was suspended, the thread stalled)
 *  moves the clock on by this much only, so nothing leaps. */
export const MAX_FRAME_MS = 100

/** Ambient time in ms, quantised to AMBIENT_STEP_MS. The one input every
 *  ambient mapper reads. */
export const ambientClock: SharedValue<number> = makeMutable(0)
/** The frame callback's own timestamp, every frame, held or not. */
export const ambientNow: SharedValue<number> = makeMutable(0)
/** When a list last reported a scroll, on ambientNow's timeline. */
export const lastScrollAt: SharedValue<number> = makeMutable(-1e9)
/** 1 while the tab pager is under the finger or landing. */
export const pagerBusy: SharedValue<number> = makeMutable(0)
/** 1 while the app is in the foreground. */
export const appActive: SharedValue<number> = makeMutable(1)
/** 1 under Reduce Motion: the clock stands still and every loop holds frame zero. */
export const motionReduced: SharedValue<number> = makeMutable(0)
/** Unquantised running total of live time. */
const ambientElapsed: SharedValue<number> = makeMutable(0)

/** Whether the clock stands still this frame. */
export function ambientHeld(
  now: number,
  lastScroll: number,
  pager: number,
  active: number,
  reduced: number,
): boolean {
  'worklet'
  return reduced > 0 || active <= 0 || pager > 0 || now - lastScroll < SCROLL_HOLD_MS
}

/** The clock reading for a running total: the last whole step. */
export function quantize(elapsed: number): number {
  'worklet'
  return Math.floor(elapsed / AMBIENT_STEP_MS) * AMBIENT_STEP_MS
}

/** One frame of the clock: the frame's timestamp and the time since the
 *  previous one, from the frame callback. Writes the clock only when it
 *  reaches a new step, so the mappers run at AMBIENT_FPS, not at the
 *  display's rate. */
export function advanceAmbient(timestamp: number, sincePrevious: number): void {
  'worklet'
  ambientNow.value = timestamp
  if (
    ambientHeld(timestamp, lastScrollAt.value, pagerBusy.value, appActive.value, motionReduced.value)
  ) {
    return
  }
  const dt = Math.max(0, Math.min(MAX_FRAME_MS, sincePrevious))
  const elapsed = ambientElapsed.value + dt
  ambientElapsed.value = elapsed
  const q = quantize(elapsed)
  if (q !== ambientClock.value) ambientClock.value = q
}

/** A list scrolled: hold the loops. Call from a scroll worklet, every event. */
export function stampScroll(): void {
  'worklet'
  lastScrollAt.value = ambientNow.value
}

/* -------------------------------- loops -------------------------------- */

/** One loop: a phase 0→1 every `period` ms, starting `delay` ms after it
 *  first wakes; `on` is false under Reduce Motion or when the caller wants
 *  it still, and then it holds frame zero. */
export type LoopSpec = { id: string; period: number; delay: number; on: boolean }

/** The key of a loop that is asleep: frame zero, and nothing to update. */
export const ASLEEP = -1

type Slot = { t0: number; key: number; props: object | null }

let seq = 0
/** A fresh loop id. JS thread only (the counter lives there). */
export function loopId(): string {
  return `loop${++seq}`
}

/** Per-loop state on whichever runtime the mapper runs in — the UI runtime
 *  in the app, this one under Jest. Kept on the global, not in a shared
 *  value: a mapper that wrote a shared value it also reads would mark
 *  itself dirty and run again. */
function slots(): Record<string, Slot> {
  'worklet'
  const g = globalThis as unknown as { __mbtAmbientSlots?: Record<string, Slot> }
  return g.__mbtAmbientSlots ?? (g.__mbtAmbientSlots = {})
}

function slot(id: string): Slot {
  'worklet'
  const all = slots()
  return all[id] ?? (all[id] = { t0: -1, key: NaN, props: null })
}

/** Forget a loop (its component unmounted). */
export function releaseSlot(id: string): void {
  'worklet'
  delete slots()[id]
}

/**
 * Which frame the loop is on at clock reading `clock`: ASLEEP when it is
 * off or its gate is shut, 0 while its delay runs, else the clock reading
 * itself. Two calls with the same key draw the same frame — that is what
 * memoProps compares.
 */
export function loopKey(loop: LoopSpec, clock: number, gateOpen: boolean): number {
  'worklet'
  if (!loop.on || !gateOpen) return ASLEEP
  const s = slot(loop.id)
  if (s.t0 < 0) s.t0 = clock
  return clock - s.t0 < loop.delay ? 0 : clock
}

/** The phase 0→1 of the loop for a key from loopKey. */
export function loopPhase(loop: LoopSpec, key: number): number {
  'worklet'
  if (key <= 0) return 0
  const local = key - slot(loop.id).t0 - loop.delay
  if (local <= 0 || loop.period <= 0) return 0
  return (local % loop.period) / loop.period
}

/**
 * The props for `key`, built once per key: the same object comes back until
 * the key changes. Reanimated compares a mapper's result to the previous one
 * with shallowEqual and sends nothing native when they match — so a loop
 * that is asleep, or waiting out its delay, costs no SVG redraw. `build`
 * runs on the UI thread: a closure made inside the mapper is fine.
 */
export function memoProps<P extends object>(id: string, key: number, build: () => P): P {
  'worklet'
  const s = slot(id)
  if (s.props !== null && s.key === key) return s.props as P
  const props = build()
  s.key = key
  s.props = props
  return props
}
