// Numbers that arrive rather than appear: stars, drinks, rewards tick up
// from where they were to where they are. Pure maths, so the curve and the
// rounding can be tested without a component.

export const COUNT_UP_MS = 900

/** Ease-out cubic — fast start, soft landing; the same curve the web's CountUp uses. */
export function easeOutCubic(p: number): number {
  const t = Math.min(1, Math.max(0, p))
  return 1 - Math.pow(1 - t, 3)
}

/**
 * The integer to show at progress `p` (0..1) on the way from `from` to `to`.
 * Integers only: a loyalty balance never reads 5.4. Ends exactly on `to`.
 */
export function countUpFrame(from: number, to: number, p: number): number {
  const a = Number.isFinite(from) ? from : 0
  const b = Number.isFinite(to) ? to : 0
  if (p >= 1) return Math.round(b)
  return Math.round(a + (b - a) * easeOutCubic(p))
}
