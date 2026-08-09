import { formatPrice } from '@/lib/utils'

export const MIN_ORDER_CENTS = 1200

// Mirror of web src/lib/constants.ts DELIVERABLE_POSTCODES (server is authoritative;
// this is for instant client-side hints only).
export const DELIVERABLE_POSTCODES = ['4211', '4214', '4215', '4216', '4217', '4218'] as const

// Lowest tier free-at threshold ($35) - selector copy only.
export const FREE_OVER_CENTS = 3500

export const DELIVERY_FEE_NAME = 'Delivery Fee'
export const SERVICE_FEE_LABEL = 'Service Fee (5%)'

export const STORE_LAT = -27.966
export const STORE_LNG = 153.4115

export const DELIVERY_DRIVER = {
  name: 'Rick Zhang',
  phone: '+61404978238',
  phoneDisplay: '+61 404 978 238',
} as const

const ALLOWED = new Set<string>(DELIVERABLE_POSTCODES)

export function isDeliverablePostcode(pc: string | null | undefined): boolean {
  if (!pc) return false
  return ALLOWED.has(pc.trim())
}

export function isDeliveryEligible(drinksSubtotalCents: number): boolean {
  return drinksSubtotalCents >= MIN_ORDER_CENTS
}

// Selector subtitle text under "Delivery".
export function deliverySubtitle(drinksSubtotalCents: number): string {
  if (isDeliveryEligible(drinksSubtotalCents)) {
    return `free over ${formatPrice(FREE_OVER_CENTS)}`
  }
  const remaining = MIN_ORDER_CENTS - drinksSubtotalCents
  return `Add ${formatPrice(remaining)} to enable`
}

export type FulfillmentType = 'PICKUP' | 'DELIVERY'

export type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; feeCents: number; serviceFeeCents: number }
  | { kind: 'error'; message: string }

// Verbatim from web checkout/page.tsx reason map.
const REASON_COPY: Record<string, string> = {
  out_of_zone: "Sorry, we don't deliver to that postcode",
  closed: 'Delivery hours: 10:30am–10:30pm',
  min_order: 'Add more to qualify for delivery',
  auth: 'Sign in to get a delivery quote',
  invalid_body: 'Address looks invalid — try a fuller address',
  invalid_json: 'Address looks invalid — try a fuller address',
}

export function quoteReasonCopy(reason: string): string {
  return REASON_COPY[reason] ?? 'Delivery unavailable'
}

// "—" while a quote is pending, "FREE" at $0, else the formatted amount.
export function feeValueText(pending: boolean, cents: number): string {
  if (pending) return '—'
  if (cents === 0) return 'FREE'
  return formatPrice(cents)
}

// Delivery is chosen but the address quote hasn't resolved, so the fee rows
// have nothing trustworthy to show yet.
//
// Deliberately does NOT ask whether a loyalty reward covers the drinks. The
// reward covers drinks; a DELIVERY redeem still pays its delivery + service
// fees (the 2026-07-10 rule, and what app/checkout.tsx says above
// `isFreeRedeem`). Short-circuiting on a free redeem printed "FREE" against
// both fee rows while the address quote was still loading — a promise the
// order then broke at payment.
export function deliveryFeesPending(
  fulfillment: FulfillmentType,
  quoteKind: QuoteState['kind'],
): boolean {
  return fulfillment === 'DELIVERY' && quoteKind !== 'ok'
}

// ETA copy for the live tracking sheet, from the server's Google Directions
// duration (re-routed as the driver moves). Returns null when no live route
// data exists — callers hide the ETA UI rather than showing a made-up range
// (the pill/tile is honest: no data, no number).
export function etaText(etaSeconds: number | null | undefined): string | null {
  if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return null
  }
  return `~${Math.max(1, Math.ceil(etaSeconds / 60))} min`
}

// Straight-line driver→destination distance for the driver-row sub copy
// ("1.2 km away"). Haversine is plenty at suburb scale; null when either
// point is missing so callers fall back to generic copy — no fake numbers.
export function distanceKmText(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined,
): string | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const rad = (d: number) => (d * Math.PI) / 180
  const R = 6371 // km
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  const km = 2 * R * Math.asin(Math.sqrt(a))
  if (!Number.isFinite(km)) return null
  if (km < 0.95) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`
  return `${km.toFixed(1)} km away`
}
