declare module 'react-native-square-in-app-payments' {
  export interface ErrorDetails {
    debugMessage: string
    message: string
    code?: string
    debugCode?: string
  }

  export interface CardDetails {
    nonce?: string
    card?: {
      brand?: number
      lastFourDigits?: string
      expirationMonth?: number
      expirationYear?: number
      postalCode?: string
      type?: number
      prepaidType?: number
    }
  }

  export interface ApplePayConfig {
    price: string
    summaryLabel: string
    countryCode: string
    currencyCode: string
    paymentType?: PaymentType
  }

  export enum PaymentType {
    PaymentTypePending = 1,
    PaymentTypeFinal = 2,
  }

  export enum ApplePayNonceSuccessState {
    Succeeded = 'succeeded',
    Failure = 'failure',
    Canceled = 'canceled',
  }

  export interface ApplePayNonceSuccessResult {
    state: ApplePayNonceSuccessState
    errorMessage?: string
  }

  export interface NonceSuccessResult {
    success: boolean
    errorMessage?: string
    onCardEntryComplete?: () => void
  }

  export interface GooglePayConfig {
    price: string
    currencyCode: string
    priceStatus: GooglePayPriceStatus
  }

  export enum GooglePayPriceStatus {
    TotalPriceStatusNotCurrentlyKnown = 1,
    TotalPriceStatusEstimated = 2,
    TotalPriceStatusFinal = 3,
  }

  export enum GooglePayEnvironment {
    EnvironmentProduction = 1,
    EnvironmentTest = 3,
  }

  export namespace SQIPCore {
    function setSquareApplicationId(applicationId: string): void
    function getSquareApplicationId(): string | null
  }

  export namespace SQIPCardEntry {
    function startCardEntryFlow(
      collectPostalCode: boolean,
      onCardNonceRequestSuccess?: (
        cardDetails: CardDetails
      ) => NonceSuccessResult | Promise<NonceSuccessResult>,
      onCardEntryCancel?: () => void
    ): void
  }

  export namespace SQIPApplePay {
    function initializeApplePay(applePayMerchantId: string): void
    function canUseApplePay(): Promise<boolean>
    function requestApplePayNonce(
      applePayConfig: ApplePayConfig,
      onApplePayNonceRequestSuccess?: (
        cardDetails: CardDetails
      ) => ApplePayNonceSuccessResult | Promise<ApplePayNonceSuccessResult>,
      onApplePayNonceRequestFailure?: (error: ErrorDetails) => void,
      onApplePayComplete?: (
        status: ApplePayNonceSuccessState,
        errorMessage?: string
      ) => void
    ): Promise<void>
  }

  export namespace SQIPGooglePay {
    function initializeGooglePay(
      squareLocationId: string,
      environment: GooglePayEnvironment
    ): void
    function canUseGooglePay(): Promise<boolean>
    function requestGooglePayNonce(
      googlePayConfig: GooglePayConfig,
      onGooglePayNonceRequestSuccess?: (cardDetails: CardDetails) => void,
      onGooglePayNonceRequestFailure?: (error: ErrorDetails) => void,
      onGooglePayCanceled?: () => void
    ): Promise<void>
  }
}
