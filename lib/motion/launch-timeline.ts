// The launch screen's clock, in one place so the cup, the wordmark and the
// dismissal all read the same numbers — and so the numbers can be tested
// without mounting a Reanimated tree.
//
// Sequence (ms from the start of the timeline, which holds on the splash's
// own colour and an empty cup until the first frames come calm, holdMaxMs
// at most — see nextCalm):
//   0        native splash colour (#2A1E14) starts lifting to the page ground
//   350      liquid starts pouring, reaches the fill line at 1450
//   1250     pearls drop in, 70ms apart
//   1450     wordmark rises under the cup
//   2200     earliest the screen may leave (the pour is never cut short)
//   10000    latest it may stay, whatever auth is doing (never trap the app)

export const LAUNCH = {
  /** Native splash → page ground colour crossfade. */
  bgFadeMs: 500,
  pourDelayMs: 350,
  pourMs: 1100,
  pearlDelayMs: 1250,
  pearlStaggerMs: 70,
  pearlCount: 7,
  wordmarkDelayMs: 1450,
  wordmarkMs: 420,
  /** One wave period scrolls past in this long — the liquid's idle breath. */
  waveMs: 1100,
  minShowMs: 2200,
  /** Reduce Motion: no pour to wait for, just a beat so it isn't a flash. */
  reducedMinShowMs: 600,
  maxShowMs: 10000,
  /** Once auth settles, the app underneath draws what it was waiting on —
   *  the member card, the order in progress — and the exit waits this long
   *  so it does not fade out over that commit. */
  readySettleMs: 250,
  exitMs: 380,
  /** The hold before the timeline: a frame this close to the one before it
   *  means the UI thread is free again (one missed 60 Hz frame still is)… */
  calmFrameMs: 34,
  /** …this many of them in a row start the timeline… */
  calmFrames: 2,
  /** …and it never holds longer than this, calm or not. */
  holdMaxMs: 900,
} as const

/**
 * The count of calm frames in a row after a frame that came `sincePrevious`
 * ms after the last one (null for the first). The first mount and draw of
 * everything under the launch screen take the UI thread for its first few
 * hundred ms; a timeline started at mount played its opening beats in frames
 * nobody saw, then jumped. So the launch waits for calm frames first.
 */
export function nextCalm(calm: number, sincePrevious: number | null): number {
  'worklet'
  return sincePrevious !== null && sincePrevious < LAUNCH.calmFrameMs ? calm + 1 : 0
}

/** Whether the held timeline may start: enough calm frames in a row, or
 *  held for long enough already. */
export function timelineMayStart(calm: number, heldMs: number): boolean {
  'worklet'
  return calm >= LAUNCH.calmFrames || heldMs >= LAUNCH.holdMaxMs
}

export type LaunchDismissInput = {
  /** ms since the launch screen mounted. */
  elapsedMs: number
  /** Auth has settled (or failed) — the app underneath is ready to be seen. */
  ready: boolean
  reducedMotion: boolean
}

/**
 * How long to wait before starting the exit, or null to keep waiting for
 * `ready`. Never sooner than readySettleMs, so the app underneath gets a
 * beat to draw what auth just gave it; never longer than what's left of
 * maxShowMs.
 */
export function launchDismissDelay({ elapsedMs, ready, reducedMotion }: LaunchDismissInput): number | null {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const capLeft = Math.max(0, LAUNCH.maxShowMs - elapsed)
  if (capLeft === 0) return 0
  if (!ready) return null
  const min = reducedMotion ? LAUNCH.reducedMinShowMs : LAUNCH.minShowMs
  return Math.min(capLeft, Math.max(LAUNCH.readySettleMs, min - elapsed))
}

/** When pearl `i` (0-based) starts its drop. */
export function pearlDelayMs(i: number): number {
  return LAUNCH.pearlDelayMs + Math.max(0, i) * LAUNCH.pearlStaggerMs
}
