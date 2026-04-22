# Apple Wallet Member Card — Design Spec

**Date**: 2026-04-20
**Status**: Draft — awaiting implementation plan
**Scope**: iOS Apple Wallet (Phase 1). Android Google Wallet deferred to Phase 2.
**Repos touched**: `mandys_bubble_tea` (Next.js backend), `mandys_bubble_tea_app` (Expo RN app)

## Goals

Let a Mandy's customer add a live-updating membership card to Apple Wallet. Stars earned in-store or in-app reflect on the wallet pass within ~2 seconds. The pass looks exactly like the Claude Design handoff in `/Users/stanyan/Downloads/mandy-s-bubble-tea-app/project/Wallet.html` (source of truth for visual).

Non-goals for Phase 1:
- Google Wallet (Android)
- Multi-location (single store)
- In-pass reward redemption flow beyond "scan at counter"
- Pass sharing / transfer between Apple IDs

## Visual source of truth

Reference file: `<handoff>/project/src/WalletPass.jsx` (Claude Design export).

Brand tokens (override current app `#C43A10` brick red — pass uses handoff palette):
- Brown `#8D5524` — pass front background
- Brown dark `#6E4019` — gradient bottom + back text
- Sage `#A2AD91` — accent (unused on pass front currently, reserved)
- Cream `#FFF9F0` — pass back background + stamp fill
- Peach `#FFB380` — reserved

Typography on pass:
- `Fraunces` 500 serif — primary field (`Member {name}`, size 28pt)
- `JetBrains Mono` — header stars `7/9`, ID `MB-4182`, barcode serial
- `-apple-system` — field labels + secondary values

## § 1 — System architecture

```
RN App ──[POST /api/wallet/pass]──▶ Next.js on Vercel ──signs──▶ .pkpass ──▶ iOS PassKit UI
                                          │
                                          ├── Supabase (wallet_passes, wallet_pass_devices)
                                          │
                              Square Loyalty webhook
                                          │
                                          ▼
                                   QStash queue
                                          │
                                          ▼
                                Worker signs new pass
                                          │
                                          ▼
                              APNs HTTP/2 empty push ──▶ iOS Wallet ──GET──▶ Next.js ──▶ fresh .pkpass
```

Three external dependencies:
- **Vercel** (Next.js backend, existing)
- **Supabase** (existing, new tables added)
- **Upstash QStash** (new, free tier)
- **Apple Push Notification service** (new, JWT token auth)

## § 2 — Data model (Supabase)

```sql
-- Sequence for member_number generation; start at 4182 per handoff
CREATE SEQUENCE mandy_member_seq START 4182 INCREMENT 1;

CREATE TABLE wallet_passes (
  serial_number   text PRIMARY KEY,           -- 'mb-4182-<uuid8>'
  customer_id     text NOT NULL UNIQUE,       -- Square customer id
  member_number   text NOT NULL UNIQUE,       -- 'MB-4182'
  auth_token      text NOT NULL,              -- 16-byte hex, pkpass authenticationToken
  pass_type_id    text NOT NULL,              -- 'pass.com.mandysbubbletea.membercard'
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()   -- bumped on every stars change
);
CREATE INDEX wallet_passes_customer_idx ON wallet_passes (customer_id);

CREATE TABLE wallet_pass_devices (
  device_library_id text NOT NULL,            -- Apple-provided device UUID
  serial_number     text NOT NULL REFERENCES wallet_passes(serial_number) ON DELETE CASCADE,
  push_token        text NOT NULL,
  registered_at     timestamptz DEFAULT now(),
  PRIMARY KEY (device_library_id, serial_number)
);
CREATE INDEX wallet_pass_devices_serial_idx ON wallet_pass_devices (serial_number);
```

`member_number` generation: at first pass issuance, `SELECT nextval('mandy_member_seq')` → `MB-${value}`. Starting at 4182 matches handoff visual precedent.

`auth_token`: `crypto.randomBytes(16).toString('hex')` at issuance. Every Apple webService route verifies `Authorization: ApplePass <token>` matches `wallet_passes.auth_token`.

**Data source mapping (Square customer → pass fields):**

| Pass field | Source |
|---|---|
| `primaryFields[member]` value | Square customer `given_name + " " + family_name`, trimmed; fallback to phone last-4 if both blank |
| `headerFields[stars]` value | `(loyalty.balance % 9) + "/9"` — matches existing `StarsProgress` component logic; 11 balance → `2/9` |
| `secondaryFields[since]` value | Square customer `created_at` formatted `MMM YYYY` (e.g. `May 2024`) |
| `secondaryFields[id]` value | `wallet_passes.member_number` (e.g. `MB-4182`) |
| `secondaryFields[reward]` value | `"Free drink"` if `loyalty.available_rewards.length === 0`, else `"Ready to redeem!"` |

