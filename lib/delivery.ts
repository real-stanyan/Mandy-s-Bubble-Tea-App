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

export function deliveryFeesPending(
  fulfillment: FulfillmentType,
  isFreeRedeem: boolean,
  quoteKind: QuoteState['kind'],
): boolean {
  return fulfillment === 'DELIVERY' && !isFreeRedeem && quoteKind !== 'ok'
}

// Cents to add to the order total for delivery (fee + 5% service), only when a
// quote has resolved and the order isn't fully covered by a reward.
export function deliveryAddOnCents(
  fulfillment: FulfillmentType,
  isFreeRedeem: boolean,
  quote: QuoteState,
): number {
  if (fulfillment !== 'DELIVERY' || isFreeRedeem) return 0
  if (quote.kind !== 'ok') return 0
  return quote.feeCents + quote.serviceFeeCents
}

// ETA copy for the live tracking sheet. Prefers the server's Google
// Directions duration (re-routed as the driver moves); falls back to the
// static range when no route is available yet.
export function etaText(etaSeconds: number | null | undefined): string {
  if (etaSeconds == null || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return '~15–25 min'
  }
  return `~${Math.max(1, Math.ceil(etaSeconds / 60))} min`
}
