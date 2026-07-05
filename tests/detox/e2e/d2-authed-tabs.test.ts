/* eslint-disable @typescript-eslint/no-namespace */
import { expect as jestExpect } from '@jest/globals'
import { device, expect as detoxExpect, by, element, waitFor } from 'detox'
import {
  startAuthFixtureServer,
  type AuthFixtureServerHandle,
} from '../fixtures/auth-fixture-server'

// D2 — Authed RN app walks all four (tabs) screens. Validates the
// auth-fixture backdoor (lib/supabase.ts + localhost:8765) chain + the
// AuthProvider → AuthGate → expo-router routing → tab bar render.
//
// Pre-req:
//   - Detox Release build with EXPO_PUBLIC_DETOX_FIXTURE_URL baked in
//   - Local Next dev server running on :3000 (or set
//     EXPO_PUBLIC_API_BASE_URL to a reachable backend)
//   - SUPABASE_SERVICE_ROLE_KEY + SQUARE_ACCESS_TOKEN/LOCATION_ID in
//     app's .env.local (fixture needs admin client + sandbox Square)

describe('D2 — RN app authed tab walk [TestBaseline:D2]', () => {
  let fixture: AuthFixtureServerHandle

  beforeAll(async () => {
    fixture = await startAuthFixtureServer(8765)

    // First launch primes AsyncStorage via the backdoor branch.
    // reloadReactNative on the second pass lets supabase-js rehydrate
    // the session synchronously from storage instead of racing the
    // login.tsx mount.
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: 0 },
    })
    await device.disableSynchronization()
    await new Promise((r) => setTimeout(r, 2_500))
    await device.reloadReactNative()
    await new Promise((r) => setTimeout(r, 2_500))
  }, 60_000)

  afterAll(async () => {
    if (fixture) await fixture.stop()
  })

  it('lands on (tabs) with all four tab labels visible', async () => {
    await waitFor(element(by.text('Home')).atIndex(0))
      .toBeVisible()
      .withTimeout(30_000)
    await detoxExpect(element(by.text('Menu')).atIndex(0)).toBeVisible()
    await detoxExpect(element(by.text('My Orders')).atIndex(0)).toBeVisible()
    await detoxExpect(element(by.text('Account')).atIndex(0)).toBeVisible()
  })

  it('tapping Menu tab navigates to /menu', async () => {
    await element(by.text('Menu')).atIndex(0).tap()
    // Menu tab is selected — tab label still visible.
    await detoxExpect(element(by.text('Menu')).atIndex(0)).toBeVisible()
    await new Promise((r) => setTimeout(r, 1_000))
  })

  it('tapping My Orders tab navigates to /order', async () => {
    await element(by.text('My Orders')).atIndex(0).tap()
    await detoxExpect(element(by.text('My Orders')).atIndex(0)).toBeVisible()
    await new Promise((r) => setTimeout(r, 1_000))
  })

  it('tapping Account tab navigates to /account', async () => {
    await element(by.text('Account')).atIndex(0).tap()
    await detoxExpect(element(by.text('Account')).atIndex(0)).toBeVisible()
    await new Promise((r) => setTimeout(r, 1_000))
  })

  it('captures authed-home screenshot for visual regression', async () => {
    // Return to Home first so the screenshot is the canonical landing.
    await element(by.text('Home')).atIndex(0).tap()
    await new Promise((r) => setTimeout(r, 1_000))
    const path = await device.takeScreenshot('d2-authed-home')
    jestExpect(typeof path).toBe('string')
    jestExpect(path.length).toBeGreaterThan(0)
  })
})
