# Payment — Mobile In-App Payments

## Options

### Option A: Square In-App Payments SDK (React Native)

```bash
npm install sq-in-app-payments-react-native
```

- Provides native card entry form + Apple Pay + Google Pay
- Card entry: opens native modal
- Apple Pay: native Apple Pay sheet
- Google Pay: native Google Pay sheet

### Option B: WebView-based Square Web Payments

If the native SDK is too heavy or outdated, use a WebView pointing to a payment page on the web site.

## Payment Flow (Option A)

```typescript
// 1. Initialize SDK
import { SQIPCore, SQIPCardEntry, SQIPApplePay, SQIPGooglePay } from 'sq-in-app-payments-react-native'

await SQIPCore.setSquareApplicationId(SQUARE_APP_ID)

// 2. Card entry
const cardResult = await SQIPCardEntry.startCardEntryFlow(/* config */)
const nonce = cardResult.nonce

// 3. Send nonce to backend
await apiFetch('/api/payment', {
  method: 'POST',
  body: JSON.stringify({ token: nonce, orderId, total, phoneNumber }),
})
```

## Apple Pay (iOS)

- Requires Apple Pay merchant ID configured in Square Dashboard
- Requires Apple Pay entitlement in Xcode project
- Set up via `SQIPApplePay.requestApplePayNonce()`
- Amount in string format: `"12.50"` (dollars, not cents)

## Google Pay (Android)

- Requires Google Pay merchant ID
- Set up via `SQIPGooglePay.requestGooglePayNonce()`
- Environment: `PRODUCTION` for live, `TEST` for sandbox

## Backend Payment Route

The app sends the nonce/token to the same `/api/payment` endpoint as the web:

```typescript
// POST /api/payment (on backend)
// Body: { token, orderId, total (cents), phoneNumber? }
// Steps:
// 1. paymentsApi.createPayment({ sourceId: token, orderId, amountMoney })
// 2. If phoneNumber: look up loyalty → accumulateLoyaltyPoints
// 3. Return { success: true, payment }
// Loyalty failure must NOT fail the payment
```

## Idempotency

Always generate a fresh UUID for each payment call. Never reuse.

## Error States

- Card declined → show Alert or inline error, do not navigate away
- Network error → show retry message
- Success → `clearCart()` → navigate to order confirmation → haptic feedback

## Currency

Always `AUD`. Backend handles BigInt conversion.
