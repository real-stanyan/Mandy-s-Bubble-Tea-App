// What the customer is allowed to read when a payment fails.
//
// `ApiError.message` is `API <status>: <raw body>`, a shape meant for logs.
// Checkout rendered it straight into the Payment Failed dialog, so on
// 2026-09-06 a customer was shown, five times:
//
//   API 400: {"ok":false,"error":"The order must be OPEN to be paid."}
//
// Every one of our API routes answers a failure as `{ok:false, error:"..."}`
// where that string is already written for the customer. Use it, and keep the
// JSON, the status code and the word "API" out of the dialog.
//
// Duck-typed on `status` + `body` rather than importing ApiError from
// lib/api, which drags in Expo modules — same reasoning as lib/stale-cart.ts,
// and it keeps this unit-testable in plain node.

export type PaymentFailure = {
  /** Customer-facing. Server-authored when the server had something to say. */
  message: string
  /**
   * The order can never be paid — it was cancelled or expired (409
   * orderNotOpen from /api/payment). Retrying against it is guaranteed to
   * fail, so checkout rotates its idempotency nonce first and the next tap
   * builds a genuinely new order.
   */
  orderNotOpen: boolean
}

const GENERIC = 'Something went wrong with your payment. Please try again.'

/** True when this looks like a network failure rather than a refusal. */
function isOffline(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : ''
  return /network request failed|timed out|fetch failed/i.test(msg)
}

export function paymentFailureFrom(error: unknown): PaymentFailure {
  const { status, body } = (error ?? {}) as { status?: unknown; body?: unknown }
  const serverMessage =
    body && typeof body === 'object'
      ? (body as { error?: unknown }).error
      : undefined
  const orderNotOpen =
    status === 409 &&
    !!body &&
    typeof body === 'object' &&
    (body as { orderNotOpen?: unknown }).orderNotOpen === true

  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return { message: serverMessage.trim(), orderNotOpen }
  }
  if (isOffline(error)) {
    return {
      message:
        "We couldn't reach the store — check your connection and try again. Nothing was charged.",
      orderNotOpen: false,
    }
  }
  // A non-JSON body (gateway HTML, empty 502) must not leak either.
  return { message: GENERIC, orderNotOpen }
}
