// live-activity-sync — token upload dedupe/rotation + start/update/end
// orchestration against a mocked native bridge and mocked apiFetch.

import {
  _resetLiveActivitySyncForTests,
  handleActivityPushToken,
  startActivityForPlacedOrder,
  syncDeliveryTracking,
  syncFromOrderHistory,
} from './live-activity-sync'
import {
  endOrderActivity,
  startOrderActivity,
  updateOrderActivity,
} from '@/modules/order-live-activity'
import { apiFetch } from '@/lib/api'
import type { OrderHistoryItem } from '@/store/orders'

jest.mock('@/modules/order-live-activity', () => ({
  addOrderActivityPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  startOrderActivity: jest.fn(),
  updateOrderActivity: jest.fn(),
  endOrderActivity: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>
const startMock = startOrderActivity as jest.MockedFunction<typeof startOrderActivity>
const updateMock = updateOrderActivity as jest.MockedFunction<typeof updateOrderActivity>
const endMock = endOrderActivity as jest.MockedFunction<typeof endOrderActivity>

beforeEach(() => {
  _resetLiveActivitySyncForTests()
  apiFetchMock.mockReset()
  startMock.mockReset().mockResolvedValue('activity-1')
  updateMock.mockReset().mockResolvedValue(true)
  endMock.mockReset().mockResolvedValue(true)
})

describe('handleActivityPushToken (token upload)', () => {
  it('uploads the token once and dedupes identical re-emissions', async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock).toHaveBeenCalledWith('/api/orders/o1/live-activity-token', {
      method: 'POST',
      body: JSON.stringify({ activityToken: 'aabb' }),
    })
  })

  it('re-uploads on token rotation', async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    await handleActivityPushToken({ orderId: 'o1', token: 'ccdd' })
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/orders/o1/live-activity-token', {
      method: 'POST',
      body: JSON.stringify({ activityToken: 'ccdd' }),
    })
  })

  it('a failed upload is retried on the next emission of the same token', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('API 500'))
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    apiFetchMock.mockResolvedValueOnce({ ok: true })
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('tracks tokens per order independently', async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    await handleActivityPushToken({ orderId: 'o1', token: 'aabb' })
    await handleActivityPushToken({ orderId: 'o2', token: 'aabb' })
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('startActivityForPlacedOrder', () => {
  it('pickup: fetches waitText and starts with the pickup attributes', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true, text: '~8–12 min' }) // /wait
    await startActivityForPlacedOrder({
      orderId: 'sq-1',
      referenceId: 'OL123',
      fulfillmentType: 'PICKUP',
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/api/orders/sq-1/wait')
    expect(startMock).toHaveBeenCalledWith(
      'sq-1',
      { kind: 'pickup', orderNumber: 'OL123', waitText: '~8–12 min' },
      // Contract initial state: "received" until staff accept (RESERVED).
      expect.objectContaining({ status: 'received' }),
    )
  })

  it('pickup: starts without waitText when the wait endpoint fails', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('boom'))
    await startActivityForPlacedOrder({
      orderId: 'sq-1',
      referenceId: 'OL123',
      fulfillmentType: 'PICKUP',
    })
    expect(startMock).toHaveBeenCalledWith(
      'sq-1',
      expect.objectContaining({ waitText: null }),
      expect.anything(),
    )
  })

  it('delivery: passes store + dest coordinates and a pending initial state', async () => {
    await startActivityForPlacedOrder({
      orderId: 'sq-2',
      referenceId: 'DE045',
      fulfillmentType: 'DELIVERY',
      destLat: -27.9755,
      destLng: 153.398,
    })
    expect(startMock).toHaveBeenCalledWith(
      'sq-2',
      expect.objectContaining({
        kind: 'delivery',
        orderNumber: 'DE045',
        storeLat: expect.any(Number),
        storeLng: expect.any(Number),
        destLat: -27.9755,
        destLng: 153.398,
      }),
      expect.objectContaining({ status: 'pending', driverLat: null }),
    )
  })

  it('delivery: withholds coordinates when the destination is the (0,0) sentinel', async () => {
    await startActivityForPlacedOrder({
      orderId: 'sq-3',
      referenceId: 'DE046',
      fulfillmentType: 'DELIVERY',
      destLat: 0,
      destLng: 0,
    })
    expect(startMock).toHaveBeenCalledWith(
      'sq-3',
      expect.objectContaining({ storeLat: null, storeLng: null, destLat: null, destLng: null }),
      expect.anything(),
    )
  })

  it('never throws when the native start fails', async () => {
    startMock.mockRejectedValueOnce(new Error('ActivityKit denied'))
    await expect(
      startActivityForPlacedOrder({
        orderId: 'sq-4',
        referenceId: 'OL999',
        fulfillmentType: 'PICKUP',
      }),
    ).resolves.toBeUndefined()
  })
})

