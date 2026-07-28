// The one quote/order failure the customer has to be told about.
//
// Every other failure is safe to swallow — signed out, Square slow, offline —
// because checkout falls back to the cart's own subtotal, which is too high
// rather than too low, and the order still goes through. A stale cart is
// different: the server has refused to price it (409), and /api/orders refuses
// to create it for the same reason. Falling back silently shows a believable
// total for an order that cannot be placed, and the customer has no way to
// work out why (web repo #90 / this repo's #94).
//
// Duck-typed on `status` + `body` rather than importing ApiError from lib/api,
// which drags in Expo modules. These are pure functions and the tests should
// be able to say so.

export type StaleCart = {
  reason: 'stale-cart'
  /** Server-authored, customer-facing. Don't paraphrase it here. */
  message: string
  variationIds: string[]
}

const FALLBACK_MESSAGE = 'Some items in your cart are no longer on the menu.'

/**
 * A stale-cart refusal, or null for every other failure.
 *
 * Keyed on `unknownVariationIds` being present, NOT on the status alone:
 * /api/orders already answers 409 for a sold-out item and for a duplicate
 * submit, and neither of those means the cart is stale.
 */
export function staleCartFrom(error: unknown): StaleCart | null {
  if (!error || typeof error !== 'object') return null
  const { status, body } = error as { status?: unknown; body?: unknown }
  if (status !== 409) return null
  if (!body || typeof body !== 'object') return null
  const { unknownVariationIds, error: message } = body as {
    unknownVariationIds?: unknown
    error?: unknown
  }
  if (!Array.isArray(unknownVariationIds)) return null
  return {
    reason: 'stale-cart',
    message: typeof message === 'string' && message ? message : FALLBACK_MESSAGE,
    variationIds: unknownVariationIds.filter(
      (id): id is string => typeof id === 'string',
    ),
  }
}
