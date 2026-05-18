# Mandy's Android Phase A — Pixel real-line smoke 2026-05-18

**APK build:** `grwYRjaMYMLsULdsZcyc59` (build #4, HEAD `cfc27d2`)
**Device:** Pixel 6 (oriole), Android 14+ (stock Google), serial `19291FDF600F9P`
**Tester:** Stan
**Square env:** Sandbox (`sandbox-sq0idb-dvRX...`)
**Backend:** `http://192.168.0.116:3000` (Mac local Next.js dev, Mandy web repo `main` HEAD `4f25f70`)

## Case results (8/10 PASS, 2 SKIP)

| # | Case | Status | Notes |
|---|------|--------|-------|
| 1 | Cold start + persisted Supabase session | PASS | App relaunch lands on menu, no re-login |
| 2 | Google Sign-In new user flow | PASS | Native Google account picker → idToken → Supabase auth → Account tab populated. *Initially failed with "trouble connecting" — root cause: Android SDK 28+ cleartext HTTP block. Fixed in `cfc27d2` (network_security_config.xml whitelisting LAN IPs).* |
| 3 | Multi-cup cart math | PASS | Subtotal + PLATFORM_FEE 0.5% rendered correctly |
| 4 | Card Entry sandbox payment | PASS | Square SDK Android v2.0.0 fork compiled + Card Entry sheet rendered + sandbox card 4111... → nonce → POST /api/payment 200 → Square sandbox transaction. *Found pre-existing cross-platform double-tap bug — fixed in `f58bb2e` for future builds.* |
| 5 | Welcome discount three-location display | PASS | Pre-consume / post-consume both behave correctly |
| 6 | Multi-cup loyalty stepper | PASS | 18+ stars → stepper max=2 → 2 free + 1 paid math correct |
| 7 | Order READY push (FCM v1) | PASS | Supabase Realtime → server Expo Push → Firebase FCM → Pixel heads-up notification with #C43A10 light + vibration |
| 8 | Cup-label doodle | SKIP | Mandy's store ZD410 printer-client is live for real customers; would print test labels disrupting operations |
| 9 | Lottery prize | SKIP | No active lottery campaign |
| 10 | App Link autoVerify deep link | PASS | Chrome → `mandybubbletea.com/menu` opens Mandy app directly (no chooser); `assetlinks.json` SHA-256 validates against EAS keystore |

**Total:** 8 PASS / 0 FAIL / 2 SKIP

## Bugs discovered + fixed in same session

1. **DEVELOPER_ERROR red herring** — Google Play Services internal Phenotype API was throwing `DEVELOPER_ERROR` in logcat for unrelated flag-store lookups. Initially misread as Google Sign-In SHA-1 mismatch. Real root cause was Android 9+ cleartext HTTP block preventing post-auth API calls. Lesson: Phenotype API errors at random PIDs ≠ Google Sign-In SHA-1 issue.
2. **Cleartext HTTP block** (`cfc27d2`) — Android SDK 28+ blocks cleartext by default; APK had no `usesCleartextTraffic` setting or network security config. Fixed surgically by whitelisting only `localhost` / `10.0.2.2` (emulator) / `192.168.0.{116,82}` (Mac LAN).
3. **Pay button double-tap → 400 "Card nonce not found"** (`f58bb2e`) — Pre-existing cross-platform bug. Square's single-use nonce got re-submitted because `setProcessing(true)` is async; React commit cycle leaves a ~16ms window for second tap to fire before button disables. Fixed with synchronous `useRef`-based guard at top of `handlePay`.

## Pending verification for distribution APK (build #5)

The smoke above used build #4 which had:
- Localhost dev URL (`http://192.168.0.116:3000`)
- Sandbox Square credentials
- Cleartext exception
- No double-tap fix

The production distribution APK (build #5, kicked off via `eas build --profile preview-android --platform android`, commit `da766c8`) flips:
- API URL → `https://mandybubbletea.com` (Vercel prod)
- Square → `sq0idp-1IOAOYqjBpdqlMPwxWpqXA` production credentials
- Includes double-tap fix `f58bb2e`

The cleartext exception remains (harmless — only whitelists Stan's LAN IPs which are not reachable in production). Production traffic still goes HTTPS.

**Smoke needed on build #5 before QR distribution:**
- Pixel install new APK, leave Stan's Wi-Fi (mobile data / different Wi-Fi)
- Cases 1-3 + 10 cover the prod-URL change verification
- Case 4 with a REAL credit card (not sandbox) confirms production Square path — Stan to decide whether to risk a $5-ish real transaction for verification