## § 3 — pkpass payload + assets

Pass type: `storeCard`.

`pass.json` template (values filled per customer at sign time):
```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.mandysbubbletea.membercard",
  "serialNumber": "mb-4182-a1b2c3d4",
  "teamIdentifier": "<APPLE_TEAM_ID>",
  "organizationName": "Mandy's Bubble Tea",
  "description": "Mandy's Member Card",
  "webServiceURL": "https://mandybubbletea.com/api/wallet",
  "authenticationToken": "<16-byte hex>",
  "backgroundColor": "rgb(141, 85, 36)",
  "foregroundColor": "rgb(255, 255, 255)",
  "labelColor": "rgba(255, 255, 255, 0.72)",
  "logoText": "Mandy's",
  "storeCard": {
    "headerFields": [
      { "key": "stars", "label": "STARS", "value": "7/9", "textAlignment": "PKTextAlignmentRight" }
    ],
    "primaryFields": [
      { "key": "member", "label": "MEMBER", "value": "Stan Yan" }
    ],

    "secondaryFields": [
      { "key": "reward", "label": "NEXT REWARD", "value": "Free drink" },
      { "key": "since",  "label": "MEMBER SINCE", "value": "May 2024" },
      { "key": "id",     "label": "ID", "value": "MB-4182", "textAlignment": "PKTextAlignmentRight" }
    ],
    "backFields": [
      { "key": "terms",   "label": "Terms",   "value": "Earn 1 star per drink. 9 stars = 1 free drink of equal or lesser value. Not redeemable for cash. Present pass at checkout or scan to redeem." },
      { "key": "store",   "label": "Store",   "value": "34 Davenport St, Southport QLD 4215" },
      { "key": "phone",   "label": "Phone",   "value": "0404 978 238" },
      { "key": "hours",   "label": "Hours",   "value": "Mon–Sun · 10:00–22:30" },
      { "key": "website", "label": "Website", "value": "https://mandybubbletea.com" }
    ],
    "barcodes": [
      {
        "format": "PKBarcodeFormatQR",
        "message": "<serialNumber>",
        "messageEncoding": "iso-8859-1",
        "altText": "<serialNumber_alnum>"
      }
    ]
  }
}
```

Assets packaged in every .pkpass:
- `icon.png`, `icon@2x.png`, `icon@3x.png` (29/58/87 px) — static
- `logo.png`, `logo@2x.png`, `logo@3x.png` (max 160×50 pt) — static, white glyph on transparent
- `strip.png`, `strip@2x.png`, `strip@3x.png` (340×123 pt) — **dynamic**, rendered per sign

**Strip generation**: Apple Wallet has no native grid component. The "9-cup stamp strip" in handoff must be rasterized server-side:

- Use `@napi-rs/canvas` or `sharp` to render 1020×369 px (@3x) canvas at sign time
- Brown background `#8D5524`
- 9 evenly-spaced circles (diameter ~80 px), gap 18 px, centered
- Filled circles (index < stars): cream `#FFF9F0` background + embedded small Mandy logo glyph in brown
- Empty circles: dashed stroke `rgba(255,255,255,0.55)`, 1.5px
- Cached per (`memberNumber`, `stars`) tuple — regenerated only when stars change

Static assets (icon, logo, WWDR cert) live in `mandys_bubble_tea/assets/wallet/`.

## § 4 — API endpoints

All routes live in `mandys_bubble_tea/src/app/api/`.

### Business endpoints

**`POST /api/wallet/pass/exchange`** — app-authenticated, returns short-lived exchange token

- Auth: Supabase JWT in `Authorization: Bearer <jwt>` header
- Returns: `{ token: string, expiresAt: number }` — token is opaque 32-byte hex, TTL 60s, stored in Supabase `wallet_exchange_tokens` keyed to `customer_id`
- App passes `token` as query param to the GET below

**`GET /api/wallet/pass?token=<exchange>`** — returns signed .pkpass, suitable for Safari / WebBrowser

