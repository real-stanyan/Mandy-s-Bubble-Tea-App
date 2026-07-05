/**
 * Payload construction + never-throw semantics for the checkout beacon.
 */
import {
  buildPaymentStepPayload,
  reportPaymentStep,
  MAX_MESSAGE_LENGTH,
} from '@/lib/client-log'

jest.mock('@/lib/api', () => ({
  API_BASE: 'https://api.test',
  appVersionString: () => '1.1.4+22',
}))

describe('buildPaymentStepPayload', () => {
  it('builds the full schema', () => {
    const payload = buildPaymentStepPayload({
      step: 'tokenize-fail',
      message: 'Apple Pay failed',
      orderId: 'ORDER123',
      payMethod: 'apple',
      meta: { attempt: 2 },
    })
    expect(payload).toEqual({
      scope: 'app-checkout',
      step: 'tokenize-fail',
      message: 'Apple Pay failed',
      appVersion: '1.1.4+22',
      platform: expect.any(String),
      orderId: 'ORDER123',
      payMethod: 'apple',
      ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      meta: { attempt: 2 },
    })
  })

  it('defaults optional fields to null and omits meta when absent', () => {
    const payload = buildPaymentStepPayload({ step: 'tokenize-start' })
    expect(payload.message).toBeNull()
    expect(payload.orderId).toBeNull()
    expect(payload.payMethod).toBeNull()
    expect('meta' in payload).toBe(false)
  })

  it(`truncates messages to ${MAX_MESSAGE_LENGTH} chars`, () => {
    const payload = buildPaymentStepPayload({
      step: 'pay-fail',
      message: 'x'.repeat(2000),
    })
    expect(payload.message).toHaveLength(MAX_MESSAGE_LENGTH)
  })
})

describe('reportPaymentStep', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fires a POST to /api/client-log with the JSON payload', () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    reportPaymentStep({ step: 'create-order', orderId: 'O1', payMethod: 'card' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/api/client-log')
    expect(init.method).toBe('POST')
    const parsed = JSON.parse(init.body)
    expect(parsed.scope).toBe('app-checkout')
    expect(parsed.step).toBe('create-order')
    expect(parsed.orderId).toBe('O1')
    expect(init.signal).toBeDefined()
  })

  it('never throws when fetch rejects', () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch
    expect(() =>
      reportPaymentStep({ step: 'tokenize-pending' }),
    ).not.toThrow()
  })

  it('never throws when fetch itself throws synchronously', () => {
    globalThis.fetch = jest.fn(() => {
      throw new Error('no fetch here')
    }) as unknown as typeof fetch
    expect(() => reportPaymentStep({ step: 'pay-fail' })).not.toThrow()
  })
})
