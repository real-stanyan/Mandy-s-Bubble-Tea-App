import { Platform } from 'react-native'
import Constants from 'expo-constants'

// PRODUCTION (release) builds ALWAYS use the production Square credentials
// below — never sandbox. Only dev builds (__DEV__ === true) may override via
// EXPO_PUBLIC_* for sandbox testing.
//
// History: build 22 (2026-05-22) changed these to read EXPO_PUBLIC_* directly
// (`env ?? prod-fallback`). The dev .env.local carries a SANDBOX app id, which
// leaked into the production build — the native Square SDK then initialized
// with the sandbox application id (`SQIPCore.setSquareApplicationId`), so
// SQIPCardEntry could not produce a usable production nonce and every card
// payment failed BEFORE reaching /api/payment (no Square FAILED record, order
// left OPEN/NO-TENDER, OL number burned → ticket-number skips). The __DEV__
// guard makes it impossible for a release build to use sandbox again.
const PROD_SQUARE_APP_ID = 'sq0idp-1IOAOYqjBpdqlMPwxWpqXA'
const PROD_SQUARE_LOCATION_ID = 'LFS3V7YRVTGTK'
const SQUARE_APP_ID = __DEV__
  ? process.env.EXPO_PUBLIC_SQUARE_APP_ID ?? PROD_SQUARE_APP_ID
  : PROD_SQUARE_APP_ID
const SQUARE_LOCATION_ID = __DEV__
  ? process.env.EXPO_PUBLIC_SQUARE_LOCATION_ID ?? PROD_SQUARE_LOCATION_ID
  : PROD_SQUARE_LOCATION_ID
const APPLE_MERCHANT_ID = 'merchant.com.mandysbubbletea.app'

// Expo Go 不含原生模块。在 Expo Go 里 require 会 throw,需要在 dev build / production build 里使用。
const isExpoGo = Constants.appOwnership === 'expo'

type SquareModule = typeof import('react-native-square-in-app-payments')
let sqip: SquareModule | null = null

function loadSqip(): SquareModule {
  if (sqip) return sqip
  if (isExpoGo) {
    throw new Error(
      'Square payments 需要 dev build,Expo Go 不支持。请运行 `eas build --profile development` 并用该 build 打开。'
    )
  }
  // 动态 require,避免在 Expo Go 解析模块时 crash
  sqip = require('react-native-square-in-app-payments') as SquareModule
  return sqip
}

let initialized = false

export function initSquarePayments() {
  if (initialized) return
  if (isExpoGo) return // Expo Go 下静默跳过,避免启动就 crash
  const { SQIPCore, SQIPApplePay, SQIPGooglePay, GooglePayEnvironment } = loadSqip()
  SQIPCore.setSquareApplicationId(SQUARE_APP_ID)
  if (Platform.OS === 'android') {
    SQIPGooglePay.initializeGooglePay(
      SQUARE_LOCATION_ID,
      GooglePayEnvironment.EnvironmentProduction
    )
  }
  if (Platform.OS === 'ios') {
    SQIPApplePay.initializeApplePay(APPLE_MERCHANT_ID)
  }
  initialized = true
}

/** Check if Apple Pay is available on this device */
export async function canUseApplePay(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  if (isExpoGo) return false
  try {
    return await loadSqip().SQIPApplePay.canUseApplePay()
  } catch {
    return false
  }
}

/** Check if Google Pay is available on this device */
export async function canUseGooglePay(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  if (isExpoGo) return false
  try {
    return await loadSqip().SQIPGooglePay.canUseGooglePay()
  } catch {
    return false
  }
}

// Watchdog timeouts for the native payment sheets. The SQIP bridge has two
// known "promise never settles" failure modes:
//   1. Apple/Google Pay: the native module's returned promise REJECTS (e.g.
//      merchant config error) but the old code never attached a .catch — the
//      outer promise stayed pending forever.
//   2. Card entry: presenting on a nil rootViewController is a silent no-op —
//      no callback ever fires.
// Either way the checkout screen's `processing` flag stayed true until the
// user killed the app, leaving the created order OPEN with no tender. The
// watchdog guarantees the promise settles; single-settle guard keeps
// resolve/reject/timeout mutually exclusive.
export const CARD_ENTRY_TIMEOUT_MS = 120_000
export const WALLET_TIMEOUT_MS = 90_000
export const PAYMENT_SHEET_TIMEOUT = 'PAYMENT_SHEET_TIMEOUT'

type SettleGuard = {
  resolve: (nonce: string) => void
  reject: (error: Error) => void
}

function createSettleGuard(
  resolve: (nonce: string) => void,
  reject: (error: Error) => void,
  timeoutMs: number,
): SettleGuard {
  let settled = false
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    reject(new Error(PAYMENT_SHEET_TIMEOUT))
  }, timeoutMs)
  const settleOnce = <T>(fn: (v: T) => void) => (v: T) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    fn(v)
  }
  return { resolve: settleOnce(resolve), reject: settleOnce(reject) }
}

