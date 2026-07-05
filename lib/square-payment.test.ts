/**
 * Settle-semantics tests for the SQIP wrappers — the production bug was a
 * promise that never settled (dropped native rejection / silent no-op),
 * leaving checkout's `processing` true forever. These tests pin down:
 *   1. a rejected native promise propagates to the caller (THE main bug);
 *   2. a sheet that never calls back is rejected by the watchdog;
 *   3. first settle wins — no double-settle across callbacks/timeout.
 */
import {
  startApplePayPayment,
  startGooglePayPayment,
  startCardPayment,
  CARD_ENTRY_TIMEOUT_MS,
  WALLET_TIMEOUT_MS,
  PAYMENT_SHEET_TIMEOUT,
} from '@/lib/square-payment'

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, expoConfig: { version: '1.1.4' } },
}))

// `mock`-prefixed names are the jest-sanctioned escape hatch for factory
// closures (jest.mock calls are hoisted above the imports at runtime).
const mockRequestApplePayNonce = jest.fn()
const mockRequestGooglePayNonce = jest.fn()
const mockStartCardEntryFlow = jest.fn()
// Cut the client-log → lib/api → supabase/expo-application import chain and
// let tests assert the tokenize-late-settle beacon.
const mockReportPaymentStep = jest.fn()

jest.mock('@/lib/client-log', () => ({
  reportPaymentStep: (...args: unknown[]) => mockReportPaymentStep(...args),
}))

jest.mock('react-native-square-in-app-payments', () => ({
  SQIPCore: { setSquareApplicationId: jest.fn() },
  SQIPCardEntry: { startCardEntryFlow: mockStartCardEntryFlow },
  SQIPApplePay: {
    initializeApplePay: jest.fn(),
    canUseApplePay: jest.fn(),
    requestApplePayNonce: mockRequestApplePayNonce,
  },
  SQIPGooglePay: {
    initializeGooglePay: jest.fn(),
    canUseGooglePay: jest.fn(),
    requestGooglePayNonce: mockRequestGooglePayNonce,
  },
  PaymentType: { PaymentTypeFinal: 1 },
  ApplePayNonceSuccessState: { Succeeded: 0, Failure: 1, Canceled: 2 },
  GooglePayPriceStatus: { TotalPriceStatusFinal: 3 },
  GooglePayEnvironment: { EnvironmentProduction: 1 },
}))

/** Let pending microtasks (native promise .catch handlers) run. */
const flushMicrotasks = () => Promise.resolve()

