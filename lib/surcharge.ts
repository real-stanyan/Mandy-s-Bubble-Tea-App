import {
  CARD_SURCHARGE_BPS,
  PH_SURCHARGE_BPS,
  PLATFORM_FEE_BPS,
} from './constants'

// All helpers operate in integer cents and use Math.round to match Square's
// SUBTOTAL_PHASE round-half-up calculation (server is authoritative; client
// uses these for display + Apple/Google Pay sheet pre-compute).

export function cardSurcharge(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0
  return Math.round((subtotalCents * Number(CARD_SURCHARGE_BPS)) / 10000)
}

export function platformFee(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0
  return Math.round((subtotalCents * Number(PLATFORM_FEE_BPS)) / 10000)
}

export function publicHolidaySurcharge(baseCents: number): number {
  if (baseCents <= 0) return 0
  return Math.round((baseCents * Number(PH_SURCHARGE_BPS)) / 10000)
}
