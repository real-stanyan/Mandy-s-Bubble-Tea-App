// What the floating mini cart bar should do when the cart count changes.
//
// Split out of the component because this is a state machine, and the bug it
// was hiding was a state-machine bug: the old version parked opacity at 0 when
// the count hit zero and restored it only on a `prev === 0 -> curr > 0` edge.
// Miss that one edge — a stale previous value, a transition the runtime never
// delivered — and the bar rendered forever at opacity 0 with a full cart
// behind it (2026-09-07).
//
// The rule that replaces it: an empty cart parks the RESTING pose, not the
// hidden one. Hidden is then only ever a transient the entrance animates out
// of, so no missed edge can strand the bar. `restingPose` below is the
// invariant, and mini-cart.test.ts holds it down.

export type MiniCartCue = {
  /** Slide up + fade in: the cart just went from empty to holding something. */
  enter: boolean
  /** Bump the bar and the badge: a drink just joined an already-visible cart. */
  bump: boolean
  /**
   * Snap opacity/translateY back to the resting pose with no animation. The
   * bar unmounts at zero anyway (an exit animation was never on screen long
   * enough to be seen), so this is about what the NEXT appearance inherits.
   */
  rest: boolean
}

/**
 * @param prev the previous item count, or null on the first run after mount
 * @param curr the current item count
 */
export function miniCartCue(prev: number | null, curr: number): MiniCartCue {
  if (curr === 0) return { enter: false, bump: false, rest: true }
  // First run after mount: the shared values are already at rest, and replaying
  // an entrance for a cart restored from storage would be a lie about what just
  // happened.
  if (prev === null) return { enter: false, bump: false, rest: false }
  return { enter: prev === 0, bump: curr > prev, rest: false }
}

/**
 * The opacity the bar settles at once every animation a cue starts has
 * finished. Used by the test to assert the property that matters: a cart with
 * anything in it is never left invisible, whatever sequence of counts got it
 * there — including sequences with counts the runtime skipped.
 */
export function restingOpacity(counts: readonly number[]): number {
  let opacity = 1
  let prev: number | null = null
  for (const curr of counts) {
    const cue = miniCartCue(prev, curr)
    // `rest` snaps to 1; `enter` dips to 0 and animates back to 1; a bump only
    // touches scale. Nothing in the table can settle at 0.
    if (cue.rest || cue.enter) opacity = 1
    prev = curr
  }
  return opacity
}
