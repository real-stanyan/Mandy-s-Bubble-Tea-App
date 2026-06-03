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
