import {
  activityOrderNumber,
  buildDeliveryContentState,
  buildPickupContentState,
  contentUpdatedAt,
  deliveryActivityStatus,
  fetchWaitText,
  pickupActivityStatus,
  uploadActivityToken,
} from './live-activity'
import { apiFetch } from './api'

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
}))

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe('pickupActivityStatus (fulfillment → contract status, 3-step card)', () => {
  it.each([
    ['PROPOSED', 'received'],
    [null, 'received'],
    [undefined, 'received'],
    ['SOMETHING_NEW', 'received'],
    ['RESERVED', 'preparing'],
    ['PREPARED', 'ready'],
    ['COMPLETED', 'completed'],
    ['CANCELED', 'canceled'],
    ['FAILED', 'canceled'],
  ] as const)('%s → %s', (state, expected) => {
    expect(pickupActivityStatus(state)).toBe(expected)
  })

  it('walks the full 3-step lifecycle: PROPOSED → RESERVED → PREPARED', () => {
    expect(
      ['PROPOSED', 'RESERVED', 'PREPARED'].map((s) => pickupActivityStatus(s)),
    ).toEqual(['received', 'preparing', 'ready'])
  })

  it('supports the shop skipping accept: PROPOSED jumps straight to PREPARED', () => {
    // Store-side POS may never write RESERVED; the stepper must accept
    // received → ready directly (mapping is stateless, so it does).
    expect(pickupActivityStatus('PROPOSED')).toBe('received')
    expect(pickupActivityStatus('PREPARED')).toBe('ready')
  })
})

describe('deliveryActivityStatus (mirrors deriveDeliverySteps precedence)', () => {
  it('dispatch lifecycle drives the status', () => {
    expect(deliveryActivityStatus('PROPOSED', 'pending')).toBe('pending')
    expect(deliveryActivityStatus('PROPOSED', 'accepted')).toBe('accepted')
    expect(deliveryActivityStatus('PREPARED', 'picked_up')).toBe('picked_up')
    expect(deliveryActivityStatus('OPEN', 'delivered')).toBe('delivered')
  })

  it('COMPLETED fulfillment wins even with a stale dispatch row', () => {
    expect(deliveryActivityStatus('COMPLETED', 'picked_up')).toBe('delivered')
    expect(deliveryActivityStatus('COMPLETED', null)).toBe('delivered')
  })

  it('CANCELED / FAILED cancel', () => {
    expect(deliveryActivityStatus('CANCELED', 'accepted')).toBe('canceled')
    expect(deliveryActivityStatus('FAILED', null)).toBe('canceled')
  })

  it('PREPARED recovers picked_up when the dispatch row is missing/pending', () => {
    expect(deliveryActivityStatus('PREPARED', null)).toBe('picked_up')
    expect(deliveryActivityStatus('PREPARED', 'pending')).toBe('picked_up')
    // ...but an explicit accepted dispatch is NOT overridden.
    expect(deliveryActivityStatus('PREPARED', 'accepted')).toBe('accepted')
  })

  it('defaults to pending', () => {
    expect(deliveryActivityStatus(null, null)).toBe('pending')
    expect(deliveryActivityStatus('PROPOSED', null)).toBe('pending')
  })
})

describe('contentUpdatedAt', () => {
  it('prefers the server GPS timestamp (unix seconds, floored)', () => {
    expect(contentUpdatedAt('2026-07-06T00:00:01.900Z')).toBe(
      Math.floor(Date.parse('2026-07-06T00:00:01.900Z') / 1000),
    )
  })

  it('falls back to the local clock for missing/invalid timestamps', () => {
    const now = 1_780_000_123_456
    expect(contentUpdatedAt(null, now)).toBe(1_780_000_123)
    expect(contentUpdatedAt('not-a-date', now)).toBe(1_780_000_123)
  })
})

describe('content-state construction (contract shape)', () => {
  it('pickup state carries only status + updatedAt', () => {
    expect(buildPickupContentState('preparing', 5_000)).toEqual({
      status: 'preparing',
      updatedAt: 5,
    })
  })

  it('picked_up carries driver identity and GPS', () => {
    const state = buildDeliveryContentState({
      status: 'picked_up',
      driverName: 'Rick',
      driverLat: -27.97,
      driverLng: 153.4,
      locationUpdatedAt: '2026-07-06T00:00:10.000Z',
    })
    expect(state).toEqual({
      status: 'picked_up',
      driverName: 'Rick',
      driverLat: -27.97,
      driverLng: 153.4,
      updatedAt: Math.floor(Date.parse('2026-07-06T00:00:10.000Z') / 1000),
    })
  })

  it('accepted carries the driver name but no GPS yet', () => {
    const state = buildDeliveryContentState({
      status: 'accepted',
      driverName: 'Rick',
      driverLat: -27.97,
      driverLng: 153.4,
      nowMs: 9_000,
    })
    expect(state.driverName).toBe('Rick')
    expect(state.driverLat).toBeNull()
    expect(state.driverLng).toBeNull()
  })

  it('pending/terminal frames carry neither driver identity nor GPS', () => {
    for (const status of ['pending', 'delivered', 'canceled'] as const) {
      const state = buildDeliveryContentState({
        status,
        driverName: 'Rick',
        driverLat: -27.97,
        driverLng: 153.4,
        nowMs: 9_000,
      })
      expect(state.driverName).toBeNull()
      expect(state.driverLat).toBeNull()
      expect(state.driverLng).toBeNull()
    }
  })
})

describe('activityOrderNumber', () => {
  it('uses the referenceId, stripping any leading #', () => {
    expect(activityOrderNumber('OL123', 'sq-abc')).toBe('OL123')
    expect(activityOrderNumber('#DE045', 'sq-abc')).toBe('DE045')
  })

  it('falls back to the last digits of the order id (checkout parity)', () => {
    expect(activityOrderNumber(null, 'AbC12345Xy789')).toBe('789')
    expect(activityOrderNumber('', 'orderid-4Z')).toBe('004')
  })
})

describe('uploadActivityToken', () => {
  it('POSTs the hex token to the pinned endpoint via apiFetch', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true })
    await uploadActivityToken('order-1', 'a1b2c3')
    expect(apiFetchMock).toHaveBeenCalledWith('/api/orders/order-1/live-activity-token', {
      method: 'POST',
      body: JSON.stringify({ activityToken: 'a1b2c3' }),
    })
  })

  it('URL-encodes the order id', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true })
    await uploadActivityToken('or der/1', 'ff')
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/orders/or%20der%2F1/live-activity-token',
      expect.anything(),
    )
  })

  it('propagates failures (caller decides retry policy)', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('API 500: boom'))
    await expect(uploadActivityToken('order-1', 'ff')).rejects.toThrow('API 500')
  })
})

describe('fetchWaitText', () => {
  it('returns the wait copy when present', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true, text: '~8–12 min' })
    await expect(fetchWaitText('order-1')).resolves.toBe('~8–12 min')
    expect(apiFetchMock).toHaveBeenCalledWith('/api/orders/order-1/wait')
  })

  it('returns null on missing text or request failure', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: true })
    await expect(fetchWaitText('order-1')).resolves.toBeNull()
    apiFetchMock.mockRejectedValueOnce(new Error('network'))
    await expect(fetchWaitText('order-1')).resolves.toBeNull()
  })
})
