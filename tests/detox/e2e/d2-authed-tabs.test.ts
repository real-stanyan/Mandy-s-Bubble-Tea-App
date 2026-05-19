/* eslint-disable @typescript-eslint/no-namespace */
import { expect as jestExpect } from '@jest/globals'
import { device, expect as detoxExpect, by, element, waitFor } from 'detox'
import {
  startAuthFixtureServer,
  type AuthFixtureServerHandle,
} from '../fixtures/auth-fixture-server'

// D2 — Authed RN app surfaces the (tabs) layout (Home / Menu / My Orders
// / Account) once a Supabase session is injected via the localhost:8765
// fixture endpoint. Validates the lib/supabase.ts build-time-gated
// backdoor + AuthProvider session-load chain → bypasses the SignIn
// gate that A2 stops at.
//
// Full D2 baseline ("9 stars → free drink redeem in App Checkout")
// needs cart + loyalty seeding which is the next step. This spec
// covers the auth-bridge piece — once auth-bridge works, the rest is
// state setup not infra.

describe('D2 — RN app authed tab walk [TestBaseline:D2]', () => {
  let fixture: AuthFixtureServerHandle

  beforeAll(async () => {
    fixture = await startAuthFixtureServer(8765)

    // First launch: backdoor fetches localhost:8765 → setSession()
    // writes the session to AsyncStorage. There's a race with login.tsx
    // useEffect that may already have decided stage='phone' before the
    // async setSession resolves — `routedForUserRef` then pins login
    // into the OTP path even when the session arrives later.
    //
    // Workaround: after the first launch primes AsyncStorage, reload
    // the JS bundle. On the second boot, Supabase auto-loads the
    // session from AsyncStorage SYNCHRONOUSLY at createClient time, so
    // AuthProvider mounts with a populated session + /api/me fetch in
    // flight, and AuthGate / login.tsx never even consider the
    // stage='phone' path.
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: 0 },
    })
    await device.disableSynchronization()
    // Give the backdoor fetch + setSession time to land before reload.
    await new Promise((r) => setTimeout(r, 2_500))
    await device.reloadReactNative()
    // Brief settle window for AuthProvider /api/me + router replace.
    await new Promise((r) => setTimeout(r, 2_500))
  }, 90_000)

  afterAll(async () => {
    if (fixture) await fixture.stop()
  })

  it('authed user lands on (tabs) layout with tab bar visible', async () => {
    // AuthProvider needs a moment to:
    //   1. supabase.auth.startAutoRefresh()
    //   2. Fixture branch fetch → setSession → onAuthStateChange fires
    //   3. AuthProvider triggers /(tabs) navigation
    // Tolerate up to 30s for cold-start + network round-trips.
    await waitFor(element(by.text('Home')).atIndex(0))
      .toBeVisible()
      .withTimeout(30_000)

    // Tab bar carries all 4 tab labels (Home / Menu / My Orders / Account).
    await detoxExpect(element(by.text('Menu')).atIndex(0)).toBeVisible()
    await detoxExpect(element(by.text('My Orders')).atIndex(0)).toBeVisible()
    await detoxExpect(element(by.text('Account')).atIndex(0)).toBeVisible()
  })

  it('captures authed home screenshot for visual regression', async () => {
    const path = await device.takeScreenshot('d2-authed-tabs')
    jestExpect(typeof path).toBe('string')
    jestExpect(path.length).toBeGreaterThan(0)
  })
})
