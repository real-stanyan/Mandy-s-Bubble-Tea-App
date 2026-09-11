// Fly-to-bag: a dot leaves the "Add to cart" button, arcs up, and lands on
// the bag capsule in the dock (lib/motion/cart-dock says where). The arc is pure maths so the curve is testable; the
// component only drives `t` from 0 to 1.

export type Point = { x: number; y: number }

export type FlightFrame = { x: number; y: number; scale: number; opacity: number }

export const FLY_MS = 720
export const FLY_DOT = 14

/**
 * Where the dot is at progress `t` (0..1) between `from` and `to`.
 * Marked as a worklet so Reanimated can run it on the UI thread.
 */
export function flightFrame(t: number, from: Point, to: Point): FlightFrame {
  'worklet'
  const p = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = to.x - from.x
  const dy = to.y - from.y
  // Lift scales with distance so a short hop still arcs and a long one
  // doesn't shoot off the top of the screen.
  const lift = 90 + Math.abs(dx) * 0.15
  const arc = Math.sin(Math.PI * p)
  return {
    x: from.x + dx * p,
    y: from.y + dy * p - lift * arc,
    // Swells a touch on the way up (≈1.1 mid-flight), then shrinks into the
    // bag — the cubic keeps the shrink late so the swell is actually seen.
    scale: 1 + 0.2 * arc - 0.7 * p * p * p,
    opacity: p > 0.92 ? 1 - (p - 0.92) / 0.08 : 1,
  }
}
