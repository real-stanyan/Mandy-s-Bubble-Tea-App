import { checkoutCta } from './checkout-cta'

/**
 * The rule this pins: the pay bar never describes an order the server hasn't
 * priced yet.
 *
 * Web hit the sharp version of this (mandys_bubble_tea #147): tapping the
 * reward stepper and then Pay inside the 250ms quote debounce opened an Apple
 * Pay sheet for a pickup order the server then priced at $0. The app's pay
 * flow can't make that mistake — it opens the sheet only after the redeem, off
 * the server's number — but the *copy* still has to hold its tongue until the
 * quote lands, or it promises "Redeem free drink" on a cart that may not be
 * free.
 */

const base = {
  accepting: true,
  nextOpenLabel: '10:30am',
  busy: false,
  quoteStale: false,
  nothingToPay: false,
  payMethodLabel: 'Pay with Apple Pay',
}

describe('checkoutCta', () => {
  it('names the pay method and shows the amount in the ordinary case', () => {
    expect(checkoutCta(base)).toEqual({
      eyebrow: 'Pay with Apple Pay',
      title: 'Place order',
      showSpinner: false,
    })
  })

  it('says the store is closed before anything else', () => {
    const cta = checkoutCta({
      ...base,
      accepting: false,
      quoteStale: true,
      nothingToPay: true,
    })
    expect(cta.eyebrow).toBe('Closed')
    expect(cta.title).toBe('Opens 10:30am')
    expect(cta.showSpinner).toBe(false)
  })

  it('shows "Updating total…" while the quote is catching up', () => {
    const cta = checkoutCta({ ...base, quoteStale: true })
    expect(cta.title).toBe('Updating total…')
    expect(cta.showSpinner).toBe(true)
  })

  it('does not promise the redeem wording before the quote lands', () => {
    // The window right after tapping the reward stepper: nothingToPay is still
    // computed off the PREVIOUS cart's quote, so it cannot be believed yet.
    const cta = checkoutCta({ ...base, quoteStale: true, nothingToPay: true })
    expect(cta.title).toBe('Updating total…')
    expect(cta.title).not.toContain('Redeem')
  })

  it('flips to the redeem wording once the quote says nothing is owed', () => {
    const cta = checkoutCta({ ...base, nothingToPay: true })
    expect(cta.eyebrow).toBe('Loyalty reward')
    expect(cta.title).toBe('Redeem free drink')
  })

  it('drops the pay-method name when no card is charged', () => {
    // A $0 order charges nothing, so "Pay with Apple Pay" would be a lie.
    const cta = checkoutCta({ ...base, nothingToPay: true })
    expect(cta.eyebrow).not.toContain('Apple Pay')
  })

  it('keeps the redeem wording while the order is being placed', () => {
    const cta = checkoutCta({ ...base, nothingToPay: true, busy: true })
    expect(cta.title).toBe('Redeem free drink')
    expect(cta.showSpinner).toBe(true)
  })

  it('spins on the amount while an ordinary order is in flight', () => {
    expect(checkoutCta({ ...base, busy: true }).showSpinner).toBe(true)
  })
})