describe('syncDeliveryTracking', () => {
  const tracking = {
    destLat: -27.9755,
    destLng: 153.398,
    storeLat: -27.966,
    storeLng: 153.4115,
    driverLat: -27.97,
    driverLng: 153.405,
    driverHeading: null,
    locationUpdatedAt: '2026-07-06T00:00:10.000Z',
  }

  it('pushes a picked_up update with rider GPS', async () => {
    await syncDeliveryTracking('o1', {
      state: 'PREPARED',
      dispatchStatus: 'picked_up',
      tracking,
    })
    expect(updateMock).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({
        status: 'picked_up',
        driverLat: -27.97,
        driverLng: 153.405,
      }),
    )
    expect(endMock).not.toHaveBeenCalled()
  })

  it('dedupes unchanged polls, then pushes again when the GPS moves', async () => {
    const data = { state: 'PREPARED', dispatchStatus: 'picked_up' as const, tracking }
    await syncDeliveryTracking('o1', data)
    await syncDeliveryTracking('o1', data)
    expect(updateMock).toHaveBeenCalledTimes(1)
    await syncDeliveryTracking('o1', {
      ...data,
      tracking: { ...tracking, driverLat: -27.971, locationUpdatedAt: '2026-07-06T00:00:15.000Z' },
    })
    expect(updateMock).toHaveBeenCalledTimes(2)
  })

  it('ends the activity on delivered (default dismissal)', async () => {
    await syncDeliveryTracking('o1', {
      state: 'OPEN',
      dispatchStatus: 'delivered',
      tracking: null,
    })
    expect(endMock).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ status: 'delivered' }),
      { immediateDismissal: false },
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('ends immediately on canceled', async () => {
    await syncDeliveryTracking('o1', {
      state: 'CANCELED',
      dispatchStatus: null,
      tracking: null,
    })
    expect(endMock).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ status: 'canceled' }),
      { immediateDismissal: true },
    )
  })

  it('stops syncing an order the native side does not know', async () => {
    updateMock.mockResolvedValueOnce(false)
    await syncDeliveryTracking('o1', {
      state: 'PREPARED',
      dispatchStatus: 'picked_up',
      tracking,
    })
    await syncDeliveryTracking('o1', {
      state: 'PREPARED',
      dispatchStatus: 'picked_up',
      tracking: { ...tracking, driverLat: -27.99 },
    })
    expect(updateMock).toHaveBeenCalledTimes(1)
  })
})

describe('syncFromOrderHistory', () => {
  const base: OrderHistoryItem = {
    id: 'o1',
    referenceId: 'OL123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'OPEN',
    fulfillmentState: 'PROPOSED',
    totalCents: '1200',
    itemSummary: 'Milk Tea',
    lineCount: 1,
    firstItemName: 'Milk Tea',
    firstItemImageUrl: null,
    lineItems: [],
  }

  it('mirrors the three pickup states from fulfillment refreshes', async () => {
    await syncFromOrderHistory([base]) // PROPOSED
    expect(updateMock).toHaveBeenLastCalledWith(
      'o1',
      expect.objectContaining({ status: 'received' }),
    )
    await syncFromOrderHistory([{ ...base, fulfillmentState: 'RESERVED' }])
    expect(updateMock).toHaveBeenLastCalledWith(
      'o1',
      expect.objectContaining({ status: 'preparing' }),
    )
    await syncFromOrderHistory([{ ...base, fulfillmentState: 'PREPARED' }])
    expect(updateMock).toHaveBeenLastCalledWith(
      'o1',
      expect.objectContaining({ status: 'ready' }),
    )
    expect(updateMock).toHaveBeenCalledTimes(3)
  })

  it('advances a pickup card to ready (skip-accept jump: no RESERVED in between)', async () => {
    await syncFromOrderHistory([base]) // received
    await syncFromOrderHistory([{ ...base, fulfillmentState: 'PREPARED' }])
    expect(updateMock).toHaveBeenLastCalledWith(
      'o1',
      expect.objectContaining({ status: 'ready' }),
    )
  })

  it('dedupes repeated refreshes with the same fulfillment state', async () => {
    const order = { ...base, fulfillmentState: 'PREPARED' }
    await syncFromOrderHistory([order])
    await syncFromOrderHistory([order])
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('ends a completed pickup with the completed final frame', async () => {
    await syncFromOrderHistory([{ ...base, fulfillmentState: 'COMPLETED' }])
    expect(endMock).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ status: 'completed' }),
      { immediateDismissal: false },
    )
  })

  it('ends a canceled order immediately (Square order-level cancel)', async () => {
    await syncFromOrderHistory([{ ...base, state: 'CANCELED', fulfillmentState: 'PROPOSED' }])
    expect(endMock).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ status: 'canceled' }),
      { immediateDismissal: true },
    )
  })

  it('delivery orders: terminal end only, non-terminal left to the tracking poll', async () => {
    const delivery = { ...base, id: 'o2', referenceId: 'DE045' }
    await syncFromOrderHistory([{ ...delivery, fulfillmentState: 'PREPARED' }])
    expect(updateMock).not.toHaveBeenCalled()
    await syncFromOrderHistory([{ ...delivery, fulfillmentState: 'COMPLETED' }])
    expect(endMock).toHaveBeenCalledWith(
      'o2',
      expect.objectContaining({ status: 'delivered' }),
      { immediateDismissal: false },
    )
  })

  it('skips stale terminal orders (nothing plausibly on the lock screen)', async () => {
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await syncFromOrderHistory([
      { ...base, state: 'COMPLETED', fulfillmentState: 'COMPLETED', createdAt: old, updatedAt: old },
    ])
    expect(updateMock).not.toHaveBeenCalled()
    expect(endMock).not.toHaveBeenCalled()
  })
})
