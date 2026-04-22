# Apple Wallet Member Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a live-updating Apple Wallet membership card for Mandy's Bubble Tea customers. Pass visual matches the Claude Design handoff (`WalletPass.jsx`). Stars update via Square loyalty webhooks through a QStash queue + APNs push.

**Architecture:** Next.js (Vercel) backend signs `.pkpass` files with `passkit-generator`, serves Apple's 4-route webService, and pushes updates via APNs HTTP/2 triggered by a Square webhook → Upstash QStash queue → worker. The RN app adds an "Add to Apple Wallet" button that opens the pkpass URL in `expo-web-browser` (iOS auto-invokes PassKit sheet). Supabase stores `wallet_passes`, `wallet_pass_devices`, and short-lived `wallet_exchange_tokens`.

**Tech Stack:**
- Backend: Next.js 16 App Router, TypeScript, `passkit-generator`, `@napi-rs/canvas`, `@upstash/qstash`, `http2` (Node built-in, for APNs)
- App: Expo SDK 54, `expo-web-browser`, `expo-linking`
- DB: Supabase Postgres
- Queue: Upstash QStash
- Push: Apple APNs HTTP/2 (JWT token auth via `.p8` key)
- Testing: Vitest (new), `pixelmatch` for strip image diffs

**Spec:** `docs/superpowers/specs/2026-04-20-apple-wallet-member-card-design.md`

**Repos:**
- Backend: `~/Github/mandys_bubble_tea` (Next.js)
- App: `~/Github/mandys_bubble_tea_app` (Expo RN)

---

## Phase 0 — Certificate Bootstrap (interactive, human-driven)

### Task 0.1: Generate CSR on user's Mac

**Files:** none (human action)

- [ ] **Step 1: Open Keychain Access**

  Tell user: open Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority.

- [ ] **Step 2: Fill CSR fields**

  Email: `stanhavenoidea@gmail.com`. Common Name: `Mandy's Pass Signing`. CA Email: blank. Request is: "Saved to disk". Check "Let me specify key pair information". Continue.

- [ ] **Step 3: Key pair settings**

  Key Size: 2048 bits. Algorithm: RSA. Save `mandys-pass.certSigningRequest` to Desktop.

- [ ] **Step 4: Verify private key persisted**

  User confirms in Keychain → login → Keys that a "Mandy's Pass Signing" private key exists. Do NOT delete it.

### Task 0.2: Create Pass Type ID on developer.apple.com

**Files:** none (human action)

- [ ] **Step 1: Navigate to Identifiers**

  Tell user: go to `https://developer.apple.com/account/resources/identifiers/list/passTypeId`. Click `+`.

- [ ] **Step 2: Register Pass Type ID**

  Description: `Mandy's Bubble Tea Member Card`. Identifier: `pass.com.mandysbubbletea.membercard`. Continue → Register.

- [ ] **Step 3: Create certificate for Pass Type ID**

  Click the new Pass Type ID → "Create Certificate". Upload `mandys-pass.certSigningRequest` → Continue. Download `pass.cer` to Desktop.

- [ ] **Step 4: Install certificate**

  Double-click `pass.cer` to add it to login keychain.

### Task 0.3: Export .p12 and convert to PEM

**Files:** temporary files on user's Desktop

- [ ] **Step 1: Export .p12 from Keychain**

  In Keychain Access → login → Certificates, find `Pass Type ID: pass.com.mandysbubbletea.membercard`. Right-click → Export → save as `mandys-pass.p12`. Set a strong passphrase and write it down.

- [ ] **Step 2: Download WWDR G4 intermediate cert**

  ```bash
  curl -o ~/Desktop/AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
  ```

- [ ] **Step 3: Convert to PEM** (prompt user for passphrase)

  ```bash
  cd ~/Desktop
  openssl pkcs12 -in mandys-pass.p12 -nocerts -nodes -legacy | openssl rsa > pass.key
  openssl pkcs12 -in mandys-pass.p12 -clcerts -nokeys -legacy > pass.pem
  openssl x509 -in AppleWWDRCAG4.cer -inform DER -out wwdr.pem
  ```

- [ ] **Step 4: Verify outputs**

  ```bash
  head -1 ~/Desktop/pass.key   # expect: -----BEGIN RSA PRIVATE KEY-----
  head -1 ~/Desktop/pass.pem   # expect: Bag Attributes OR -----BEGIN CERTIFICATE-----
  head -1 ~/Desktop/wwdr.pem   # expect: -----BEGIN CERTIFICATE-----
  ```

### Task 0.4: Create APNs .p8 key

**Files:** none (human action)

- [ ] **Step 1: Create key on developer.apple.com**

  Navigate to `https://developer.apple.com/account/resources/authkeys/list`. Click `+`. Name: `Mandy's Wallet APNs`. Enable "Apple Push Notifications service (APNs)". Continue → Register → Download `AuthKey_XXXXXXXXXX.p8` to Desktop. Note the 10-char Key ID printed on the page.

- [ ] **Step 2: Record Team ID**

  Top right of developer.apple.com → account membership → copy the 10-char Team ID.

### Task 0.5: Add env vars to Vercel

**Files:** Vercel dashboard (human action)

- [ ] **Step 1: Open project env settings**

  Vercel dashboard → `mandys_bubble_tea` project → Settings → Environment Variables.

- [ ] **Step 2: Add secrets (Production scope)**

  For each of the following, click "Add New" and paste:

  | Name | Source |
  |---|---|
  | `APPLE_PASS_CERT_PEM` | contents of `~/Desktop/pass.pem` |
  | `APPLE_PASS_KEY_PEM` | contents of `~/Desktop/pass.key` |
  | `APPLE_PASS_WWDR_PEM` | contents of `~/Desktop/wwdr.pem` |
  | `APPLE_PASS_KEY_PASSPHRASE` | the p12 passphrase |
  | `APPLE_TEAM_ID` | 10-char team id |
  | `APPLE_PASS_TYPE_ID` | `pass.com.mandysbubbletea.membercard` |
  | `APNS_AUTH_KEY_P8` | contents of the `.p8` file |
  | `APNS_KEY_ID` | 10-char key id from task 0.4 |
  | `APNS_HOST` | `api.push.apple.com` |
  | `WALLET_WEBSERVICE_URL` | `https://mandybubbletea.com/api/wallet` |

- [ ] **Step 3: Add QStash vars** (after task 0.6)

  | `QSTASH_TOKEN` | from Upstash |
  | `QSTASH_CURRENT_SIGNING_KEY` | from Upstash |
  | `QSTASH_NEXT_SIGNING_KEY` | from Upstash |

### Task 0.6: Provision Upstash QStash

**Files:** none (human action)

- [ ] **Step 1: Create account**

  Go to `https://console.upstash.com/qstash`. Sign in / sign up. Free tier is fine (500 req/day).

- [ ] **Step 2: Copy tokens**

  From QStash dashboard → Request Builder tab, copy:
  - `QSTASH_TOKEN`
  - `QSTASH_CURRENT_SIGNING_KEY`
  - `QSTASH_NEXT_SIGNING_KEY`

  Paste into Vercel env vars (task 0.5 step 3).

- [ ] **Step 3: Commit local file cleanup**

  After all env vars are in Vercel, delete the PEM/p8/cer/p12 files from `~/Desktop` to avoid accidental commits:
  ```bash
  rm ~/Desktop/pass.key ~/Desktop/pass.pem ~/Desktop/wwdr.pem ~/Desktop/mandys-pass.p12 ~/Desktop/pass.cer ~/Desktop/mandys-pass.certSigningRequest ~/Desktop/AppleWWDRCAG4.cer ~/Desktop/AuthKey_*.p8
  ```

---

## Phase 1 — Backend foundation (Supabase, deps, test harness)

### Task 1.1: Write Supabase migration for wallet tables

**Files:**
- Create: `mandys_bubble_tea/supabase/migrations/2026-04-20-wallet-passes.sql`

