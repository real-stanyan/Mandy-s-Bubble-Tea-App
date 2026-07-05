/**
 * Idempotency-key derivation tests — mirrors the web checkout semantics:
 * sha256hex(nonce + '|' + JSON.stringify(orderBody)). Stable for a retry of
 * the same order, different for any body change, rotated per checkout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createHash } from 'crypto'
import {
  getOrderNonce,
  clearOrderNonce,
  deriveIdempotencyKey,
  ORDER_NONCE_KEY,
} from '@/lib/order-nonce'

jest.mock('expo-crypto', () => {
  // Node-backed SHA-256 so the test exercises the real composition +
  // hex-digest shape without the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash: nodeCreateHash } = require('crypto') as typeof import('crypto')
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async (_alg: string, data: string) =>
      nodeCreateHash('sha256').update(data).digest('hex'),
    ),
  }
})

const body = {
  lines: [{ variationId: 'V1', variationPriceCents: 650, modifiers: [], quantity: 1 }],
  applyWelcomeDiscount: false,
  applyIgFollowDiscount: false,
  applyLoyaltyReward: false,
  loyaltyRewardCount: 0,
  fulfillmentType: 'PICKUP',
}

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('deriveIdempotencyKey', () => {
  it('is sha256hex(nonce + "|" + JSON.stringify(body))', async () => {
    const key = await deriveIdempotencyKey('nonce-a', body)
    const expected = createHash('sha256')
      .update(`nonce-a|${JSON.stringify(body)}`)
      .digest('hex')
    expect(key).toBe(expected)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for the same nonce + body (retry reuses the order)', async () => {
    const a = await deriveIdempotencyKey('nonce-a', body)
    const b = await deriveIdempotencyKey('nonce-a', { ...body })
    expect(a).toBe(b)
  })

  it('changes when the body changes (edited cart = new order)', async () => {
    const a = await deriveIdempotencyKey('nonce-a', body)
    const b = await deriveIdempotencyKey('nonce-a', {
      ...body,
      lines: [{ ...body.lines[0], quantity: 2 }],
    })
    expect(a).not.toBe(b)
  })

  it('changes when the nonce changes (new checkout = new order)', async () => {
    const a = await deriveIdempotencyKey('nonce-a', body)
    const b = await deriveIdempotencyKey('nonce-b', body)
    expect(a).not.toBe(b)
  })
})

describe('order nonce lifecycle', () => {
  it('mints once and persists under mbt:orderNonce:v1', async () => {
    const first = await getOrderNonce()
    expect(first).toBeTruthy()
    expect(await AsyncStorage.getItem(ORDER_NONCE_KEY)).toBe(first)
    // Second call must return the SAME nonce — retries derive the same key.
    expect(await getOrderNonce()).toBe(first)
  })

  it('clearOrderNonce rotates the identity for the next checkout', async () => {
    const first = await getOrderNonce()
    await clearOrderNonce()
    expect(await AsyncStorage.getItem(ORDER_NONCE_KEY)).toBeNull()
    const second = await getOrderNonce()
    expect(second).not.toBe(first)
  })
})
