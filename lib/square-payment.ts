import { Platform } from 'react-native'
import Constants from 'expo-constants'

const SQUARE_APP_ID = 'sq0idp-1IOAOYqjBpdqlMPwxWpqXA'
const SQUARE_LOCATION_ID = 'LFS3V7YRVTGTK'
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

/**
 * Open the native card entry form and return a payment nonce.
 */
export function startCardPayment(): Promise<string> {
  return new Promise((resolve, reject) => {
    const { SQIPCardEntry } = loadSqip()
    SQIPCardEntry.startCardEntryFlow(
      false, // don't collect postal code (AU)
      async (cardDetails) => {
        if (cardDetails.nonce) {
          return { success: true, onCardEntryComplete: () => resolve(cardDetails.nonce!) }
        }
        return { success: false, errorMessage: 'No nonce returned' }
      },
      () => {
        reject(new Error('Card entry cancelled'))
      }
    )
  })
}

/**
 * Request Apple Pay nonce. Shows the native Apple Pay sheet.
 * @param priceDollars - total price as a string (e.g. "12.50")
 */
export function startApplePayPayment(priceDollars: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { SQIPApplePay, PaymentType, ApplePayNonceSuccessState } = loadSqip()
    SQIPApplePay.requestApplePayNonce(
      {
        price: priceDollars,
        summaryLabel: "Mandy's Bubble Tea",
        countryCode: 'AU',
        currencyCode: 'AUD',
        paymentType: PaymentType.PaymentTypeFinal,
      },
      async (cardDetails) => {
        if (cardDetails.nonce) {
          resolve(cardDetails.nonce)
          return { state: ApplePayNonceSuccessState.Succeeded }
        }
        return {
          state: ApplePayNonceSuccessState.Failure,
          errorMessage: 'No nonce returned',
        }
      },
      (error) => {
        reject(new Error(error.message || 'Apple Pay failed'))
      },
      (status, errorMessage) => {
        if (status === ApplePayNonceSuccessState.Canceled) {
          reject(new Error('Apple Pay cancelled'))
        } else if (status === ApplePayNonceSuccessState.Failure) {
          reject(new Error(errorMessage || 'Apple Pay failed'))
        }
      }
    )
  })
}

/**
 * Request Google Pay nonce. Shows the native Google Pay sheet.
 * @param priceDollars - total price as a string (e.g. "12.50")
 */
export function startGooglePayPayment(priceDollars: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { SQIPGooglePay, GooglePayPriceStatus } = loadSqip()
    SQIPGooglePay.requestGooglePayNonce(
      {
        price: priceDollars,
        currencyCode: 'AUD',
        priceStatus: GooglePayPriceStatus.TotalPriceStatusFinal,
      },
      (cardDetails) => {
        if (cardDetails.nonce) {
          resolve(cardDetails.nonce)
        } else {
          reject(new Error('No nonce returned'))
        }
      },
      (error) => {
        reject(new Error(error.message || 'Google Pay failed'))
      },
      () => {
        reject(new Error('Google Pay cancelled'))
      }
    )
  })
}

export { isExpoGo }