- [ ] **Step 1: Write migration**

  ```sql
  -- Apple Wallet membership card: pass registry + device registrations
  --                                + short-lived exchange tokens for app → browser handoff

  -- Sequence for MB-xxxx numbers; starts at 4182 per handoff design precedent
  CREATE SEQUENCE IF NOT EXISTS mandy_member_seq START 4182 INCREMENT 1;

  CREATE TABLE IF NOT EXISTS wallet_passes (
    serial_number   text PRIMARY KEY,
    customer_id     text NOT NULL UNIQUE,
    member_number   text NOT NULL UNIQUE,
    auth_token      text NOT NULL,
    pass_type_id    text NOT NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS wallet_passes_customer_idx ON wallet_passes (customer_id);

  CREATE TABLE IF NOT EXISTS wallet_pass_devices (
    device_library_id text NOT NULL,
    serial_number     text NOT NULL REFERENCES wallet_passes(serial_number) ON DELETE CASCADE,
    push_token        text NOT NULL,
    registered_at     timestamptz DEFAULT now(),
    PRIMARY KEY (device_library_id, serial_number)
  );
  CREATE INDEX IF NOT EXISTS wallet_pass_devices_serial_idx ON wallet_pass_devices (serial_number);

  CREATE TABLE IF NOT EXISTS wallet_exchange_tokens (
    token        text PRIMARY KEY,
    customer_id  text NOT NULL,
    created_at   timestamptz DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    consumed_at  timestamptz
  );
  CREATE INDEX IF NOT EXISTS wallet_exchange_tokens_customer_idx ON wallet_exchange_tokens (customer_id);
  ```

- [ ] **Step 2: Apply to Supabase**

  Run via Supabase CLI or the project's existing migration mechanism (the repo has `supabase/migrations/` — user should confirm how they typically apply; if manual, copy-paste into Supabase SQL editor).

- [ ] **Step 3: Verify tables exist**

  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'wallet_%';
  ```
  Expected: 3 rows (`wallet_passes`, `wallet_pass_devices`, `wallet_exchange_tokens`).

- [ ] **Step 4: Commit**

  ```bash
  cd ~/Github/mandys_bubble_tea
  git add supabase/migrations/2026-04-20-wallet-passes.sql
  git commit -m "feat(supabase): add wallet_passes + devices + exchange_tokens tables"
  ```

### Task 1.2: Install backend dependencies

**Files:**
- Modify: `mandys_bubble_tea/package.json`

- [ ] **Step 1: Install runtime deps**

  ```bash
  cd ~/Github/mandys_bubble_tea
  npm install passkit-generator @upstash/qstash @napi-rs/canvas jose
  ```

  - `passkit-generator`: .pkpass signing
  - `@upstash/qstash`: queue client + signature verification
  - `@napi-rs/canvas`: strip.png rendering (Vercel-compatible native canvas)
  - `jose`: APNs JWT signing (ES256)

- [ ] **Step 2: Install dev deps**

  ```bash
  npm install -D vitest @vitest/coverage-v8 pixelmatch pngjs @types/pngjs
  ```

- [ ] **Step 3: Add test scripts to package.json**

  Modify `scripts`:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- [ ] **Step 4: Create `vitest.config.ts`**

  ```typescript
  import { defineConfig } from 'vitest/config'
  import path from 'node:path'

  export default defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
  })
  ```

- [ ] **Step 5: Verify**

  ```bash
  npx vitest run --reporter=verbose
  ```
  Expected: `No test files found` (no tests yet) — exit code 0 or 1, but no import errors.

- [ ] **Step 6: Commit**

  ```bash
  git add package.json package-lock.json vitest.config.ts
  git commit -m "chore: add passkit-generator, qstash, canvas, vitest for wallet feature"
  ```

### Task 1.3: Add wallet constants module

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/constants.ts`

- [ ] **Step 1: Write file**

  ```typescript
  // Brand tokens for Apple Wallet pass — DIFFERENT from main app (#C43A10)
  // per Claude Design handoff. See spec § Visual source of truth.
  export const PASS_BRAND = {
    brown: '#8D5524',
    brownDark: '#6E4019',
    sage: '#A2AD91',
    cream: '#FFF9F0',
  } as const

  export const PASS_BG_RGB = 'rgb(141, 85, 36)'
  export const PASS_FG_RGB = 'rgb(255, 255, 255)'
  export const PASS_LABEL_RGBA = 'rgba(255, 255, 255, 0.72)'

  export const LOYALTY_REWARD_THRESHOLD = 9

  export const STORE_INFO = {
    address: '34 Davenport St, Southport QLD 4215',
    phone: '0404 978 238',
    hours: 'Mon–Sun · 10:00–22:30',
    website: 'https://mandybubbletea.com',
  } as const

  export const PASS_TERMS =
    'Earn 1 star per drink. 9 stars = 1 free drink of equal or lesser value. ' +
    'Not redeemable for cash. Present pass at checkout or scan to redeem.'
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/lib/wallet/constants.ts
  git commit -m "feat(wallet): constants module for pass brand tokens + store info"
  ```

