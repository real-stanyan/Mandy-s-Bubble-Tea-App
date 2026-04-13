import { Platform } from 'react-native'
import {
  SQIPCore,
  SQIPCardEntry,
  SQIPApplePay,
  SQIPGooglePay,
  GooglePayEnvironment,
  GooglePayPriceStatus,
  PaymentType,
  ApplePayNonceSuccessState,
  type CardDetails,
  type ErrorDetails,
} from 'react-native-square-in-app-payments'

const SQUARE_APP_ID = 'sq0idp-1IOAOYqjBpdqlMPwxWpqXA'
const SQUARE_LOCATION_ID = 'LFS3V7YRVTGTK'
const APPLE_MERCHANT_ID = 'merchant.com.mandysbubbletea.app'

let initialized = false

export function initSquarePayments() {
  if (initialized) return
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
  try {
    return await SQIPApplePay.canUseApplePay()
  } catch {
    return false
  }
}

/** Check if Google Pay is available on this device */
export async function canUseGooglePay(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  try {
    return await SQIPGooglePay.canUseGooglePay()
  } catch {
    return false
  }
}

/**
 * Open the native card entry form and return a payment nonce.
 */
export function startCardPayment(): Promise<string> {
  return new Promise((resolve, reject) => {
    SQIPCardEntry.startCardEntryFlow(
      false, // don't collect postal code (AU)
      async (cardDetails: CardDetails) => {
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
    SQIPApplePay.requestApplePayNonce(
      {
        price: priceDollars,
        summaryLabel: "Mandy's Bubble Tea",
        countryCode: 'AU',
        currencyCode: 'AUD',
        paymentType: PaymentType.PaymentTypeFinal,
      },
      async (cardDetails: CardDetails) => {
        if (cardDetails.nonce) {
          resolve(cardDetails.nonce)
          return { state: ApplePayNonceSuccessState.Succeeded }
        }
        return {
          state: ApplePayNonceSuccessState.Failure,
          errorMessage: 'No nonce returned',
        }
      },
      (error: ErrorDetails) => {
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
    SQIPGooglePay.requestGooglePayNonce(
      {
        price: priceDollars,
        currencyCode: 'AUD',
        priceStatus: GooglePayPriceStatus.TotalPriceStatusFinal,
      },
      (cardDetails: CardDetails) => {
        if (cardDetails.nonce) {
          resolve(cardDetails.nonce)
        } else {
          reject(new Error('No nonce returned'))
        }
      },
      (error: ErrorDetails) => {
        reject(new Error(error.message || 'Google Pay failed'))
      },
      () => {
        reject(new Error('Google Pay cancelled'))
      }
    )
  })
}
