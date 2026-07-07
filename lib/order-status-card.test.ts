jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))
jest.mock('expo-notifications', () => ({
  registerTaskAsync: jest.fn(() => Promise.resolve()),
}))
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}))
jest.mock('@/modules/order-status-card', () => ({
  upsertOrderCard: jest.fn(() => true),
  cancelOrderCard: jest.fn(() => true),
}))

import { deliveryCardParams, pickupCardParams } from '@/lib/order-status-card'
import { extractPushData } from '@/lib/order-card-background'

describe('pickupCardParams', () => {
  it('walks the 3-step journey', () => {
    expect(pickupCardParams('received', '#OL1')).toMatchObject({
      title: 'Order received!',
      stepIndex: 0,
      stepCount: 3,
      ongoing: true,
      orderNumber: '#OL1',
    })
    expect(pickupCardParams('preparing', null)?.stepIndex).toBe(1)
    expect(pickupCardParams('ready', null)?.stepIndex).toBe(2)
  })

  it('terminal statuses remove the card', () => {
    expect(pickupCardParams('completed', null)).toBeNull()
    expect(pickupCardParams('canceled', null)).toBeNull()
  })
})

describe('deliveryCardParams', () => {
  it('walks the 4-step journey with the driver name', () => {
    expect(deliveryCardParams('pending', '#DE1')).toMatchObject({
      stepIndex: 0,
      stepCount: 4,
    })
    expect(deliveryCardParams('accepted', null, 'Rick')?.body).toContain('Rick')
    expect(deliveryCardParams('picked_up', null, null)?.body).toContain('Your driver')
    expect(deliveryCardParams('picked_up', null, '  ')?.body).toContain('Your driver')
  })

  it('terminal statuses remove the card', () => {
    expect(deliveryCardParams('delivered', null)).toBeNull()
    expect(deliveryCardParams('canceled', null)).toBeNull()
  })
})

describe('extractPushData', () => {
  const payload = {
    type: 'order-card',
    orderId: 'o1',
    fulfillment: 'pickup',
    status: 'ready',
  }

  it('reads a direct payload', () => {
    expect(extractPushData(payload)).toMatchObject({ orderId: 'o1' })
  })

  it('reads the killed-state shape (JSON string under body)', () => {
    expect(extractPushData({ body: JSON.stringify(payload) })).toMatchObject({
      status: 'ready',
    })
  })

  it('reads a nested data object', () => {
    expect(extractPushData({ data: payload })).toMatchObject({ orderId: 'o1' })
    expect(extractPushData({ data: { body: JSON.stringify(payload) } })).toMatchObject({
      orderId: 'o1',
    })
  })

  it('rejects foreign payloads', () => {
    expect(extractPushData({ kind: 'ready' })).toBeNull()
    expect(extractPushData('nope')).toBeNull()
    expect(extractPushData(null)).toBeNull()
  })
})