### Task 1.4: Add wallet env helper module

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/env.ts`

- [ ] **Step 1: Write file**

  ```typescript
  import "server-only"

  function req(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`[wallet] missing env var: ${name}`)
    return v
  }

  export function walletEnv() {
    return {
      certPem: req('APPLE_PASS_CERT_PEM'),
      keyPem: req('APPLE_PASS_KEY_PEM'),
      wwdrPem: req('APPLE_PASS_WWDR_PEM'),
      keyPassphrase: req('APPLE_PASS_KEY_PASSPHRASE'),
      teamId: req('APPLE_TEAM_ID'),
      passTypeId: req('APPLE_PASS_TYPE_ID'),
      apnsAuthKey: req('APNS_AUTH_KEY_P8'),
      apnsKeyId: req('APNS_KEY_ID'),
      apnsHost: process.env.APNS_HOST ?? 'api.push.apple.com',
      webServiceUrl: req('WALLET_WEBSERVICE_URL'),
      qstashToken: req('QSTASH_TOKEN'),
      qstashCurrentSigningKey: req('QSTASH_CURRENT_SIGNING_KEY'),
      qstashNextSigningKey: req('QSTASH_NEXT_SIGNING_KEY'),
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/lib/wallet/env.ts
  git commit -m "feat(wallet): env helper with explicit required-var validation"
  ```

### Task 1.5: Add wallet Supabase DAO module

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/db.ts`

- [ ] **Step 1: Read existing Supabase client**

  Run:
  ```bash
  grep -rn "createClient" src/lib/supabase* | head
  ```
  Note the existing pattern for service-role client. Reuse it; do NOT create a new client.

- [ ] **Step 2: Write DAO**

  ```typescript
  import "server-only"
  import crypto from "node:crypto"
  import { getServiceClient } from "@/lib/supabase"  // use whatever the repo exports

  export interface WalletPassRow {
    serial_number: string
    customer_id: string
    member_number: string
    auth_token: string
    pass_type_id: string
    created_at: string
    updated_at: string
  }

  export interface WalletPassDeviceRow {
    device_library_id: string
    serial_number: string
    push_token: string
    registered_at: string
  }

  export async function getPassByCustomerId(customerId: string): Promise<WalletPassRow | null> {
    const db = getServiceClient()
    const { data, error } = await db
      .from('wallet_passes')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle()
    if (error) throw error
    return data ?? null
  }

  export async function getPassBySerial(serial: string): Promise<WalletPassRow | null> {
    const db = getServiceClient()
    const { data, error } = await db.from('wallet_passes').select('*').eq('serial_number', serial).maybeSingle()
    if (error) throw error
    return data ?? null
  }

  export async function issuePass(args: { customerId: string; passTypeId: string }): Promise<WalletPassRow> {
    const db = getServiceClient()

    const existing = await getPassByCustomerId(args.customerId)
    if (existing) return existing

    const { data: seqRows, error: seqErr } = await db.rpc('nextval', { seq_name: 'mandy_member_seq' })
    if (seqErr) {
      // Fallback: raw SQL
      const { data, error } = await db.rpc('exec_sql', { sql: "select nextval('mandy_member_seq') as v" })
      if (error) throw error
      var memberNum = Number((data as { v: number }[])[0]?.v)
    } else {
      var memberNum = Number(seqRows)
    }

    const memberNumber = `MB-${memberNum}`
    const authToken = crypto.randomBytes(16).toString('hex')
    const serial = `mb-${memberNum}-${crypto.randomBytes(4).toString('hex')}`

    const { data, error } = await db
      .from('wallet_passes')
      .insert({
        serial_number: serial,
        customer_id: args.customerId,
        member_number: memberNumber,
        auth_token: authToken,
        pass_type_id: args.passTypeId,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as WalletPassRow
  }

  export async function bumpPassUpdatedAt(serial: string): Promise<void> {
    const db = getServiceClient()
    const { error } = await db
      .from('wallet_passes')
      .update({ updated_at: new Date().toISOString() })
      .eq('serial_number', serial)
    if (error) throw error
  }

  export async function registerDevice(args: {
    deviceLibraryId: string
    serialNumber: string
    pushToken: string
  }): Promise<'created' | 'exists'> {
    const db = getServiceClient()
    const { data: existing } = await db
      .from('wallet_pass_devices')
      .select('push_token')
      .eq('device_library_id', args.deviceLibraryId)
      .eq('serial_number', args.serialNumber)
      .maybeSingle()

    if (existing) {
      if (existing.push_token !== args.pushToken) {
        await db
          .from('wallet_pass_devices')
          .update({ push_token: args.pushToken })
          .eq('device_library_id', args.deviceLibraryId)
          .eq('serial_number', args.serialNumber)
      }
      return 'exists'
    }

    const { error } = await db.from('wallet_pass_devices').insert({
      device_library_id: args.deviceLibraryId,
      serial_number: args.serialNumber,
      push_token: args.pushToken,
    })
    if (error) throw error
    return 'created'
  }

  export async function unregisterDevice(args: {
    deviceLibraryId: string
    serialNumber: string
  }): Promise<void> {
    const db = getServiceClient()
    const { error } = await db
      .from('wallet_pass_devices')
      .delete()
      .eq('device_library_id', args.deviceLibraryId)
      .eq('serial_number', args.serialNumber)
    if (error) throw error
  }

  export async function getDevicePushTokens(serial: string): Promise<string[]> {
    const db = getServiceClient()
    const { data, error } = await db
      .from('wallet_pass_devices')
      .select('push_token')
      .eq('serial_number', serial)
    if (error) throw error
    return (data ?? []).map((r) => r.push_token as string)
  }

  export async function deleteDeviceByPushToken(token: string): Promise<void> {
    const db = getServiceClient()
    await db.from('wallet_pass_devices').delete().eq('push_token', token)
  }

  export async function listSerialsForDevice(
    deviceLibraryId: string,
    passesUpdatedSince?: string,
  ): Promise<{ serials: string[]; lastUpdated: string }> {
    const db = getServiceClient()
    let q = db
      .from('wallet_pass_devices')
      .select('serial_number, wallet_passes!inner(updated_at)')
      .eq('device_library_id', deviceLibraryId)
    if (passesUpdatedSince) {
      q = q.gt('wallet_passes.updated_at', passesUpdatedSince)
    }
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as { serial_number: string; wallet_passes: { updated_at: string } }[]
    const lastUpdated = rows.reduce(
      (max, r) => (r.wallet_passes.updated_at > max ? r.wallet_passes.updated_at : max),
      '1970-01-01T00:00:00Z',
    )
    return { serials: rows.map((r) => r.serial_number), lastUpdated }
  }

  export async function issueExchangeToken(customerId: string): Promise<{ token: string; expiresAt: Date }> {
    const db = getServiceClient()
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60_000)
    const { error } = await db.from('wallet_exchange_tokens').insert({
      token,
      customer_id: customerId,
      expires_at: expiresAt.toISOString(),
    })
    if (error) throw error
    return { token, expiresAt }
  }

  export async function consumeExchangeToken(token: string): Promise<string | null> {
    const db = getServiceClient()
    const { data, error } = await db
      .from('wallet_exchange_tokens')
      .select('*')
      .eq('token', token)
      .is('consumed_at', null)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    if (new Date(data.expires_at) < new Date()) return null
    await db
      .from('wallet_exchange_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('token', token)
    return data.customer_id as string
  }
  ```

- [ ] **Step 3: Verify `getServiceClient` export path**

  Check `src/lib/supabase.ts` for the actual exported service-role client. Adjust the import above to match.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/wallet/db.ts
  git commit -m "feat(wallet): Supabase DAO for passes, devices, exchange tokens"
  ```

---

## Phase 2 — Pass signing

### Task 2.1: Write strip.png renderer with TDD

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/strip.test.ts`
- Create: `mandys_bubble_tea/src/lib/wallet/strip.ts`
- Create: `mandys_bubble_tea/src/lib/wallet/__fixtures__/strip-0.png` … `strip-9.png` (generated in step 4)

- [ ] **Step 1: Write failing test**

  ```typescript
  // src/lib/wallet/strip.test.ts
  import { describe, it, expect } from 'vitest'
  import { renderStrip } from './strip'

  describe('renderStrip', () => {
    it('produces PNG buffer for 0 filled stars', async () => {
      const buf = await renderStrip({ stars: 0, scale: 1 })
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.length).toBeGreaterThan(1000)
      expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG magic
    })

    it('produces different PNGs for different star counts', async () => {
      const a = await renderStrip({ stars: 3, scale: 1 })
      const b = await renderStrip({ stars: 7, scale: 1 })
      expect(a.equals(b)).toBe(false)
    })

    it('at @3x returns 1020x369 canvas', async () => {
      const buf = await renderStrip({ stars: 5, scale: 3 })
      // PNG IHDR chunk byte 16-19 = width, 20-23 = height (big-endian)
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      expect(width).toBe(1020)
      expect(height).toBe(369)
    })

    it('rejects invalid star count', async () => {
      await expect(renderStrip({ stars: 10, scale: 1 })).rejects.toThrow()
      await expect(renderStrip({ stars: -1, scale: 1 })).rejects.toThrow()
    })
  })
  ```

- [ ] **Step 2: Run test, verify failure**

  ```bash
  npx vitest run src/lib/wallet/strip.test.ts
  ```
  Expected: FAIL — cannot find module `./strip`.

- [ ] **Step 3: Implement `strip.ts`**

  ```typescript
  import { createCanvas } from '@napi-rs/canvas'
  import { PASS_BRAND } from './constants'

  export interface StripOptions {
    stars: number        // 0..9 inclusive
    scale?: 1 | 2 | 3    // 1x, 2x, 3x
  }

  const BASE_W = 340  // pt
  const BASE_H = 123  // pt

  export async function renderStrip(opts: StripOptions): Promise<Buffer> {
    if (!Number.isInteger(opts.stars) || opts.stars < 0 || opts.stars > 9) {
      throw new Error(`renderStrip: stars must be integer in [0,9], got ${opts.stars}`)
    }
    const scale = opts.scale ?? 3
    const w = BASE_W * scale
    const h = BASE_H * scale

    const c = createCanvas(w, h)
    const ctx = c.getContext('2d')

    // brown background
    ctx.fillStyle = PASS_BRAND.brown
    ctx.fillRect(0, 0, w, h)

    // 9 circles, evenly spaced. Gap ~10pt edges, center circle row vertically.
    const count = 9
    const edgePad = 12 * scale
    const totalGap = w - edgePad * 2
    const circleD = Math.min(totalGap / count - 6 * scale, h - 24 * scale)
    const circleR = circleD / 2
    const gap = (totalGap - circleD * count) / (count - 1)
    const cy = h / 2

    for (let i = 0; i < count; i++) {
      const cx = edgePad + circleR + i * (circleD + gap)
      const on = i < opts.stars

      if (on) {
        ctx.fillStyle = PASS_BRAND.cream
        ctx.beginPath()
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 1.5 * scale
        ctx.setLineDash([4 * scale, 3 * scale])
        ctx.beginPath()
        ctx.arc(cx, cy, circleR - ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    return c.toBuffer('image/png')
  }
  ```

- [ ] **Step 4: Run tests, verify pass**

  ```bash
  npx vitest run src/lib/wallet/strip.test.ts
  ```
  Expected: 4/4 PASS.

- [ ] **Step 5: Add golden image pixel-diff test**

  ```typescript
  // Append to src/lib/wallet/strip.test.ts
  import fs from 'node:fs'
  import path from 'node:path'
  import { PNG } from 'pngjs'
  import pixelmatch from 'pixelmatch'

  describe('renderStrip golden images', () => {
    const FIXTURES = path.join(__dirname, '__fixtures__')

    it.each([0, 3, 7, 9])('matches golden for stars=%i', async (stars) => {
      const actualBuf = await renderStrip({ stars, scale: 1 })
      const goldenPath = path.join(FIXTURES, `strip-${stars}.png`)
      if (!fs.existsSync(goldenPath)) {
        fs.mkdirSync(FIXTURES, { recursive: true })
        fs.writeFileSync(goldenPath, actualBuf)
        console.warn(`wrote baseline: ${goldenPath}`)
        return
      }
      const actual = PNG.sync.read(actualBuf)
      const golden = PNG.sync.read(fs.readFileSync(goldenPath))
      expect(actual.width).toBe(golden.width)
      expect(actual.height).toBe(golden.height)
      const diff = new PNG({ width: actual.width, height: actual.height })
      const mismatch = pixelmatch(actual.data, golden.data, diff.data, actual.width, actual.height, { threshold: 0.1 })
      expect(mismatch).toBeLessThan(100) // tiny anti-aliasing tolerance
    })
  })
  ```

- [ ] **Step 6: Run tests twice to establish + verify goldens**

  ```bash
  npx vitest run src/lib/wallet/strip.test.ts  # first run writes baselines
  npx vitest run src/lib/wallet/strip.test.ts  # second run compares
  ```
  Expected: 4/4 + 4/4 PASS on second run.

- [ ] **Step 7: Commit**

  ```bash
  git add src/lib/wallet/strip.ts src/lib/wallet/strip.test.ts src/lib/wallet/__fixtures__/
  git commit -m "feat(wallet): 9-circle stamp strip PNG renderer + golden tests"
  ```

### Task 2.2: Add static pass assets (logo + icon)

**Files:**
- Create: `mandys_bubble_tea/assets/wallet/logo.png`, `logo@2x.png`, `logo@3x.png`
- Create: `mandys_bubble_tea/assets/wallet/icon.png`, `icon@2x.png`, `icon@3x.png`

- [ ] **Step 1: Render logo from handoff Logomark SVG**

  Extract the Logomark SVG from `/Users/stanyan/Downloads/mandy-s-bubble-tea-app/project/src/WalletPass.jsx` (lines 31-51). Use `sharp` or an online SVG-to-PNG to render three sizes: 160×50 pt = 160/320/480 px wide, maintaining aspect. White glyph + "Mandy's" wordmark text on transparent background.

  (Alternative: write a small Node script `scripts/render-wallet-logo.ts` that uses `@napi-rs/canvas` to draw the cup + wordmark programmatically, matching the handoff.)

  Save to `assets/wallet/logo.png` (@1x), `logo@2x.png`, `logo@3x.png`.

- [ ] **Step 2: Render icon (29×29 pt = 29/58/87 px)**

  Same Logomark glyph without wordmark. Brown background `#8D5524`, white glyph — matches handoff icon style. Save `icon.png` / `icon@2x.png` / `icon@3x.png`.

- [ ] **Step 3: Verify file sizes**

  ```bash
  file assets/wallet/*.png
  ```
  Expected: PNG images with correct dimensions.

- [ ] **Step 4: Commit**

  ```bash
  git add assets/wallet/
  git commit -m "feat(wallet): add static pass logo + icon assets"
  ```

### Task 2.3: Write pass builder module with TDD

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/pass.test.ts`
- Create: `mandys_bubble_tea/src/lib/wallet/pass.ts`

- [ ] **Step 1: Write failing test**

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { buildPass } from './pass'
  import AdmZip from 'adm-zip'  // see step 2 for install

  describe('buildPass', () => {
    const baseInput = {
      serialNumber: 'mb-4182-abcdef12',
      authToken: 'a'.repeat(32),
      memberNumber: 'MB-4182',
      memberName: 'Stan Yan',
      memberSince: 'May 2024',
      stars: 7,
      availableRewards: 0,
    }

    it('produces a .pkpass zip containing pass.json', async () => {
      const buf = await buildPass(baseInput)
      const zip = new AdmZip(buf)
      const entries = zip.getEntries().map((e) => e.entryName)
      expect(entries).toContain('pass.json')
      expect(entries).toContain('manifest.json')
      expect(entries).toContain('signature')
      expect(entries).toContain('strip.png')
      expect(entries).toContain('strip@2x.png')
      expect(entries).toContain('strip@3x.png')
      expect(entries).toContain('icon.png')
      expect(entries).toContain('logo.png')
    })

    it('embeds serial number and auth token in pass.json', async () => {
      const buf = await buildPass(baseInput)
      const zip = new AdmZip(buf)
      const passJson = JSON.parse(zip.readAsText('pass.json'))
      expect(passJson.serialNumber).toBe('mb-4182-abcdef12')
      expect(passJson.authenticationToken).toBe(baseInput.authToken)
      expect(passJson.passTypeIdentifier).toBe(process.env.APPLE_PASS_TYPE_ID)
    })

    it('headerFields shows stars as "N/9"', async () => {
      const buf = await buildPass({ ...baseInput, stars: 3 })
      const zip = new AdmZip(buf)
      const passJson = JSON.parse(zip.readAsText('pass.json'))
      const starsField = passJson.storeCard.headerFields.find((f: any) => f.key === 'stars')
      expect(starsField.value).toBe('3/9')
    })

    it('secondaryFields reward says "Ready to redeem!" when availableRewards > 0', async () => {
      const buf = await buildPass({ ...baseInput, availableRewards: 1 })
      const zip = new AdmZip(buf)
      const passJson = JSON.parse(zip.readAsText('pass.json'))
      const reward = passJson.storeCard.secondaryFields.find((f: any) => f.key === 'reward')
      expect(reward.value).toBe('Ready to redeem!')
    })
  })
  ```

- [ ] **Step 2: Install adm-zip for test**

  ```bash
  npm install -D adm-zip @types/adm-zip
  ```

- [ ] **Step 3: Run test, verify failure**

  ```bash
  npx vitest run src/lib/wallet/pass.test.ts
  ```
  Expected: FAIL — module not found.

- [ ] **Step 4: Implement `pass.ts`**

  ```typescript
  import "server-only"
  import fs from "node:fs/promises"
  import path from "node:path"
  import { PKPass } from "passkit-generator"
  import { walletEnv } from "./env"
  import { renderStrip } from "./strip"
  import {
    PASS_BG_RGB,
    PASS_FG_RGB,
    PASS_LABEL_RGBA,
    PASS_TERMS,
    STORE_INFO,
  } from "./constants"

  export interface BuildPassInput {
    serialNumber: string
    authToken: string
    memberNumber: string
    memberName: string
    memberSince: string     // 'MMM YYYY'
    stars: number            // 0..9 (already mod-9)
    availableRewards: number
  }

  const ASSETS_DIR = path.join(process.cwd(), 'assets', 'wallet')

  async function readAsset(name: string): Promise<Buffer> {
    return fs.readFile(path.join(ASSETS_DIR, name))
  }

  export async function buildPass(input: BuildPassInput): Promise<Buffer> {
    const env = walletEnv()

    const pass = new PKPass(
      {
        'pass.json': Buffer.from(JSON.stringify(buildPassJson(input, env))),
        'icon.png': await readAsset('icon.png'),
        'icon@2x.png': await readAsset('icon@2x.png'),
        'icon@3x.png': await readAsset('icon@3x.png'),
        'logo.png': await readAsset('logo.png'),
        'logo@2x.png': await readAsset('logo@2x.png'),
        'logo@3x.png': await readAsset('logo@3x.png'),
        'strip.png': await renderStrip({ stars: input.stars, scale: 1 }),
        'strip@2x.png': await renderStrip({ stars: input.stars, scale: 2 }),
        'strip@3x.png': await renderStrip({ stars: input.stars, scale: 3 }),
      },
      {
        wwdr: env.wwdrPem,
        signerCert: env.certPem,
        signerKey: env.keyPem,
        signerKeyPassphrase: env.keyPassphrase,
      },
    )

    return pass.getAsBuffer()
  }

  function buildPassJson(i: BuildPassInput, env: ReturnType<typeof walletEnv>) {
    const rewardText = i.availableRewards > 0 ? 'Ready to redeem!' : 'Free drink'
    return {
      formatVersion: 1,
      passTypeIdentifier: env.passTypeId,
      serialNumber: i.serialNumber,
      teamIdentifier: env.teamId,
      organizationName: "Mandy's Bubble Tea",
      description: "Mandy's Member Card",
      webServiceURL: env.webServiceUrl,
      authenticationToken: i.authToken,
      backgroundColor: PASS_BG_RGB,
      foregroundColor: PASS_FG_RGB,
      labelColor: PASS_LABEL_RGBA,
      logoText: "Mandy's",
      storeCard: {
        headerFields: [
          { key: 'stars', label: 'STARS', value: `${i.stars}/9`, textAlignment: 'PKTextAlignmentRight' },
        ],
        primaryFields: [
          { key: 'member', label: 'MEMBER', value: i.memberName },
        ],
        secondaryFields: [
          { key: 'reward', label: 'NEXT REWARD', value: rewardText },
          { key: 'since', label: 'MEMBER SINCE', value: i.memberSince },
          { key: 'id', label: 'ID', value: i.memberNumber, textAlignment: 'PKTextAlignmentRight' },
        ],
        backFields: [
          { key: 'terms', label: 'Terms', value: PASS_TERMS },
          { key: 'store', label: 'Store', value: STORE_INFO.address },
          { key: 'phone', label: 'Phone', value: STORE_INFO.phone },
          { key: 'hours', label: 'Hours', value: STORE_INFO.hours },
          { key: 'website', label: 'Website', value: STORE_INFO.website },
        ],
        barcodes: [
          {
            format: 'PKBarcodeFormatQR',
            message: i.serialNumber,
            messageEncoding: 'iso-8859-1',
            altText: i.memberNumber,
          },
        ],
      },
    }
  }
  ```

- [ ] **Step 5: Set up test env file**

  Create `.env.test` in repo root:
  ```
  APPLE_PASS_CERT_PEM="-----BEGIN CERTIFICATE-----\n...TEST CERT...\n-----END CERTIFICATE-----"
  APPLE_PASS_KEY_PEM="-----BEGIN RSA PRIVATE KEY-----\n...TEST KEY...\n-----END RSA PRIVATE KEY-----"
  APPLE_PASS_WWDR_PEM="-----BEGIN CERTIFICATE-----\n...TEST WWDR...\n-----END CERTIFICATE-----"
  APPLE_PASS_KEY_PASSPHRASE=test-passphrase
  APPLE_TEAM_ID=TESTTEAM01
  APPLE_PASS_TYPE_ID=pass.com.mandysbubbletea.membercard.test
  APNS_AUTH_KEY_P8="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  APNS_KEY_ID=TESTKEY123
  WALLET_WEBSERVICE_URL=http://localhost:3000/api/wallet
  QSTASH_TOKEN=qstash_test
  QSTASH_CURRENT_SIGNING_KEY=sig_test_current
  QSTASH_NEXT_SIGNING_KEY=sig_test_next
  ```

  Generate a throwaway self-signed cert + key pair for test only:
  ```bash
  openssl req -x509 -newkey rsa:2048 -keyout /tmp/test-key.pem -out /tmp/test-cert.pem -days 30 -passout pass:test-passphrase -subj "/CN=test"
  ```
  Paste outputs into `.env.test`. Add `.env.test` to `.gitignore` if not already.

- [ ] **Step 6: Update vitest config to load .env.test**

  Modify `vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config'
  import path from 'node:path'
  import { config } from 'dotenv'

  config({ path: '.env.test' })

  export default defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
  })
  ```

  Install `dotenv`:
  ```bash
  npm install -D dotenv
  ```

- [ ] **Step 7: Run tests, verify pass**

  ```bash
  npx vitest run src/lib/wallet/pass.test.ts
  ```
  Expected: 4/4 PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add src/lib/wallet/pass.ts src/lib/wallet/pass.test.ts vitest.config.ts package.json package-lock.json .gitignore
  git commit -m "feat(wallet): pkpass builder signs store card with Mandy's fields"
  ```

### Task 2.4: Write customer data aggregator

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/customer.ts`

- [ ] **Step 1: Find existing Square customer + loyalty fetchers**

  ```bash
  grep -rn "retrieveCustomer\|customersApi" src/ | head
  grep -rn "loyaltyApi\|LoyaltyApi" src/ | head
  ```
  Note the existing helpers (e.g. `getSquareCustomer(id)`, `getLoyaltyAccount(phone)`). Reuse.

- [ ] **Step 2: Implement aggregator**

  ```typescript
  import "server-only"
  import { getSquareCustomer } from "@/lib/square"  // adjust path to repo reality
  import { LOYALTY_REWARD_THRESHOLD } from "./constants"

  export interface CustomerPassData {
    customerId: string
    memberName: string
    memberSince: string
    stars: number              // mod threshold, 0..8
    availableRewards: number
  }

  export async function fetchCustomerPassData(customerId: string): Promise<CustomerPassData> {
    const customer = await getSquareCustomer(customerId)
    if (!customer) throw new Error(`Square customer not found: ${customerId}`)

    const given = customer.givenName?.trim() ?? ''
    const family = customer.familyName?.trim() ?? ''
    const phone = customer.phoneNumber ?? ''
    const memberName = [given, family].filter(Boolean).join(' ') || `·${phone.slice(-4)}`

    const memberSince = customer.createdAt
      ? new Date(customer.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'Recently'

    // Loyalty
    const loyalty = await getLoyaltyAccountForCustomer(customerId)
    const rawBalance = loyalty?.balance ?? 0
    const stars = rawBalance % LOYALTY_REWARD_THRESHOLD  // 0..8
    const availableRewards = loyalty?.availableRewards?.length ?? 0

    return { customerId, memberName, memberSince, stars, availableRewards }
  }

  async function getLoyaltyAccountForCustomer(customerId: string) {
    // Reuse existing helper if available, or inline:
    const { searchLoyaltyAccounts } = await import('@/lib/square')
    const rs = await searchLoyaltyAccounts({ customerIds: [customerId] })
    return rs[0] ?? null
  }
  ```

- [ ] **Step 3: Verify imports resolve**

  ```bash
  npx tsc --noEmit
  ```
  If any import errors, adjust paths to match actual `src/lib/square*.ts` exports.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/wallet/customer.ts
  git commit -m "feat(wallet): aggregate Square customer + loyalty data for pass rendering"
  ```

---

## Phase 3 — App-facing routes

### Task 3.1: Exchange token endpoint

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/pass/exchange/route.ts`

- [ ] **Step 1: Implement route**

  ```typescript
  import { NextResponse } from "next/server"
  import { getAuthedUser } from "@/lib/auth"   // existing helper; adjust name
  import { issueExchangeToken, issuePass } from "@/lib/wallet/db"
  import { walletEnv } from "@/lib/wallet/env"
  import { getSquareCustomerIdForUser } from "@/lib/auth"  // existing helper; adjust

  export const dynamic = 'force-dynamic'

  export async function POST(request: Request) {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const customerId = await getSquareCustomerIdForUser(user.id)
    if (!customerId) return NextResponse.json({ error: 'no Square customer linked' }, { status: 404 })

    // Ensure a pass row exists so any subsequent webhook can find it
    await issuePass({ customerId, passTypeId: walletEnv().passTypeId })

    const { token, expiresAt } = await issueExchangeToken(customerId)
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
  }
  ```

- [ ] **Step 2: Verify auth helpers exist**

  ```bash
  grep -rn "getAuthedUser\|getSquareCustomerIdForUser" src/lib/ | head
  ```
  Adjust import names to match repo reality. If these helpers don't exist, wire up using the existing Supabase auth SSR pattern (`@supabase/ssr`). Inline minimal version if needed.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/wallet/pass/exchange/route.ts
  git commit -m "feat(api): POST /api/wallet/pass/exchange issues 60s token"
  ```

### Task 3.2: Pass download endpoint

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/pass/route.ts`

- [ ] **Step 1: Implement route**

  ```typescript
  import { consumeExchangeToken, getPassByCustomerId } from "@/lib/wallet/db"
  import { buildPass } from "@/lib/wallet/pass"
  import { fetchCustomerPassData } from "@/lib/wallet/customer"
  import { walletEnv } from "@/lib/wallet/env"

  export const dynamic = 'force-dynamic'

  export async function GET(request: Request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) return new Response('missing token', { status: 400 })

    const customerId = await consumeExchangeToken(token)
    if (!customerId) return new Response('invalid or expired token', { status: 403 })

    const pass = await getPassByCustomerId(customerId)
    if (!pass) return new Response('pass not issued', { status: 500 })

    const data = await fetchCustomerPassData(customerId)
    const buffer = await buildPass({
      serialNumber: pass.serial_number,
      authToken: pass.auth_token,
      memberNumber: pass.member_number,
      memberName: data.memberName,
      memberSince: data.memberSince,
      stars: data.stars,
      availableRewards: data.availableRewards,
    })

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="mandys-member-${pass.member_number}.pkpass"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/wallet/pass/route.ts
  git commit -m "feat(api): GET /api/wallet/pass?token= returns signed .pkpass"
  ```

---

## Phase 4 — Apple webService routes

### Task 4.1: Shared auth helper for ApplePass tokens

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/auth.ts`

- [ ] **Step 1: Implement**

  ```typescript
  import crypto from "node:crypto"
  import { getPassBySerial } from "./db"

  export async function verifyApplePassAuth(
    authHeader: string | null,
    serialNumber: string,
  ): Promise<boolean> {
    if (!authHeader) return false
    const m = /^ApplePass\s+(\S+)$/i.exec(authHeader)
    if (!m) return false
    const providedToken = m[1]
    const pass = await getPassBySerial(serialNumber)
    if (!pass) return false
    // constant-time compare
    const a = Buffer.from(providedToken)
    const b = Buffer.from(pass.auth_token)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/lib/wallet/auth.ts
  git commit -m "feat(wallet): ApplePass Authorization header verifier"
  ```

### Task 4.2: Register device route

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]/route.ts`

- [ ] **Step 1: Implement POST + DELETE**

  ```typescript
  import { NextResponse } from "next/server"
  import { verifyApplePassAuth } from "@/lib/wallet/auth"
  import { registerDevice, unregisterDevice } from "@/lib/wallet/db"

  export const dynamic = 'force-dynamic'

  interface Ctx {
    params: Promise<{
      deviceLibraryIdentifier: string
      passTypeIdentifier: string
      serialNumber: string
    }>
  }

  export async function POST(request: Request, ctx: Ctx) {
    const { deviceLibraryIdentifier, serialNumber } = await ctx.params
    const ok = await verifyApplePassAuth(request.headers.get('authorization'), serialNumber)
    if (!ok) return new Response(null, { status: 401 })

    const body = await request.json().catch(() => null) as { pushToken?: string } | null
    if (!body?.pushToken) return new Response('missing pushToken', { status: 400 })

    const result = await registerDevice({
      deviceLibraryId: deviceLibraryIdentifier,
      serialNumber,
      pushToken: body.pushToken,
    })
    return new Response(null, { status: result === 'created' ? 201 : 200 })
  }

  export async function DELETE(request: Request, ctx: Ctx) {
    const { deviceLibraryIdentifier, serialNumber } = await ctx.params
    const ok = await verifyApplePassAuth(request.headers.get('authorization'), serialNumber)
    if (!ok) return new Response(null, { status: 401 })

    await unregisterDevice({ deviceLibraryId: deviceLibraryIdentifier, serialNumber })
    return new Response(null, { status: 200 })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add "src/app/api/wallet/v1/devices"
  git commit -m "feat(api): POST+DELETE /wallet/v1/devices/.../registrations/... (Apple spec)"
  ```

### Task 4.3: List updated passes for device

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/route.ts`

- [ ] **Step 1: Implement GET**

  ```typescript
  import { NextResponse } from "next/server"
  import { listSerialsForDevice } from "@/lib/wallet/db"

  export const dynamic = 'force-dynamic'

  interface Ctx {
    params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }>
  }

  export async function GET(request: Request, ctx: Ctx) {
    const { deviceLibraryIdentifier } = await ctx.params
    const url = new URL(request.url)
    const passesUpdatedSince = url.searchParams.get('passesUpdatedSince') ?? undefined

    const { serials, lastUpdated } = await listSerialsForDevice(deviceLibraryIdentifier, passesUpdatedSince)
    if (serials.length === 0) return new Response(null, { status: 204 })
    return NextResponse.json({ lastUpdated, serialNumbers: serials })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/wallet/v1/devices/\[deviceLibraryIdentifier\]/registrations/\[passTypeIdentifier\]/route.ts
  git commit -m "feat(api): GET /wallet/v1/devices/.../registrations/... list updated passes"
  ```

### Task 4.4: Get latest pass

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/v1/passes/[passTypeIdentifier]/[serialNumber]/route.ts`

- [ ] **Step 1: Implement GET**

  ```typescript
  import { verifyApplePassAuth } from "@/lib/wallet/auth"
  import { getPassBySerial } from "@/lib/wallet/db"
  import { buildPass } from "@/lib/wallet/pass"
  import { fetchCustomerPassData } from "@/lib/wallet/customer"

  export const dynamic = 'force-dynamic'

  interface Ctx {
    params: Promise<{ passTypeIdentifier: string; serialNumber: string }>
  }

  export async function GET(request: Request, ctx: Ctx) {
    const { serialNumber } = await ctx.params
    const ok = await verifyApplePassAuth(request.headers.get('authorization'), serialNumber)
    if (!ok) return new Response(null, { status: 401 })

    const pass = await getPassBySerial(serialNumber)
    if (!pass) return new Response(null, { status: 404 })

    const ims = request.headers.get('if-modified-since')
    if (ims) {
      const imsDate = new Date(ims)
      if (!isNaN(imsDate.getTime()) && new Date(pass.updated_at) <= imsDate) {
        return new Response(null, { status: 304 })
      }
    }

    const data = await fetchCustomerPassData(pass.customer_id)
    const buffer = await buildPass({
      serialNumber: pass.serial_number,
      authToken: pass.auth_token,
      memberNumber: pass.member_number,
      memberName: data.memberName,
      memberSince: data.memberSince,
      stars: data.stars,
      availableRewards: data.availableRewards,
    })

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': new Date(pass.updated_at).toUTCString(),
      },
    })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/wallet/v1/passes/\[passTypeIdentifier\]/\[serialNumber\]/route.ts
  git commit -m "feat(api): GET /wallet/v1/passes/.../... returns fresh pkpass or 304"
  ```

### Task 4.5: Optional log route (Apple client-side errors)

**Files:**
- Create: `mandys_bubble_tea/src/app/api/wallet/v1/log/route.ts`

- [ ] **Step 1: Implement**

  ```typescript
  export const dynamic = 'force-dynamic'

  export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as { logs?: string[] } | null
    if (body?.logs?.length) {
      console.log('[wallet-log]', body.logs.join(' | '))
    }
    return new Response(null, { status: 200 })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/wallet/v1/log/route.ts
  git commit -m "feat(api): POST /wallet/v1/log captures Apple client errors"
  ```

---

## Phase 5 — Square webhook + queue

### Task 5.1: Extend Square webhook to enqueue loyalty updates

**Files:**
- Modify: `mandys_bubble_tea/src/app/api/webhooks/square/route.ts`

- [ ] **Step 1: Read current webhook**

  Re-read `src/app/api/webhooks/square/route.ts` in full.

- [ ] **Step 2: Add loyalty event dispatch alongside existing `customer.deleted`**

  Insert after the existing `customer.deleted` branch:
  ```typescript
  // Inside the POST handler, after customer.deleted handling:
  if (['loyalty.points.updated', 'loyalty.reward.created', 'loyalty.reward.redeemed'].includes(event.type ?? '')) {
    const customerId = pickCustomerId(event)
    if (customerId) {
      const { getPassByCustomerId } = await import("@/lib/wallet/db")
      const pass = await getPassByCustomerId(customerId)
      if (pass) {
        const { Client: QStashClient } = await import('@upstash/qstash')
        const { walletEnv } = await import("@/lib/wallet/env")
        const env = walletEnv()
        const qstash = new QStashClient({ token: env.qstashToken })
        const workerUrl = env.webServiceUrl.replace(/\/api\/wallet$/, '/api/wallet/worker/push')
        await qstash.publishJSON({
          url: workerUrl,
          body: { serialNumber: pass.serial_number },
          retries: 3,
        })
      }
    }
  }
  ```

- [ ] **Step 3: Subscribe the events in Square Dashboard**

  Tell user: Square Developer Dashboard → Webhooks → subscribe the app to these events:
  - `loyalty.points.updated`
  - `loyalty.reward.created`
  - `loyalty.reward.redeemed`

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/webhooks/square/route.ts
  git commit -m "feat(webhook): enqueue wallet push on Square loyalty events"
  ```

### Task 5.2: Worker route — APNs push

**Files:**
- Create: `mandys_bubble_tea/src/lib/wallet/apns.ts`
- Create: `mandys_bubble_tea/src/app/api/wallet/worker/push/route.ts`

- [ ] **Step 1: Write APNs client with TDD — failing test**

  `src/lib/wallet/apns.test.ts`:
  ```typescript
  import { describe, it, expect } from 'vitest'
  import { buildApnsJwt } from './apns'

  describe('buildApnsJwt', () => {
    it('produces a valid ES256 JWT with iss=teamId and kid=keyId', async () => {
      const jwt = await buildApnsJwt()
      const [header, payload] = jwt.split('.').slice(0, 2).map((s) => JSON.parse(Buffer.from(s, 'base64url').toString()))
      expect(header.alg).toBe('ES256')
      expect(header.kid).toBe(process.env.APNS_KEY_ID)
      expect(payload.iss).toBe(process.env.APPLE_TEAM_ID)
      expect(payload.iat).toBeGreaterThan(0)
    })
  })
  ```

- [ ] **Step 2: Implement apns.ts**

  ```typescript
  import "server-only"
  import http2 from "node:http2"
  import { SignJWT, importPKCS8 } from "jose"
  import { walletEnv } from "./env"

  let cachedJwt: { token: string; expiresAt: number } | null = null

  export async function buildApnsJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (cachedJwt && cachedJwt.expiresAt > now + 60) return cachedJwt.token

    const env = walletEnv()
    const key = await importPKCS8(env.apnsAuthKey, 'ES256')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env.apnsKeyId })
      .setIssuer(env.teamId)
      .setIssuedAt(now)
      .sign(key)

    cachedJwt = { token, expiresAt: now + 3300 } // 55 min cache
    return token
  }

  export interface PushResult {
    token: string
    status: number
    apnsId?: string
    reason?: string
  }

  export async function pushToAppleWallet(pushTokens: string[]): Promise<PushResult[]> {
    if (pushTokens.length === 0) return []
    const env = walletEnv()
    const jwt = await buildApnsJwt()

    const client = http2.connect(`https://${env.apnsHost}`)
    try {
      return await Promise.all(
        pushTokens.map(
          (token) =>
            new Promise<PushResult>((resolve) => {
              const req = client.request({
                ':method': 'POST',
                ':path': `/3/device/${token}`,
                'apns-topic': env.passTypeId,
                'apns-push-type': 'alert',
                authorization: `bearer ${jwt}`,
                'content-type': 'application/json',
              })
              let status = 0
              let chunks = ''
              req.on('response', (h) => {
                status = Number(h[':status'])
              })
              req.on('data', (d) => {
                chunks += d.toString()
              })
              req.on('end', () => {
                let reason: string | undefined
                try { reason = chunks ? JSON.parse(chunks).reason : undefined } catch {}
                resolve({ token, status, reason })
              })
              req.on('error', (err) => resolve({ token, status: 0, reason: err.message }))
              req.end('{}')
            }),
        ),
      )
    } finally {
      client.close()
    }
  }
  ```

- [ ] **Step 3: Run APNs test**

  ```bash
  npx vitest run src/lib/wallet/apns.test.ts
  ```

  To produce a test `.p8` key:
  ```bash
  openssl ecparam -genkey -name prime256v1 -noout -out /tmp/apns-test.p8
  openssl pkcs8 -topk8 -nocrypt -in /tmp/apns-test.p8 -out /tmp/apns-test-pkcs8.p8
  ```
  Paste the PKCS8 format into `.env.test` for `APNS_AUTH_KEY_P8`.

  Expected: PASS.

- [ ] **Step 4: Implement worker route**

  `src/app/api/wallet/worker/push/route.ts`:
  ```typescript
  import { NextResponse } from "next/server"
  import { verifySignature } from "@upstash/qstash/nextjs"
  import {
    bumpPassUpdatedAt,
    deleteDeviceByPushToken,
    getDevicePushTokens,
  } from "@/lib/wallet/db"
  import { pushToAppleWallet } from "@/lib/wallet/apns"

  export const dynamic = 'force-dynamic'

  async function handler(request: Request) {
    const body = await request.json().catch(() => null) as { serialNumber?: string } | null
    if (!body?.serialNumber) return NextResponse.json({ ok: false, reason: 'missing serialNumber' }, { status: 400 })

    await bumpPassUpdatedAt(body.serialNumber)
    const tokens = await getDevicePushTokens(body.serialNumber)
    const results = await pushToAppleWallet(tokens)

    for (const r of results) {
      if (r.status === 410) await deleteDeviceByPushToken(r.token)
    }

    const failures = results.filter((r) => r.status >= 500 || r.status === 429)
    if (failures.length > 0) {
      return NextResponse.json({ ok: false, failures }, { status: 500 })  // triggers QStash retry
    }
    return NextResponse.json({ ok: true, pushed: results.length })
  }

  export const POST = verifySignature(handler, {
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/wallet/apns.ts src/lib/wallet/apns.test.ts "src/app/api/wallet/worker/push/route.ts"
  git commit -m "feat(wallet): APNs HTTP/2 pusher + QStash-invoked worker route"
  ```

---

## Phase 6 — App integration

### Task 6.1: Install expo-web-browser (verify)

**Files:**
- `mandys_bubble_tea_app/package.json`

- [ ] **Step 1: Check if already installed**

  ```bash
  cd ~/Github/mandys_bubble_tea_app
  grep expo-web-browser package.json
  ```
  If present (it is, per the survey — `expo-web-browser: "~15.0.10"`), skip install.

- [ ] **Step 2: No commit needed if already present**

### Task 6.2: Create AddToWalletButton component

**Files:**
- Create: `mandys_bubble_tea_app/components/account/AddToWalletButton.tsx`
- Create: `mandys_bubble_tea_app/assets/add-to-apple-wallet.png` (downloaded from Apple)

- [ ] **Step 1: Download official Apple badge**

  Tell user: download the Add to Apple Wallet badge (English, black) from `https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/`. Save PNG to `assets/add-to-apple-wallet.png`.

- [ ] **Step 2: Write component**

  ```tsx
  import { memo, useCallback, useEffect, useState } from 'react'
  import { Platform, Pressable, Image, Text, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
  import * as WebBrowser from 'expo-web-browser'
  import AsyncStorage from '@react-native-async-storage/async-storage'
  import { supabase } from '@/lib/supabase'  // adjust to repo export

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://mandybubbletea.com'
  const ADDED_KEY = 'mandy_wallet_added_v1'

  interface Props {
    onAdded?: () => void
  }

  export const AddToWalletButton = memo(function AddToWalletButton({ onAdded }: Props) {
    const [state, setState] = useState<'idle' | 'loading' | 'added' | 'error'>('idle')

    useEffect(() => {
      if (Platform.OS !== 'ios') return
      AsyncStorage.getItem(ADDED_KEY).then((v) => {
        if (v === '1') setState('added')
      })
    }, [])

    const onPress = useCallback(async () => {
      if (Platform.OS !== 'ios') return
      setState('loading')
      try {
        const { data: sess } = await supabase.auth.getSession()
        const jwt = sess.session?.access_token
        if (!jwt) throw new Error('no session')

        const r = await fetch(`${API_BASE}/api/wallet/pass/exchange`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
        })
        if (!r.ok) throw new Error(`exchange failed: ${r.status}`)
        const { token } = (await r.json()) as { token: string }

        const url = `${API_BASE}/api/wallet/pass?token=${encodeURIComponent(token)}`
        await WebBrowser.openBrowserAsync(url, { showInRecents: false })

        await AsyncStorage.setItem(ADDED_KEY, '1')
        setState('added')
        onAdded?.()
      } catch (e) {
        console.warn('[AddToWalletButton]', e)
        setState('error')
        Alert.alert('Could not add card', 'Please try again.')
      }
    }, [onAdded])

    const openWallet = useCallback(() => {
      Linking.openURL('shoebox://').catch(() => Linking.openURL('wallet://'))
    }, [])

    if (Platform.OS !== 'ios') return null

    if (state === 'added') {
      return (
        <Pressable onPress={openWallet} style={styles.addedRow}>
          <Text style={styles.addedText}>✓ Card added to Wallet  ·  Open</Text>
        </Pressable>
      )
    }

    return (
      <Pressable onPress={onPress} disabled={state === 'loading'} style={styles.button}>
        {state === 'loading' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Image
            source={require('@/assets/add-to-apple-wallet.png')}
            style={styles.badge}
            resizeMode="contain"
          />
        )}
      </Pressable>
    )
  })

  const styles = StyleSheet.create({
    button: {
      marginHorizontal: 16,
      marginTop: 10,
      height: 44,
      borderRadius: 8,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: { height: 44, width: 180 },
    addedRow: {
      marginHorizontal: 16,
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.06)',
      alignItems: 'center',
    },
    addedText: {
      fontSize: 13,
      color: '#18181b',
      fontWeight: '500',
    },
  })
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd ~/Github/mandys_bubble_tea_app
  git add components/account/AddToWalletButton.tsx assets/add-to-apple-wallet.png
  git commit -m "feat(account): AddToWalletButton with exchange-token flow"
  ```

### Task 6.3: Mount in Account tab below MemberQrCard

**Files:**
- Modify: `mandys_bubble_tea_app/app/(tabs)/account.tsx`

- [ ] **Step 1: Read file**

  Open `app/(tabs)/account.tsx`, find where `<MemberQrCard />` is rendered.

- [ ] **Step 2: Import + render below**

  Add near top:
  ```tsx
  import { AddToWalletButton } from '@/components/account/AddToWalletButton'
  ```

  Below the `<MemberQrCard />` in JSX:
  ```tsx
  <MemberQrCard customerId={customerId} phoneE164={phoneE164} />
  <AddToWalletButton />
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: exit 0.

- [ ] **Step 4: Commit**

  ```bash
  git add app/(tabs)/account.tsx
  git commit -m "feat(account): mount AddToWalletButton below MemberQrCard"
  ```

---

## Phase 7 — End-to-end verification

### Task 7.1: Deploy backend to Vercel preview + smoke test

- [ ] **Step 1: Push backend branch**

  ```bash
  cd ~/Github/mandys_bubble_tea
  git push origin HEAD:feat/apple-wallet-member-card
  ```

- [ ] **Step 2: Wait for Vercel preview + check env vars**

  In Vercel dashboard → confirm all env vars from task 0.5 are propagated to Preview scope (not only Production). If not, add them to Preview.

- [ ] **Step 3: Curl exchange endpoint (should 401 without auth)**

  ```bash
  curl -i https://<preview-url>/api/wallet/pass/exchange -X POST
  ```
  Expected: HTTP 401.

- [ ] **Step 4: Check pkpass route produces valid zip**

  Manually run a one-off SQL in Supabase to insert a test `wallet_passes` row with a known customer_id, then create an exchange token:
  ```sql
  INSERT INTO wallet_exchange_tokens (token, customer_id, expires_at) 
  VALUES ('test-token-123', '<known Square customer id>', now() + interval '5 minutes');
  ```

  ```bash
  curl -o /tmp/test.pkpass "https://<preview-url>/api/wallet/pass?token=test-token-123"
  unzip -l /tmp/test.pkpass
  ```
  Expected: zip contains `pass.json`, `manifest.json`, `signature`, `icon*.png`, `logo*.png`, `strip*.png`.

- [ ] **Step 5: AirDrop to iPhone, open, verify visual matches handoff**

  Visual checklist:
  - Brown background
  - "Mandy's" wordmark top-left
  - "STARS  N/9" top-right
  - Stamp strip with N filled + (9-N) dashed
  - Primary: `MEMBER  <name>`
  - Secondary: `NEXT REWARD`, `MEMBER SINCE`, `ID`
  - Back (tap `···`): terms, store, phone, hours, website

### Task 7.2: Build + TestFlight app

- [ ] **Step 1: Bump version**

  `ios/mandysbubbleteaapp/Info.plist`: `CFBundleShortVersionString` 1.0.3 → 1.0.4, `CFBundleVersion` → 1.

- [ ] **Step 2: Archive + upload**

  Xcode → Product → Archive → Distribute App → App Store Connect → Upload.

- [ ] **Step 3: TestFlight verify**

  - Open Account tab → tap Add to Apple Wallet
  - PassKit sheet appears → Add
  - Wallet app shows Mandy's pass
  - Back in app: button shows "Card added to Wallet · Open"

### Task 7.3: End-to-end update test

- [ ] **Step 1: Order a drink via Square POS (or test scaffold)**

  Tell user: place a real small order via the Square Register for the test Square customer. This triggers `loyalty.points.updated`.

- [ ] **Step 2: Watch Vercel logs**

  ```bash
  vercel logs <preview-url> --follow
  ```
  Expected sequence:
  - `[square-webhook]` log of inbound event
  - QStash enqueue
  - `[wallet-worker]` push attempt
  - HTTP/2 response status 200 per device

- [ ] **Step 3: Verify pass updates on iPhone within ~5s**

  Lock screen should show the pass with updated stars. Opening Wallet should also show it.

- [ ] **Step 4: POS scan test**

  Scan the QR code on the pass using Square Register's built-in scanner. Confirm the serial number resolves.

### Task 7.4: Update DEV_QUEUE + HANDOFF

- [ ] **Step 1: Update queue**

  Append to `~/system/DEV_QUEUE.md` under Mandy's app:
  ```
  - [x] Apple Wallet member card (Phase 1) — end-to-end push tested on TestFlight
  ```

- [ ] **Step 2: Write handoff entry**

  Standard HANDOFF format. Capture: commits on both repos, Vercel preview URL, any known pain points, next-phase Google Wallet notes.

---

## Risks + rollback

- **QR fails POS scan in real shop**: switch `barcodes[0].format` to `PKBarcodeFormatPDF417` or `PKBarcodeFormatAztec`, one line change. Re-sign + push to all devices via manual `UPDATE wallet_passes SET updated_at = now()` + trigger one-off worker invocation per serial.
- **APNs push flakey**: examine Vercel logs for 410/400 responses. 410 auto-cleans; 400 means bad topic/JWT. Double-check env vars.
- **Pass visual off vs handoff**: compare pkpass rendering on device against handoff screenshots; tune strip renderer. Version the strip (add `scale_version=2` in metadata) if iterating.
- **Vercel Serverless canvas issue**: if `@napi-rs/canvas` fails on Vercel, fall back to `sharp` + SVG-to-raster; rewrite `strip.ts` to produce SVG, then rasterize with sharp. Tests should catch this before deploy.

## Out of scope (Phase 2+)

- Google Wallet Android
- `PKPassLibrary.containsPass` native module (robust "already added" detection)
- Pass sharing (`sharingProhibited`) policy — currently allowed
- Localization (English only)
- Pre-issuing passes for every customer on signup (currently lazy on first tap)