function toError(e: unknown, fallback: string): Error {
  if (e instanceof Error) return e
  const msg = typeof e === 'string' && e ? e : fallback
  return new Error(msg)
}

/** Attach a rejection handler to the promise a native SQIP call returns (if
 *  it returns one — the typings say Promise, but stay defensive about the
 *  bridge). A rejected native promise was previously silently dropped. */
function guardNativePromise(maybePromise: unknown, guard: SettleGuard, fallback: string) {
  if (
    maybePromise &&
    typeof (maybePromise as Promise<unknown>).catch === 'function'
  ) {
    ;(maybePromise as Promise<unknown>).catch((e: unknown) =>
      guard.reject(toError(e, fallback))
    )
  }
}

/**
 * Open the native card entry form and return a payment nonce.
 */
export function startCardPayment(): Promise<string> {
  return new Promise((resolve, reject) => {
    const guard = createSettleGuard(resolve, reject, CARD_ENTRY_TIMEOUT_MS)
    try {
      const { SQIPCardEntry } = loadSqip()
      const nativePromise = SQIPCardEntry.startCardEntryFlow(
        false, // don't collect postal code (AU)
        async (cardDetails) => {
          if (cardDetails.nonce) {
            return { success: true, onCardEntryComplete: () => guard.resolve(cardDetails.nonce!) }
          }
          return { success: false, errorMessage: 'No nonce returned' }
        },
        () => {
          guard.reject(new Error('Card entry cancelled'))
        }
      )
      guardNativePromise(nativePromise, guard, 'Card entry failed')
    } catch (e) {
      guard.reject(toError(e, 'Card entry failed'))
    }
  })
}

/**
 * Request Apple Pay nonce. Shows the native Apple Pay sheet.
 * @param priceDollars - total price as a string (e.g. "12.50")
 */
export function startApplePayPayment(priceDollars: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const guard = createSettleGuard(resolve, reject, WALLET_TIMEOUT_MS)
    try {
      const { SQIPApplePay, PaymentType, ApplePayNonceSuccessState } = loadSqip()
      const nativePromise = SQIPApplePay.requestApplePayNonce(
        {
          price: priceDollars,
          summaryLabel: "Mandy's Bubble Tea",
          countryCode: 'AU',
          currencyCode: 'AUD',
          paymentType: PaymentType.PaymentTypeFinal,
        },
        async (cardDetails) => {
          if (cardDetails.nonce) {
            guard.resolve(cardDetails.nonce)
            return { state: ApplePayNonceSuccessState.Succeeded }
          }
          return {
            state: ApplePayNonceSuccessState.Failure,
            errorMessage: 'No nonce returned',
          }
        },
        (error) => {
          guard.reject(new Error(error.message || 'Apple Pay failed'))
        },
        (status, errorMessage) => {
          if (status === ApplePayNonceSuccessState.Canceled) {
            guard.reject(new Error('Apple Pay cancelled'))
          } else if (status === ApplePayNonceSuccessState.Failure) {
            guard.reject(new Error(errorMessage || 'Apple Pay failed'))
          }
        }
      )
      // THE main bug: this native promise rejects on e.g. merchant/config
      // errors, and nothing was listening — checkout hung forever.
      guardNativePromise(nativePromise, guard, 'Apple Pay failed')
    } catch (e) {
      guard.reject(toError(e, 'Apple Pay failed'))
    }
  })
}

/**
 * Request Google Pay nonce. Shows the native Google Pay sheet.
 * @param priceDollars - total price as a string (e.g. "12.50")
 */
export function startGooglePayPayment(priceDollars: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const guard = createSettleGuard(resolve, reject, WALLET_TIMEOUT_MS)
    try {
      const { SQIPGooglePay, GooglePayPriceStatus } = loadSqip()
      const nativePromise = SQIPGooglePay.requestGooglePayNonce(
        {
          price: priceDollars,
          currencyCode: 'AUD',
          priceStatus: GooglePayPriceStatus.TotalPriceStatusFinal,
        },
        (cardDetails) => {
          if (cardDetails.nonce) {
            guard.resolve(cardDetails.nonce)
          } else {
            guard.reject(new Error('No nonce returned'))
          }
        },
        (error) => {
          guard.reject(new Error(error.message || 'Google Pay failed'))
        },
        () => {
          guard.reject(new Error('Google Pay cancelled'))
        }
      )
      // Same dropped-rejection bug as Apple Pay — see above.
      guardNativePromise(nativePromise, guard, 'Google Pay failed')
    } catch (e) {
      guard.reject(toError(e, 'Google Pay failed'))
    }
  })
}

export { isExpoGo }
