import { deriveDeliverySteps, stepVisual, DELIVERY_STEPS } from './dispatch-steps'

describe('deriveDeliverySteps (aligned with web order-status-ui.ts)', () => {
  it('exposes the 4 delivery milestones', () => {
    expect([...DELIVERY_STEPS]).toEqual(['Placed', 'Accepted', 'Picked up', 'Delivered'])
  })

  it('pending → Finding your driver, amber, step 0', () => {
    const ui = deriveDeliverySteps({ state: 'PROPOSED', dispatchStatus: 'pending' })
    expect(ui.kind).toBe('active')
    expect(ui.heading).toBe('Finding your driver')
    expect(ui.tone).toBe('amber')
    expect(ui.stepIndex).toBe(0)
    expect(ui.pillLabel).toBe('Finding driver')
  })

  it('missing dispatch row (null) defaults to pending copy', () => {
    const ui = deriveDeliverySteps({ state: 'PROPOSED', dispatchStatus: null })
    expect(ui.heading).toBe('Finding your driver')
    expect(ui.stepIndex).toBe(0)
  })

  it('accepted → Driver on the way, amber, step 1, driver name in body', () => {
    const ui = deriveDeliverySteps({
      state: 'PROPOSED',
      dispatchStatus: 'accepted',
      driverName: 'Rick',
    })
    expect(ui.heading).toBe('Driver on the way')
    expect(ui.body).toBe('Rick is heading to the shop to collect your order.')
    expect(ui.tone).toBe('amber')
    expect(ui.stepIndex).toBe(1)
    expect(ui.pillLabel).toBe('Driver assigned')
  })

  it('accepted without a driver name falls back to generic copy', () => {
    const ui = deriveDeliverySteps({ state: 'PROPOSED', dispatchStatus: 'accepted' })
    expect(ui.body).toBe('Your driver is heading to the shop to collect your order.')
  })

  it('picked_up → Out for Delivery!, green, step 2', () => {
    const ui = deriveDeliverySteps({ state: 'PREPARED', dispatchStatus: 'picked_up' })
    expect(ui.heading).toBe('Out for Delivery!')
    expect(ui.tone).toBe('green')
    expect(ui.stepIndex).toBe(2)
  })

  it('PREPARED fulfillment recovers picked_up when dispatch is missing/pending', () => {
    expect(
      deriveDeliverySteps({ state: 'PREPARED', dispatchStatus: null }).stepIndex,
    ).toBe(2)
    expect(
      deriveDeliverySteps({ state: 'PREPARED', dispatchStatus: 'pending' }).heading,
    ).toBe('Out for Delivery!')
    // but an explicit 'accepted' is NOT overridden by PREPARED
    expect(
      deriveDeliverySteps({ state: 'PREPARED', dispatchStatus: 'accepted' }).stepIndex,
    ).toBe(1)
  })

  it('delivered (dispatch) or COMPLETED (fulfillment) → completed, green, step 3', () => {
    for (const ui of [
      deriveDeliverySteps({ state: 'PREPARED', dispatchStatus: 'delivered' }),
      deriveDeliverySteps({ state: 'COMPLETED', dispatchStatus: null }),
    ]) {
      expect(ui.kind).toBe('completed')
      expect(ui.heading).toBe('Delivered')
      expect(ui.tone).toBe('green')
      expect(ui.stepIndex).toBe(3)
    }
  })

  it('CANCELED / FAILED → canceled, amber', () => {
    expect(deriveDeliverySteps({ state: 'CANCELED' }).kind).toBe('canceled')
    expect(deriveDeliverySteps({ state: 'FAILED' }).kind).toBe('canceled')
  })
})

describe('stepVisual (DeliveryTimeline node/bar rendering states)', () => {
  it('stepIndex 1: node 0 done, node 1 active w/ lit bar before it, rest idle', () => {
    expect(stepVisual(0, 1, false)).toEqual({ done: true, active: false, barLit: true })
    expect(stepVisual(1, 1, false)).toEqual({ done: false, active: true, barLit: false })
    expect(stepVisual(2, 1, false)).toEqual({ done: false, active: false, barLit: false })
    expect(stepVisual(3, 1, false)).toEqual({ done: false, active: false, barLit: false })
  })

  it('stepIndex 0 (S1): only first node active, nothing done, no bars lit', () => {
    expect(stepVisual(0, 0, false)).toEqual({ done: false, active: true, barLit: false })
    expect(stepVisual(1, 0, false)).toEqual({ done: false, active: false, barLit: false })
  })

  it('completed (S7): every node done incl. the last (also active), all bars lit', () => {
    for (let i = 0; i < 4; i++) {
      const v = stepVisual(i, 3, true)
      expect(v.done).toBe(true)
      expect(v.barLit).toBe(true)
    }
    expect(stepVisual(3, 3, true).active).toBe(true)
  })
})
