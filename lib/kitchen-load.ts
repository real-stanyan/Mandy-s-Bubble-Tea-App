// How long until an ASAP pickup is ready, from how busy the kitchen is
// right now. Mirrors the web's src/lib/kitchen-load.ts — the server
// measures the queue (cups still to be made, via /api/store-status) and
// both clients turn it into the same bracketed promise.
//
// "~10 min" used to be a constant. Stan's brackets (2026-09-04):
//   quiet   → 2–3 min
//   medium  → 5–7 min
//   busy    → 7–10 min

export type KitchenLevel = 'quiet' | 'medium' | 'busy'

export type KitchenLoad = {
  level: KitchenLevel
  /** Cups in the make queue when this was measured. */
  pendingCups: number
  minMinutes: number
  maxMinutes: number
  /** "2–3 min" — the customer-facing range. */
  label: string
}

export const QUIET_MAX_CUPS = 3
export const MEDIUM_MAX_CUPS = 10

const RANGES: Record<KitchenLevel, [number, number]> = {
  quiet: [2, 3],
  medium: [5, 7],
  busy: [7, 10],
}

export function kitchenLevelFor(pendingCups: number): KitchenLevel {
  if (pendingCups <= QUIET_MAX_CUPS) return 'quiet'
  if (pendingCups <= MEDIUM_MAX_CUPS) return 'medium'
  return 'busy'
}

export function kitchenLoadFor(pendingCups: number): KitchenLoad {
  const cups = Math.max(0, Math.floor(pendingCups))
  const level = kitchenLevelFor(cups)
  const [minMinutes, maxMinutes] = RANGES[level]
  return { level, pendingCups: cups, minMinutes, maxMinutes, label: `${minMinutes}–${maxMinutes} min` }
}

/** Shown before the first poll and when the server couldn't measure the
 *  queue. The middle bracket — a customer is early rather than late. */
export const KITCHEN_LOAD_FALLBACK: KitchenLoad = kitchenLoadFor(QUIET_MAX_CUPS + 1)

/** "quiet right now" / "a little busy right now" / "busy right now". */
export function kitchenMoodLabel(level: KitchenLevel): string {
  switch (level) {
    case 'quiet':
      return 'quiet right now'
    case 'medium':
      return 'a little busy right now'
    case 'busy':
      return 'busy right now'
  }
}
