// Scheduled pickup, App half — mirrors web's src/lib/pickup-schedule.ts.
// The server (/api/orders) is authoritative: it re-validates the offset
// against the live clock, so this module only decides what to OFFER.
//
// Brisbane is UTC+10 with no DST, so everything is offset arithmetic —
// deliberately no Intl, which differs between V8 and Hermes (same rule as
// components/home/helpers.ts).

/** Fixed pills, matching the web checkout: one tap, no time-picker edge
 *  cases, 30 minutes is the furthest anyone can book. */
export const PICKUP_OFFSET_OPTIONS = [10, 15, 20, 30] as const

const OPEN_MIN = 10 * 60 + 30 // 10:30 — mirrors home/helpers.ts
const CLOSE_MIN = 22 * 60 + 30 // 22:30

function brisbaneMinutes(now: Date): number {
  const bne = new Date(now.getTime() + 10 * 60 * 60 * 1000)
  return bne.getUTCHours() * 60 + bne.getUTCMinutes()
}

/** Offsets whose pickup time still lands before close (10:30pm Brisbane).
 *  At 10:05pm the 30-minute pill would promise a locked shop — it
 *  disappears instead. */
export function availablePickupOffsets(now: Date = new Date()): number[] {
  const minutes = brisbaneMinutes(now)
  return PICKUP_OFFSET_OPTIONS.filter((offset) => minutes + offset <= CLOSE_MIN)
}

/** Brisbane wall-clock label ("5:21pm") for a moment. */
export function brisbaneClockLabel(at: Date): string {
  const bne = new Date(at.getTime() + 10 * 60 * 60 * 1000)
  const h24 = bne.getUTCHours()
  const m = bne.getUTCMinutes()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`
}

/** The clock time a pickup this many minutes from `now` lands on. */
export function pickupClockLabel(offsetMinutes: number, now: Date): string {
  return brisbaneClockLabel(new Date(now.getTime() + offsetMinutes * 60 * 1000))
}
