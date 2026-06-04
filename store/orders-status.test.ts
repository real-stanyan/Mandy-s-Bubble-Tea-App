// store/orders.ts pulls in lib/api (Supabase env) at module init — not
// needed for these pure helpers, so stub it out.
jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }))

import { effectiveOrderState, isUnfinished } from './orders'

// Dogfood fixture 2026-06-04: driver marked a self-delivery order picked up
// then delivered (fulfillment → PREPARED → COMPLETED), but the Square order
// itself stays OPEN until staff close the ticket in POS. The app mapped
// display state off order.state alone, so the delivered order showed
// "Order In Progress" forever and never left the Active list.

describe('effectiveOrderState', () => {
  it('promotes OPEN + fulfillment COMPLETED to COMPLETED (self-delivery delivered)', () => {
    expect(effectiveOrderState('OPEN', 'COMPLETED')).toBe('COMPLETED')
  })

  it('promotes OPEN + fulfillment PREPARED to READY', () => {
    expect(effectiveOrderState('OPEN', 'PREPARED')).toBe('READY')
  })

  it('keeps plain OPEN as OPEN', () => {
    expect(effectiveOrderState('OPEN', 'PROPOSED')).toBe('OPEN')
    expect(effectiveOrderState('OPEN', null)).toBe('OPEN')
  })

  it('passes terminal order states through regardless of fulfillment', () => {
    expect(effectiveOrderState('COMPLETED', 'COMPLETED')).toBe('COMPLETED')
    expect(effectiveOrderState('CANCELED', 'PREPARED')).toBe('CANCELED')
  })

  it('returns empty string for null state', () => {
    expect(effectiveOrderState(null, null)).toBe('')
  })
})

describe('isUnfinished', () => {
  it('delivered self-delivery order is finished even while order.state is OPEN', () => {
    expect(isUnfinished({ state: 'OPEN', fulfillmentState: 'COMPLETED' })).toBe(false)
  })

  it('OPEN order still being made or ready is unfinished', () => {
    expect(isUnfinished({ state: 'OPEN', fulfillmentState: 'PROPOSED' })).toBe(true)
    expect(isUnfinished({ state: 'OPEN', fulfillmentState: 'PREPARED' })).toBe(true)
    expect(isUnfinished({ state: 'OPEN', fulfillmentState: null })).toBe(true)
  })

  it('closed orders are finished', () => {
    expect(isUnfinished({ state: 'COMPLETED', fulfillmentState: null })).toBe(false)
    expect(isUnfinished({ state: 'CANCELED', fulfillmentState: null })).toBe(false)
  })
})
