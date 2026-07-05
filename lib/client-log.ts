import { Platform } from 'react-native'
import { API_BASE, appVersionString } from '@/lib/api'

// Fire-and-forget checkout telemetry → web /api/client-log (console.error →
// Vercel runtime logs, greppable via `[client-error]`). The payment flow had
// ZERO client-side observability: tokenize hangs / cancels / /api/payment
// failures all died silently on the device. This beacon is deliberately
// best-effort — it must never throw and never block the pay flow.

export const MAX_MESSAGE_LENGTH = 500
const BEACON_TIMEOUT_MS = 3_000

export type PaymentStep =
  | 'create-order'
  | 'redeem-fail'
  | 'tokenize-start'
  | 'tokenize-pending'
  | 'tokenize-timeout'
  | 'tokenize-fail'
  | 'tokenize-cancel'
  | 'tokenize-late-settle'
  | 'pay-fail'

export interface PaymentStepInput {
  step: PaymentStep
  message?: string
  orderId?: string | null
  payMethod?: string | null
  meta?: Record<string, unknown>
}

export interface PaymentStepPayload {
  scope: 'app-checkout'
  step: PaymentStep
  message: string | null
  appVersion: string
  platform: string
  orderId: string | null
  payMethod: string | null
  ts: string
  meta?: Record<string, unknown>
}

/** Pure payload builder — exported for unit tests. */
export function buildPaymentStepPayload(input: PaymentStepInput): PaymentStepPayload {
  const payload: PaymentStepPayload = {
    scope: 'app-checkout',
    step: input.step,
    message:
      typeof input.message === 'string'
        ? input.message.slice(0, MAX_MESSAGE_LENGTH)
        : null,
    appVersion: appVersionString(),
    platform: Platform.OS,
    orderId: input.orderId ?? null,
    payMethod: input.payMethod ?? null,
    ts: new Date().toISOString(),
  }
  if (input.meta) payload.meta = input.meta
  return payload
}

/**
 * Fire-and-forget beacon. NEVER awaits, NEVER throws — any failure
 * (offline, server down, abort) is swallowed. 3s AbortController cap so a
 * stalled request can't pile up sockets during a flaky checkout.
 */
export function reportPaymentStep(input: PaymentStepInput): void {
  try {
    const payload = buildPaymentStepPayload(input)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), BEACON_TIMEOUT_MS)
    try {
      fetch(`${API_BASE}/api/client-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .catch(() => {})
        .finally(() => clearTimeout(timer))
    } catch (e) {
      // fetch threw synchronously (e.g. missing global in a test env) —
      // still clear the abort timer so nothing leaks.
      clearTimeout(timer)
      throw e
    }
  } catch {
    // Observability must never break checkout.
  }
}
