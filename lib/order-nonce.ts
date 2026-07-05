import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'

// Per-checkout idempotency nonce — mirrors the web checkout's semantics
// (web src/lib/checkout-nonce.ts). The nonce is minted once per shopping
// session and only cleared AFTER a successful payment, so a retried Pay tap
// (e.g. after the user killed the app mid-tokenize, or a network flake)
// derives the SAME idempotency key for the same cart → the server's
// deriveOrderIdempotencyKey + Square dedupe return the original OPEN order
// instead of minting a duplicate. Server namespaces the key by customer, so
// app/web can never collide.

export const ORDER_NONCE_KEY = 'mbt:orderNonce:v1'

function newNonce(): string {
  // RN doesn't have crypto.randomUUID in all runtimes; fall back to a
  // composition of Math.random + Date.now that's collision-safe enough
  // for a per-checkout identifier. (Same pattern as store/cart.ts.)
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  const a = Math.random().toString(16).slice(2, 10)
  const b = Math.random().toString(16).slice(2, 10)
  const t = Date.now().toString(16)
  return `${t}-${a}-${b}`
}

/** Returns the current checkout nonce, minting + persisting one if absent. */
export async function getOrderNonce(): Promise<string> {
  const existing = await AsyncStorage.getItem(ORDER_NONCE_KEY)
  if (existing) return existing
  const nonce = newNonce()
  await AsyncStorage.setItem(ORDER_NONCE_KEY, nonce)
  return nonce
}

/** Clear the nonce — call ONLY after a successful payment so the next
 *  checkout gets a fresh identity while retries of this one stay stable. */
export async function clearOrderNonce(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ORDER_NONCE_KEY)
  } catch {
    // Best-effort: a stale nonce only risks harmless dedupe against an
    // already-COMPLETED order, which the server ignores (cart changes
    // change the body hash anyway).
  }
}

/**
 * idempotencyKey = sha256hex(nonce + '|' + JSON.stringify(orderBody)).
 * orderBody is the exact /api/orders body WITHOUT the idempotencyKey field
 * itself. Same nonce + same body → same key (retry dedupes); any cart /
 * discount / fulfillment change → different key (new order).
 */
export async function deriveIdempotencyKey(
  nonce: string,
  orderBody: unknown,
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${nonce}|${JSON.stringify(orderBody)}`,
  )
}