- Auth: exchange token (single-use, TTL 60s)
- Response: `Content-Type: application/vnd.apple.pkpass`, binary body
- Behavior:
  1. Validate + consume exchange token → get `customer_id`
  2. Look up Square customer
  3. `upsert wallet_passes` (create if new, reuse serial_number if existing)
  4. Fetch Square loyalty balance
  5. Render strip.png at current stars
  6. Sign .pkpass with `passkit-generator`
  7. Return buffer

### Apple-required webService endpoints

All under `/api/wallet/v1/`. Spec: [PassKit Web Service Reference](https://developer.apple.com/documentation/walletpasses).

**`POST /api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]`**
- Auth: `Authorization: ApplePass <authenticationToken>`
- Body: `{ pushToken: string }`
- Returns: 201 (new registration), 200 (already registered), 401 (bad token), 404 (no such pass)
- Writes: `wallet_pass_devices` upsert

**`GET /api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]?passesUpdatedSince=<tag>`**
- Returns: `{ lastUpdated: string, serialNumbers: string[] }`
- Returns 204 if no updates

**`GET /api/wallet/v1/passes/[passTypeIdentifier]/[serialNumber]`**
- Auth: `Authorization: ApplePass <token>`
- Headers in: `If-Modified-Since`
- Returns: 200 with fresh .pkpass, or 304 Not Modified, or 401
- Behavior: re-signs pass with current Square loyalty data

**`DELETE /api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]`**
- Auth: `Authorization: ApplePass <token>`
- Deletes from `wallet_pass_devices`, returns 200

**`POST /api/wallet/v1/log`** — optional, logs Apple client-side errors to server
- Body: `{ logs: string[] }`
- Just writes to Vercel logs; always 200

### Webhook + worker

**`POST /api/webhooks/square`** — Square event ingress
- Verifies HMAC-SHA256 via `SQUARE_WEBHOOK_SIGNATURE_KEY`
- Event filter: `loyalty.points.updated`, `loyalty.reward.created`, `loyalty.reward.redeemed`
- Looks up `wallet_passes.serial_number` by `customer_id`
- If found: `qstash.publishJSON({ url: '/api/wallet/worker/push', body: { serialNumber }, retries: 3 })`
- Returns 200 within ~300ms regardless (Square requires fast ACK)

**`POST /api/wallet/worker/push`** — QStash-invoked async worker
- Verifies QStash signature (`@upstash/qstash` SDK)
- Body: `{ serialNumber: string }`
- Steps:
  1. `UPDATE wallet_passes SET updated_at = now() WHERE serial_number = ?`
  2. `SELECT push_token FROM wallet_pass_devices WHERE serial_number = ?`
  3. For each token: `POST https://api.push.apple.com/3/device/{token}` with `apns-topic: pass.com.mandysbubbletea.membercard` and empty `{}` body
  4. On 410 response: `DELETE FROM wallet_pass_devices WHERE push_token = ?`
  5. On 429/5xx: throw → QStash retries per config
  6. Return 200 on overall success (even if individual tokens failed)

## § 5 — Update push flow timing

**Typical path (user orders in-store, 0 → 1 stars):**

| T (ms) | Step |
|---|---|
| 0 | Square records loyalty accumulate |
| 200 | Square webhook → Next.js `/api/webhooks/square` |
| 250 | HMAC verified, serialNumber looked up |
| 300 | QStash.publish → 200 returned to Square |
| 500 | QStash invokes `/api/wallet/worker/push` |
| 550 | `updated_at` bumped, device tokens fetched |
| 600 | APNs HTTP/2 POST (parallel per device) |
| 1000 | iOS Wallet daemon receives empty push |
| 1200 | Device GET `/api/wallet/v1/passes/.../...` with If-Modified-Since |
| 1400 | Strip PNG regenerated, pkpass resigned, 200 returned |
| 1500 | Wallet card updates on lock screen / Wallet UI |

**Failure modes and recovery:**

- Square webhook down: Square retries (5 attempts over hours). We're idempotent via `updated_at`.
- QStash down: Square webhook fails to publish → returns 500 → Square retries. Last-resort: Apple Wallet auto-polls every 24h.
- APNs down: worker returns 500 → QStash retries (3x). After exhaustion, next loyalty event re-triggers.
- Vercel timeout mid-sign: worker retries idempotently (pass signing is pure).
- Customer never added pass: webhook finds no `wallet_passes` row → skips → zero-cost path.
- Device uninstalled pass: iOS auto-fires DELETE → row removed → future pushes skip that token.

## § 6 — App side: Add to Apple Wallet button

**File**: new `components/account/AddToWalletButton.tsx`

**Position**: in `app/(tabs)/account.tsx`, immediately below `<MemberQrCard />`.

**Visual**: Apple's official [Add to Apple Wallet badge](https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/). Black background, exact SVG/PNG from Apple's brand resources. Do not restyle.

**Platform gate**: `if (Platform.OS !== 'ios') return null`. Android renders nothing here in Phase 1.

**State machine**:
- `idle` — initial, button visible
- `loading` — after tap, POSTing to backend
- `added` — pass successfully handed to PassKit; button shows "Card added to Wallet ✓" grey state
- `error` — network failure or pkpass rejection; inline retry

**Flow** (iOS does not auto-invoke PassKit on local file URIs — actual pattern):
1. User taps button → set `loading`
2. Fetch Supabase JWT
3. Open backend URL via `WebBrowser.openBrowserAsync('https://mandybubbletea.com/api/wallet/pass?token=<short-lived-exchange-token>')` using `expo-web-browser`
   - Backend verifies exchange token, returns `.pkpass` with `Content-Type: application/vnd.apple.pkpass`
   - iOS Safari / SFSafariViewController detects the MIME type and auto-presents the PassKit add-to-wallet sheet
4. User dismisses sheet; WebBrowser closes and returns control to app
5. Optimistically set `added` state and persist boolean to AsyncStorage key `mandy_wallet_added`
6. If `added`: hide button, show small "Open in Wallet" link using `Linking.openURL('shoebox://url-shortcut/pass/...')` (iOS auto-opens Wallet app to that pass; fallback to opening Wallet app root via `Linking.openURL('wallet://')`)

**Why not local file + Linking**: `Linking.openURL('file:///.../foo.pkpass')` does not trigger PassKit on iOS — file scheme isn't handled. Using an HTTPS response with correct MIME is the reliable path.

**Short-lived exchange token**: backend issues a one-time token tied to Supabase user ID, expires in 60s. Avoids passing Supabase JWT through browser URL.

**Native module for pass presence** (deferred to Phase 1.5):
- Detecting "is pass already added" requires `PKPassLibrary` from Swift. Phase 1 uses AsyncStorage boolean (doesn't survive pass removal but fine for most cases). Phase 1.5 may add an expo-module wrapping `containsPass(passTypeId, serial)` for accurate state.

**Dependencies**:
- `expo-web-browser` (add if missing)
- `expo-linking` (verify present)
- No new native builds required.

## § 7 — Certificate bootstrap (implementation T0 prerequisite)

Before any code ships, the user performs these steps on their Mac (I guide interactively):

1. **Generate CSR in Keychain Access**
   - Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Email: `stanhavenoidea@gmail.com`; common name: "Mandy's Pass Signing"
   - "Saved to disk" + "Let me specify key pair information"
   - Save `mandys-pass.certSigningRequest`. Private key stays in login keychain — do not delete it.

2. **Create Pass Type ID on developer.apple.com**
   - Identifiers → + → Pass Type IDs
   - Identifier: `pass.com.mandysbubbletea.membercard`
   - Description: "Mandy's Bubble Tea Member Card"
   - Create Certificate → upload `mandys-pass.certSigningRequest` → download `pass.cer`

3. **Export .p12 from Keychain**
   - Double-click `pass.cer` to install
   - Find "Pass Type ID: pass.com.mandysbubbletea.membercard" in login keychain
   - Right-click → Export → `mandys-pass.p12` with a memorable passphrase

4. **Download Apple WWDR G4 intermediate cert** from `https://www.apple.com/certificateauthority/`

5. **Convert to PEM**
   ```bash
   openssl pkcs12 -in mandys-pass.p12 -nocerts -nodes -passin pass:<pw> | openssl rsa > pass.key
   openssl pkcs12 -in mandys-pass.p12 -clcerts -nokeys -passin pass:<pw> > pass.pem
   openssl x509 -in AppleWWDRCAG4.cer -inform DER -out wwdr.pem
   ```

6. **Create APNs auth key (token-based, preferred)**
   - developer.apple.com → Keys → + → APNs → download `.p8`
   - Note Key ID and Team ID

7. **Add to Vercel env vars** (production environment)
   - `APPLE_PASS_CERT_PEM` — content of `pass.pem`
   - `APPLE_PASS_KEY_PEM` — content of `pass.key`
   - `APPLE_PASS_WWDR_PEM` — content of `wwdr.pem`
   - `APPLE_TEAM_ID` — e.g. `ABCDE12345`
   - `APPLE_PASS_TYPE_ID` — `pass.com.mandysbubbletea.membercard`
   - `APNS_AUTH_KEY_P8` — content of `.p8` file
   - `APNS_KEY_ID` — 10-char key id
   - `APNS_HOST` — `api.push.apple.com` (production) or `api.sandbox.push.apple.com` (dev)
   - `QSTASH_TOKEN` — from Upstash console
   - `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` — for signature verification

8. **Renewal reminders**:
   - Pass Type ID cert expires yearly — calendar reminder 11 months out.
   - APNs JWT auth key does **not** expire, no renewal needed.
   - WWDR G4 intermediate cert valid through 2030.

Also add `wallet_exchange_tokens` table now (referenced in § 4):

```sql
CREATE TABLE wallet_exchange_tokens (
  token        text PRIMARY KEY,                -- 32-byte hex
  customer_id  text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz
);
CREATE INDEX wallet_exchange_tokens_customer_idx ON wallet_exchange_tokens (customer_id);
-- cleanup: cron deletes where expires_at < now() - '1 day'
```

## § 8 — Testing strategy

### Unit
- `wallet_passes` upsert idempotent (same customer_id reused → same serial_number, auth_token reused)
- `member_number` sequence advances atomically, never skips
- `auth_token` comparison constant-time (avoid timing attack)
- `If-Modified-Since` correctly returns 304 when `updated_at <= header`

### Integration (Vitest + Supabase local)
- `/api/wallet/pass` happy path: JWT → phone → Square customer → signed .pkpass
- `/api/wallet/pass` auth failure returns 401
- `/api/wallet/pass` Square customer not found → 404
- Signed pkpass:
  - Unzippable
  - `manifest.json` SHA1 matches each asset
  - `signature` verifies against WWDR chain (use `node-passkit-signer` verify)
- Strip PNG pixel-diff baseline per (stars = 0..9) using `pixelmatch` and golden images checked into repo

### Manual end-to-end on TestFlight
1. Build app with `AddToWalletButton` enabled → install on iPhone
2. Account tab → tap "Add to Apple Wallet" → verify PassKit sheet appears → add → verify pass visual matches handoff exactly
3. Order a drink via Square POS or app → within 2s, pass should update stars on lock screen
4. Have second iPhone add the same pass → order again → both devices update
5. Delete pass from Wallet on device A → order again → device A no longer receives (row cleaned), device B still updates
6. POS scan test: Square Register scans QR → parses → reverse-lookup `customer_id` from `serial_number` → attach to open sale → confirm star accrual flows back via webhook

### Load test (optional)
- Script posting 50 concurrent webhook events → verify QStash queues and drains without dropped pushes

## Risks

- **QR POS compat**: Square Register internal camera scans QR reliably (same format as app's MemberQrCard, already proven in deployment plan). If QR unexpectedly fails, fallback is switching `barcodes[0].format` to `PKBarcodeFormatPDF417` or `PKBarcodeFormatAztec` — no other changes needed. POS test must happen before wide rollout.
- **Vercel Serverless cold start**: first pkpass sign after idle can take 1.5–2s. Acceptable for manual "Add to Wallet" tap but worth observing on webhook path. Mitigation: Vercel edge config pinned region `syd1` (Sydney).
- **APNs certificate-vs-token auth**: Wallet passes historically required pass-type-specific push cert. As of iOS 16, token-based auth works for passes. Spec assumes token-based. If rollout hits auth errors, fall back to cert-based (additional `.p12` env var).
- **Stars field overflow visual**: `headerFields` truncates long values. Max `"9/9"` = 3 chars, fits.
- **Strip PNG generation in Serverless**: `@napi-rs/canvas` ships native binaries; verify Vercel build includes linux-x64. `sharp` as fallback.

## Open questions (deferred)

- Do we pre-register a pass for every Square customer, or lazily only when they tap "Add to Wallet"? Spec assumes lazy.
- Pass sharing (`sharingProhibited: true`?) — spec defaults to sharing allowed.
- Localization (en-AU vs en-US) — spec uses default English, no `.lproj`.
- What happens if customer phone changes? Pass is keyed by `customer_id`, not phone — phone change does not invalidate pass.

## Android Google Wallet (Phase 2 stub)

Backend design reserves an abstraction seam: `lib/wallet/providers/apple.ts` and future `google.ts` both expose `issuePass(customerId) → buffer|url` and `pushUpdate(serialNumber) → void`. Worker/webhook loops over both providers. Phase 1 only implements `apple.ts`; `google.ts` returns stubs.