beforeEach(() => {
  jest.useFakeTimers()
  mockRequestApplePayNonce.mockReset()
  mockRequestGooglePayNonce.mockReset()
  mockStartCardEntryFlow.mockReset()
  mockReportPaymentStep.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('native promise rejection propagates (the dropped-rejection bug)', () => {
  it('Apple Pay: rejected native promise rejects the wrapper', async () => {
    mockRequestApplePayNonce.mockReturnValue(
      Promise.reject(new Error('APPLE_PAY_MERCHANT_ERROR')),
    )
    await expect(startApplePayPayment('12.50')).rejects.toThrow(
      'APPLE_PAY_MERCHANT_ERROR',
    )
  })

  it('Google Pay: rejected native promise rejects the wrapper', async () => {
    mockRequestGooglePayNonce.mockReturnValue(
      Promise.reject(new Error('GOOGLE_PAY_INIT_ERROR')),
    )
    await expect(startGooglePayPayment('12.50')).rejects.toThrow(
      'GOOGLE_PAY_INIT_ERROR',
    )
  })

  it('Card entry: rejected native promise rejects the wrapper', async () => {
    mockStartCardEntryFlow.mockReturnValue(
      Promise.reject(new Error('NO_ROOT_VIEW_CONTROLLER')),
    )
    await expect(startCardPayment()).rejects.toThrow('NO_ROOT_VIEW_CONTROLLER')
  })

  it('non-Error native rejection is wrapped into an Error', async () => {
    mockRequestApplePayNonce.mockReturnValue(Promise.reject('boom'))
    await expect(startApplePayPayment('1.00')).rejects.toThrow('boom')
  })
})

describe('watchdog timeout', () => {
  it('Apple Pay sheet that never settles rejects with PAYMENT_SHEET_TIMEOUT after 90s', async () => {
    mockRequestApplePayNonce.mockReturnValue(new Promise(() => {}))
    const promise = startApplePayPayment('12.50')
    const assertion = expect(promise).rejects.toThrow(PAYMENT_SHEET_TIMEOUT)
    jest.advanceTimersByTime(WALLET_TIMEOUT_MS)
    await assertion
  })

  it('Google Pay sheet that never settles rejects with PAYMENT_SHEET_TIMEOUT after 90s', async () => {
    mockRequestGooglePayNonce.mockReturnValue(new Promise(() => {}))
    const promise = startGooglePayPayment('12.50')
    const assertion = expect(promise).rejects.toThrow(PAYMENT_SHEET_TIMEOUT)
    jest.advanceTimersByTime(WALLET_TIMEOUT_MS)
    await assertion
  })

  it('card entry that never settles rejects with PAYMENT_SHEET_TIMEOUT after 300s', async () => {
    mockStartCardEntryFlow.mockReturnValue(new Promise(() => {}))
    const promise = startCardPayment()
    const assertion = expect(promise).rejects.toThrow(PAYMENT_SHEET_TIMEOUT)
    jest.advanceTimersByTime(CARD_ENTRY_TIMEOUT_MS)
    await assertion
  })

  it('does not time out just before the deadline', async () => {
    let resolveNonce: (() => void) | undefined
    mockRequestGooglePayNonce.mockImplementation(
      (_info: unknown, onSuccess: (d: { nonce: string }) => void) => {
        resolveNonce = () => onSuccess({ nonce: 'cnon:late-but-fine' })
        return new Promise(() => {})
      },
    )
    const promise = startGooglePayPayment('9.00')
    jest.advanceTimersByTime(WALLET_TIMEOUT_MS - 1)
    resolveNonce!()
    await expect(promise).resolves.toBe('cnon:late-but-fine')
  })
})

describe('single-settle guarantee', () => {
  it('success followed by cancel + native rejection still resolves with the nonce', async () => {
    mockRequestGooglePayNonce.mockImplementation(
      (
        _info: unknown,
        onSuccess: (d: { nonce: string }) => void,
        _onFail: (e: { message?: string }) => void,
        onCancel: () => void,
      ) => {
        onSuccess({ nonce: 'cnon:first-wins' })
        onCancel() // double-callback from a flaky bridge
        return Promise.reject(new Error('late native failure'))
      },
    )
    const promise = startGooglePayPayment('5.00')
    await flushMicrotasks()
    await expect(promise).resolves.toBe('cnon:first-wins')
  })

  it('cancel followed by a late success stays rejected as cancelled', async () => {
    mockRequestApplePayNonce.mockImplementation(
      (
        _info: unknown,
        onSuccess: (d: { nonce: string }) => Promise<unknown>,
        _onFail: unknown,
        onComplete: (status: number, errorMessage?: string) => void,
      ) => {
        onComplete(2) // ApplePayNonceSuccessState.Canceled
        void onSuccess({ nonce: 'cnon:too-late' })
        return Promise.resolve()
      },
    )
    await expect(startApplePayPayment('5.00')).rejects.toThrow(
      'Apple Pay cancelled',
    )
  })

  it('settling clears the watchdog — no PAYMENT_SHEET_TIMEOUT after resolve', async () => {
    mockRequestGooglePayNonce.mockImplementation(
      (_info: unknown, onSuccess: (d: { nonce: string }) => void) => {
        onSuccess({ nonce: 'cnon:ok' })
        return Promise.resolve()
      },
    )
    const promise = startGooglePayPayment('5.00')
    await expect(promise).resolves.toBe('cnon:ok')
    // Advancing past the watchdog must be a no-op (timer was cleared).
    jest.advanceTimersByTime(WALLET_TIMEOUT_MS + 1)
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe('card fake-success window (submit after watchdog timeout)', () => {
  it('nonce submitted AFTER timeout → form shown success:false + late-settle beacon', async () => {
    let nonceCallback:
      | ((d: { nonce?: string }) => Promise<{
          success: boolean
          errorMessage?: string
          onCardEntryComplete?: () => void
        }>)
      | undefined
    mockStartCardEntryFlow.mockImplementation(
      (_collectPostal: boolean, onNonce: typeof nonceCallback) => {
        nonceCallback = onNonce
        return new Promise(() => {})
      },
    )
    const promise = startCardPayment()
    const assertion = expect(promise).rejects.toThrow(PAYMENT_SHEET_TIMEOUT)
    jest.advanceTimersByTime(CARD_ENTRY_TIMEOUT_MS)
    await assertion

    // The native form is still open; the user finishes typing and submits.
    // The form must NOT play its success animation (the JS flow already
    // rejected) — it gets an explicit failure message instead.
    const result = await nonceCallback!({ nonce: 'cnon:too-late' })
    expect(result).toEqual({
      success: false,
      errorMessage: 'Payment timed out — please tap Pay again',
    })
    expect(mockReportPaymentStep).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'tokenize-late-settle', payMethod: 'card' }),
    )
  })

  it('wallet success arriving AFTER timeout fires the late-settle beacon', async () => {
    let onSuccess: ((d: { nonce: string }) => void) | undefined
    mockRequestGooglePayNonce.mockImplementation(
      (_info: unknown, success: (d: { nonce: string }) => void) => {
        onSuccess = success
        return new Promise(() => {})
      },
    )
    const promise = startGooglePayPayment('5.00')
    const assertion = expect(promise).rejects.toThrow(PAYMENT_SHEET_TIMEOUT)
    jest.advanceTimersByTime(WALLET_TIMEOUT_MS)
    await assertion

    onSuccess!({ nonce: 'cnon:late' })
    expect(mockReportPaymentStep).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'tokenize-late-settle', payMethod: 'google' }),
    )
  })

  it('a normal on-time settle fires NO late-settle beacon', async () => {
    mockRequestGooglePayNonce.mockImplementation(
      (_info: unknown, onSuccess: (d: { nonce: string }) => void) => {
        onSuccess({ nonce: 'cnon:on-time' })
        return Promise.resolve()
      },
    )
    await expect(startGooglePayPayment('5.00')).resolves.toBe('cnon:on-time')
    expect(mockReportPaymentStep).not.toHaveBeenCalled()
  })
})
