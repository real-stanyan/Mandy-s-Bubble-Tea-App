# Checkout OTP Phone Verification — App Adaptation Spec

> Source: Web version (`mandys_bubble_tea/src/app/checkout/page.tsx`) implemented 2026-04-13.
> Target: App version Task 10 (Checkout screen) — integrate when building `app/checkout.tsx`.

---

## Feature Overview

Checkout requires phone verification (SMS OTP) before payment. Already-logged-in users (with device token) skip verification automatically. Unverified users must enter phone → receive code → verify → then pay. Successful verification also completes registration/login.

---

## State

```typescript
phoneVerified: boolean     // phone already verified (device token exists)
otpPhone: string | null    // phone number that OTP was sent to (non-null = code sent)
otpCode: string            // user-entered 6-digit code
otpError: boolean          // wrong code flag
otpLoading: boolean        // send/verify in progress
resendTimer: number        // resend cooldown (seconds), starts at 60
showFieldErrors: boolean   // red highlights on missing required fields at submit time
```

---

## Core Logic

### 1. Auto-check device token on mount
- Check `SecureStore` (or `AsyncStorage`) for `mbt:account:deviceToken`
- If present → `phoneVerified = true`, skip OTP flow entirely

### 2. sendCheckoutOtp(phone)
- Call `POST ${API_BASE}/api/auth/send-code` with `{ phone }`
- On success: set `otpPhone`, clear `otpCode`/`otpError`, start 60s resend timer
- On error: show error message

### 3. verifyCheckoutOtp()
- Call `POST ${API_BASE}/api/auth/verify-code` with `{ phone: otpPhone, code: otpCode }`
- On success:
  - Store `deviceToken` to SecureStore + `phone` to AsyncStorage
  - Auto-fill name if Square has a record (`givenName`, `familyName`)
  - Set `phoneVerified = true`
  - Refresh loyalty lookup
- On 401: set `otpError = true` (wrong code)

### 4. Form submit guard
In `handlePay`, check sequentially:
1. Name/phone empty → `showFieldErrors = true` + highlight red borders + descriptive error
2. `!phoneVerified` → show "Please verify your phone first"
3. Pass → continue normal tokenize → order → pay flow

### 5. Resend timer
- `useEffect` decrements `resendTimer` every second
- When 0, show "Resend code" button

---

## CheckoutOtpSection Component (3 states)

| Condition | Render |
|-----------|--------|
| Phone digits < 10 | `null` (hidden) |
| `phoneVerified = true` | Green checkmark badge: "Phone verified" |
| `otpPhone` set (code sent) | 6-digit OtpInput + "Verify" button + resend timer/button + error text |
| Phone >= 10 digits, no OTP sent | "Verify Phone" button + explanation text |

---

## Phone Input Visibility

- Show when `!phoneVerified` (hide after verification)
- Do NOT use `!phone` as condition (input disappears as user types)
- `onChange` resets: `phoneVerified = false`, `otpPhone = null`, `showFieldErrors = false`

---

## Form Validation UX

- Disable native validation (`noValidate` or equivalent)
- Missing fields: red border on input + red asterisk on label
- User typing clears red highlights
- Error message dynamically lists missing fields

---

## API Endpoints

All calls go through the Next.js backend (full URL via `EXPO_PUBLIC_API_BASE_URL`):

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/send-code` | `{ phone }` | `{ ok: true }` |
| POST | `/api/auth/verify-code` | `{ phone, code }` | `{ ok, deviceToken, found, customerId?, givenName?, familyName? }` |
| POST | `/api/customer/lookup` | `{ phone }` | `{ ok, found, customerId?, givenName?, familyName?, deviceToken? }` |

---

## App-Specific Adaptations

| Web | App |
|-----|-----|
| `localStorage` | `AsyncStorage` (general) / `expo-secure-store` (deviceToken) |
| `OtpInput` (HTML input boxes) | React Native `TextInput` x6 (auto-advance focus, paste support) |
| Relative API URLs (`/api/...`) | Full URLs via `EXPO_PUBLIC_API_BASE_URL` |
| Tailwind red border (`border-red-400`) | `borderColor: '#f87171'` in StyleSheet |
| `<div>`, `<button>`, `<p>` | `<View>`, `<TouchableOpacity>`/`<Pressable>`, `<Text>` |
| `useEffect` + `setTimeout` for timer | Same pattern works in React Native |

---

## OtpInput Component (React Native)

Port from web `src/components/account/OtpInput.tsx`:

- 6 individual `TextInput` boxes, `keyboardType="number-pad"`, `maxLength={1}`
- Auto-advance: on input, focus next box via refs
- Backspace: on empty box, focus previous
- Paste: intercept 6-digit paste, distribute across all boxes
- Error state: red borders on all boxes when `otpError = true`
- Style: centered row, each box ~48x48, rounded, border, large font

---

## Reference: Web Implementation Files

- `mandys_bubble_tea/src/app/checkout/page.tsx` — main checkout with OTP state machine
- `mandys_bubble_tea/src/components/account/OtpInput.tsx` — 6-box OTP input component
- `mandys_bubble_tea/src/app/api/auth/send-code/route.ts` — Twilio Verify send
- `mandys_bubble_tea/src/app/api/auth/verify-code/route.ts` — Twilio Verify check + device token
- `mandys_bubble_tea/src/lib/twilio.ts` — Twilio client + HMAC token helpers
