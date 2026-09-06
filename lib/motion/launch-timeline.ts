// The launch screen's clock, in one place so the cup, the wordmark and the
// dismissal all read the same numbers — and so the numbers can be tested
// without mounting a Reanimated tree.
//
// Sequence (ms from mount):
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
  exitMs: 380,
} as const

export type LaunchDismissInput = {
  /** ms since the launch screen mounted. */
  elapsedMs: number
  /** Auth has settled (or failed) — the app underneath is ready to be seen. */
  ready: boolean
  reducedMotion: boolean
}

/**
 * How long to wait before starting the exit, or null to keep waiting for
 * `ready`. Never negative; never longer than what's left of maxShowMs.
 */
export function launchDismissDelay({ elapsedMs, ready, reducedMotion }: LaunchDismissInput): number | null {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const capLeft = Math.max(0, LAUNCH.maxShowMs - elapsed)
  if (capLeft === 0) return 0
  if (!ready) return null
  const min = reducedMotion ? LAUNCH.reducedMinShowMs : LAUNCH.minShowMs
  return Math.min(capLeft, Math.max(0, min - elapsed))
}

/** When pearl `i` (0-based) starts its drop. */
export function pearlDelayMs(i: number): number {
  return LAUNCH.pearlDelayMs + Math.max(0, i) * LAUNCH.pearlStaggerMs
}
