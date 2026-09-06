import { paymentFailureFrom } from './payment-failure'

// The dialog on 2026-09-06 read, verbatim:
//   API 400: {"ok":false,"error":"The order must be OPEN to be paid."}
// Nothing in this module may ever produce that shape again.

const apiError = (status: number, body: unknown) =>
  Object.assign(new Error(`API ${status}: ${JSON.stringify(body)}`), {
    name: 'ApiError',
    status,
    body,
  })

describe('paymentFailureFrom', () => {
  it('shows the server sentence, not the API/JSON wrapper', () => {
    const failure = paymentFailureFrom(
      apiError(400, { ok: false, error: 'The order must be OPEN to be paid.' }),
    )
    expect(failure.message).toBe('The order must be OPEN to be paid.')
    expect(failure.message).not.toMatch(/API |[{}]|ok":/)
  })

  it('flags the cancelled-order refusal so checkout can rotate its nonce', () => {
    const failure = paymentFailureFrom(
      apiError(409, {
        ok: false,
        error:
          'This order is no longer open — it was cancelled or has expired. Please go back to your cart and place the order again.',
        orderNotOpen: true,
        orderState: 'CANCELED',
      }),
    )
    expect(failure.orderNotOpen).toBe(true)
    expect(failure.message).toMatch(/no longer open/)
  })

  it('does not flag other 409s (sold out, duplicate submit, stale cart)', () => {
    expect(
      paymentFailureFrom(apiError(409, { ok: false, error: 'Sold out: Mango Slushy.' }))
        .orderNotOpen,
    ).toBe(false)
  })

  it('passes a declined card through unchanged', () => {
    const failure = paymentFailureFrom(
      apiError(402, {
        ok: false,
        error:
          'Your card was declined and no money was taken. Please try a different card.',
        status: 'FAILED',
      }),
    )
    expect(failure.message).toMatch(/declined/)
    expect(failure.orderNotOpen).toBe(false)
  })

  it('explains an offline failure instead of echoing the fetch error', () => {
    const failure = paymentFailureFrom(new Error('Network request failed'))
    expect(failure.message).toMatch(/connection/i)
    expect(failure.message).toMatch(/nothing was charged/i)
  })

  it('falls back to a generic sentence for a non-JSON body', () => {
    const failure = paymentFailureFrom(
      Object.assign(new Error('API 502: <html>Bad Gateway</html>'), {
        status: 502,
        body: '<html>Bad Gateway</html>',
      }),
    )
    expect(failure.message).toBe(
      'Something went wrong with your payment. Please try again.',
    )
    expect(failure.message).not.toMatch(/html|502/)
  })

  it('survives a thrown non-error', () => {
    expect(paymentFailureFrom(undefined).message).toMatch(/went wrong/)
    expect(paymentFailureFrom('boom').orderNotOpen).toBe(false)
  })

  it('ignores an empty server message rather than showing a blank dialog', () => {
    expect(paymentFailureFrom(apiError(500, { ok: false, error: '   ' })).message).toBe(
      'Something went wrong with your payment. Please try again.',
    )
  })
})
