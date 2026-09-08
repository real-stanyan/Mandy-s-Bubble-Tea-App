import { checkoutCta, payBar } from './checkout-cta'

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

/**
 * The rule this pins: Google's button is drawn by Google or not at all.
 *
 * The Google Pay API review team rejected com.mandysbubbletea.app on
 * 2026-09-04 for a home-made brand-brown "Pay with Google Pay" pill. The
 * native PayButton fixed the live case, but the disabled case still faded
 * Google's black artwork to 40% — on this cream page that reads as a light
 * grey button on a light ground, which their don't-list calls out directly
 * ("Use a button color that's similar to the background"). Both failures are
 * the same rule: our chrome never stands in for, or paints over, theirs.
 */
const payBase = {
  method: 'google' as const,
  googleButtonAvailable: true,
  nothingToPay: false,
  blocked: false,
}

describe('payBar', () => {
  it('draws Google button when Google Pay is picked and payment can proceed', () => {
    expect(payBar(payBase)).toEqual({
      useGoogleButton: true,
      methodLabel: 'Pay with Google Pay',
    })
  })

  it('hands the bar back to our own pill while payment is blocked', () => {
    // Store closed, unlabelled cups, retired items — anything the customer has
    // to clear first. A faded Google button is not an option.
    expect(payBar({ ...payBase, blocked: true }).useGoogleButton).toBe(false)
  })

  it('never lets our own pill carry Google’s wordmark', () => {
    for (const state of [
      { ...payBase, blocked: true },
      { ...payBase, nothingToPay: true },
      { ...payBase, googleButtonAvailable: false },
    ]) {
      const bar = payBar(state)
      expect(bar.useGoogleButton).toBe(false)
      expect(bar.methodLabel).not.toContain('Google')
    }
  })

  it('keeps drawing our own pill for card and Apple Pay', () => {
    expect(payBar({ ...payBase, method: 'card' })).toEqual({
      useGoogleButton: false,
      methodLabel: 'Pay with Card',
    })
    expect(payBar({ ...payBase, method: 'apple' })).toEqual({
      useGoogleButton: false,
      methodLabel: 'Pay with Apple Pay',
    })
  })
})
