// A customer reported My Orders spinning forever (2026-08-30). React Native's
// fetch has no timeout, so one stalled socket left `loading` true — and the
// module-level in-flight de-dupe handed that same dead promise to every later
// refresh (focus, the 10s poll, pull-to-refresh), so the screen could never
// recover without force-quitting the app. These tests pin the two properties
// that make that impossible: a failed refresh always settles, and the next
// refresh is a fresh request.

jest.mock('@/lib/api', () => {
  // Mirrors the real constructors in lib/api.ts — the store branches on
  // `instanceof`, so the doubles have to be the classes it sees.
  class ApiError extends Error {
    readonly status: number
    readonly body: unknown
    constructor(status: number, body: unknown, text: string) {
      super(`API ${status}: ${text}`)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  }
  class TimeoutError extends Error {
    readonly timeoutMs: number
    constructor(timeoutMs: number) {
      super(`Request timed out after ${timeoutMs}ms`)
      this.name = 'TimeoutError'
      this.timeoutMs = timeoutMs
    }
  }
  return {
    apiFetch: jest.fn(),
    apiFetchWithTimeout: jest.fn(),
    ApiError,
    TimeoutError,
  }
})

import { ApiError, TimeoutError, apiFetchWithTimeout } from '@/lib/api'
import { useOrdersStore } from './orders'

const mockFetch = apiFetchWithTimeout as jest.Mock

const ORDER = {
  id: 'ord_1',
  referenceId: 'OL848',
  createdAt: null,
  updatedAt: null,
  state: 'OPEN',
  fulfillmentState: 'PROPOSED',
  totalCents: '850',
  itemSummary: '1× Taro Milk Tea',
  lineCount: 1,
  firstItemName: 'Taro Milk Tea',
  firstItemImageUrl: null,
  lineItems: [],
}

beforeEach(() => {
  mockFetch.mockReset()
  useOrdersStore.setState({
    orders: [],
    activeOrderCount: 0,
    loading: false,
    error: null,
  })
})

describe('useOrdersStore.refresh', () => {
  it('stops loading and surfaces an error when the request times out', async () => {
    mockFetch.mockRejectedValueOnce(new TimeoutError(15_000))

    await useOrdersStore.getState().refresh()

    const state = useOrdersStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeTruthy()
  })

  it('lets a retry through after a failure (the in-flight guard is released)', async () => {
    mockFetch.mockRejectedValueOnce(new TimeoutError(15_000))
    await useOrdersStore.getState().refresh()

    mockFetch.mockResolvedValueOnce({ ok: true, orders: [ORDER] })
    await useOrdersStore.getState().refresh()

    const state = useOrdersStore.getState()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(state.orders).toHaveLength(1)
    expect(state.activeOrderCount).toBe(1)
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
  })

  it('treats a 401 as signed-out, not as a failure worth showing', async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(401, null, 'Sign in to see your order history'))

    await useOrdersStore.getState().refresh()

    const state = useOrdersStore.getState()
    expect(state.error).toBeNull()
    expect(state.orders).toEqual([])
  })

  it('de-duplicates concurrent refreshes into one request', async () => {
    mockFetch.mockResolvedValue({ ok: true, orders: [ORDER] })

    const { refresh } = useOrdersStore.getState()
    await Promise.all([refresh(), refresh()])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
