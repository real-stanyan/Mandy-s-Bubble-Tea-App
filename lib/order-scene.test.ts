import { describe, expect, it } from '@jest/globals'
import { orderScene } from './order-scene'

describe('orderScene — which picture the order screen draws', () => {
  const pickup = (state: string, scheduledAhead = false) =>
    orderScene({ state, isDelivery: false, scheduledAhead })

  it('walks the pickup states in the order a drink is actually made', () => {
    expect(pickup('OPEN', true)).toBe('received')
    expect(pickup('OPEN')).toBe('preparing')
    expect(pickup('READY')).toBe('ready')
    expect(pickup('COMPLETED')).toBe('done')
  })

  it('draws nothing over a cancelled order', () => {
    // The copy under a cancel is doing careful work; a counter full of drinks
    // beside it reads as the app not having noticed.
    expect(pickup('CANCELED')).toBeNull()
    expect(orderScene({ state: 'CANCELED', isDelivery: true })).toBeNull()
  })

  it('makes a delivery order like any other, then hands the screen to the map', () => {
    const d = (dispatchStep: number) => orderScene({ state: 'OPEN', isDelivery: true, dispatchStep })
    expect(d(0)).toBe('preparing')
    expect(d(1)).toBe('preparing')
    // Out of the shop: the live map owns the screen from here.
    expect(d(2)).toBeNull()
    // Delivered: the doorstep, which at that step is what just happened.
    expect(d(3)).toBe('delivered')
    expect(orderScene({ state: 'COMPLETED', isDelivery: true })).toBe('delivered')
  })

  it('holds Received only while the scheduled time is still ahead', () => {
    expect(pickup('OPEN', true)).toBe('received')
    expect(pickup('OPEN', false)).toBe('preparing')
    // A scheduled order that is already Ready is Ready — the flag never
    // outranks the counter having actually made it.
    expect(orderScene({ state: 'READY', isDelivery: false, scheduledAhead: true })).toBe('ready')
  })
})
