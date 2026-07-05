/* eslint-disable @typescript-eslint/no-namespace */
import { expect as jestExpect } from '@jest/globals'
import { device, expect as detoxExpect, by, element, waitFor } from 'detox'
import {
  startAuthFixtureServer,
  type AuthFixtureServerHandle,
} from '../fixtures/auth-fixture-server'

// D4 — delivery checkout [TestBaseline:D4]
//
// What's covered:
//   ✓ Authed session via fixture backdoor (same chain as D2/D3)
//   ✓ Cart seeding via Menu tab → item detail sheet → "Add to cart" (≥$12)
//   ✓ FulfillmentSelector renders with both PICKUP / DELIVERY options
//   ✓ Tapping "fulfillment-delivery" switches to delivery mode
//   ✓ Entering a valid 4-digit postcode (4215) shows zone-OK hint
//   ✓ Entering a non-deliverable postcode (4000) shows zone-error copy
//
// KNOWN-GAPS:
//   (1) Google Places autocomplete selection needs live network + cannot be
//       deterministically stubbed in Detox — the postcode field is a separate
//       TextInput that fires synchronously without any network call, so this
//       spec asserts the ZONE HINT only and does not attempt to complete
//       a real autocomplete address selection.
//   (2) Delivery quote fetch (POST /api/delivery/quote) requires a confirmed
//       lat/lng address; this spec intentionally omits address selection per (1),
//       so the quote card will remain in its "idle/loading" state — not tested here.
//   (3) Square sandbox payment (Apple Pay / card nonce) is not exercised — the
//       spec stops before tapping Place Order.  Square SDK flows are out-of-scope
//       for a Detox Release build test.
//   (4) Real driver-GPS tracking (TrackingMap / FreshnessBar / useDeliveryTracking)
//       requires a live delivery in production — these are real-line known-gaps
//       for /tester.
//
// Pre-req:
//   - Detox Release build with EXPO_PUBLIC_DETOX_FIXTURE_URL baked in (ios.sim.release)
//   - Local Next dev server running on :3000 (or EXPO_PUBLIC_API_BASE_URL set)
//   - SUPABASE_SERVICE_ROLE_KEY + SQUARE_ACCESS_TOKEN/LOCATION_ID in .env.local
//   - Simulator network access for Square catalog fetch (item names needed for tap)

describe('D4 — delivery checkout [TestBaseline:D4]', () => {
  let fixture: AuthFixtureServerHandle

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Seed the cart with enough items to reach the $12 delivery minimum.
   *
   * Strategy (mirrors D3 menu-walk):
   *   1. Navigate to the Menu tab and wait for the SectionList to render.
   *   2. Tap the first available item by text — use a category scan identical
   *      to D3's to find a visible category header, then tap the first item
   *      row whose price text is rendered (avoids sold-out items).
   *   3. In the item detail bottom sheet, tap "Add to cart".
   *   4. Repeat once more (same item is fine — tapping it again reopens the
   *      sheet) so the subtotal is ≥ $12.00 (two average-priced drinks).
   *   5. After each "Add to cart" tap the sheet auto-closes; the MiniCartBar
   *      ("View Cart") becomes visible confirming the cart state.
   *
   * KNOWN-GAP: Cart seeding mirrors D3 selector patterns (by.text on category
   * headers + item names).  The item tapped is whichever visible item text
   * Detox resolves first (atIndex(0) on the first recognised category block).
   * If the catalog changes, verify these selectors against d3 when running.
   */
  async function seedCartToDeliveryMinimum() {
    // ── Step 1: navigate to Menu tab ────────────────────────────────────────
    await element(by.text('Menu')).atIndex(0).tap()
    await new Promise((r) => setTimeout(r, 2_000))

    // ── Step 2: find a visible menu item ────────────────────────────────────
    // Same category scan as D3 — whichever section renders first is fine.
    const categories = ['MILKY', 'FRUITY', 'SPECIAL MIX', 'FRESH BREW', 'FROZEN']
    let foundCategory = false
    for (const cat of categories) {
      try {
        await detoxExpect(element(by.text(cat)).atIndex(0)).toBeVisible()
        foundCategory = true
        break
      } catch {
        /* try next */
      }
    }
    jestExpect(foundCategory).toBe(true)

    // ── Step 3a: tap first item + add to cart ────────────────────────────────
    // Items render as TouchableOpacity rows with item name as a Text child.
    // atIndex(0) picks the topmost rendered item in the SectionList viewport.
    // Sold-out items have `disabled={true}` — we fall back through a small list
    // of well-known non-seasonal Mandy's drinks if the first attempt errors.
    //
    // KNOWN-GAP: item names are live catalog data; verify selector against
    // the sandbox catalog if taps fail.
    const itemCandidates = [
      'Classic Milk Tea',
      'Brown Sugar Milk Tea',
      'Taro Milk Tea',
      'Mango Green Tea',
      'Lychee Fruit Tea',
    ]
    let itemFound = false
    for (const name of itemCandidates) {
      try {
        await waitFor(element(by.text(name)).atIndex(0))
          .toBeVisible()
          .withTimeout(4_000)
        itemFound = true

        // First add-to-cart
        await element(by.text(name)).atIndex(0).tap()
        await waitFor(element(by.text('Add to cart')))
          .toBeVisible()
          .withTimeout(10_000)
        await element(by.text('Add to cart')).tap()
        await new Promise((r) => setTimeout(r, 1_000))

        // Second add-to-cart (reopen same item to push subtotal over $12)
        await element(by.text(name)).atIndex(0).tap()
        await waitFor(element(by.text('Add to cart')))
          .toBeVisible()
          .withTimeout(10_000)
        await element(by.text('Add to cart')).tap()
        await new Promise((r) => setTimeout(r, 1_000))

        break
      } catch {
        /* try next candidate */
      }
    }
    jestExpect(itemFound).toBe(true)

    // ── Step 4: open CartSheet via MiniCartBar "View Cart" ──────────────────
    await waitFor(element(by.text('View Cart')))
      .toBeVisible()
      .withTimeout(8_000)
    await element(by.text('View Cart')).tap()
    await new Promise((r) => setTimeout(r, 1_000))

    // ── Step 5: tap Checkout in the CartSheet ────────────────────────────────
    await waitFor(element(by.text('Checkout')))
      .toBeVisible()
      .withTimeout(8_000)
    await element(by.text('Checkout')).tap()
    await new Promise((r) => setTimeout(r, 1_500))
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Must match EXPO_PUBLIC_DETOX_FIXTURE_URL port (8765) baked into the build.
    fixture = await startAuthFixtureServer(8765)

    // Same launch + reload dance as D2/D3: first launch primes AsyncStorage
    // via the fixture backdoor; reloadReactNative lets supabase-js rehydrate
    // synchronously from storage on the second pass.
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxEnableSynchronization: 0 },
    })
    await device.disableSynchronization()
    await new Promise((r) => setTimeout(r, 5_000))
    await device.reloadReactNative()
    await new Promise((r) => setTimeout(r, 3_000))
  }, 60_000)

  afterAll(async () => {
    if (fixture) await fixture.stop()
  })

  // ── Tests ─────────────────────────────────────────────────────────────────

  it('reaches checkout with ≥$12 cart and FulfillmentSelector is visible', async () => {
    // Wait for the app to be ready on Home/any tab.
    await waitFor(element(by.text('Home')).atIndex(0))
      .toBeVisible()
      .withTimeout(30_000)

    await seedCartToDeliveryMinimum()

    // Checkout screen should show the FulfillmentSelector.
    // "Review & pay" is the header title rendered by InlineHeader.
    await waitFor(element(by.text('Review & pay')))
      .toBeVisible()
      .withTimeout(15_000)

    // Both fulfillment options must be present; PICKUP is the default.
    await waitFor(element(by.id('fulfillment-pickup')))
      .toBeVisible()
      .withTimeout(10_000)
    await waitFor(element(by.id('fulfillment-delivery')))
      .toBeVisible()
      .withTimeout(5_000)

    // Baseline screenshot for visual regression.
    const path = await device.takeScreenshot('d4-checkout-fulfillment-selector')
    jestExpect(typeof path).toBe('string')
    jestExpect(path.length).toBeGreaterThan(0)
  })

  it('postcode zone hint appears for valid (4215) and invalid (4000) postcodes', async () => {
    // Switch to DELIVERY mode — delivery option must be enabled because
    // seedCartToDeliveryMinimum() ensures subtotal ≥ $12 (MIN_ORDER_CENTS).
    await waitFor(element(by.id('fulfillment-delivery')))
      .toBeVisible()
      .withTimeout(10_000)
    await element(by.id('fulfillment-delivery')).tap()
    await new Promise((r) => setTimeout(r, 800))

    // DeliveryAddressForm mounts after tapping DELIVERY.
    await waitFor(element(by.id('delivery-postcode')))
      .toBeVisible()
      .withTimeout(10_000)

    // ── Valid postcode: 4215 (Southport — in delivery zone) ──────────────────
    await element(by.id('delivery-postcode')).tap()
    await element(by.id('delivery-postcode')).typeText('4215')
    await waitFor(element(by.text('✓ In our delivery zone')))
      .toBeVisible()
      .withTimeout(8_000)

    const pathOk = await device.takeScreenshot('d4-postcode-4215-in-zone')
    jestExpect(typeof pathOk).toBe('string')
    jestExpect(pathOk.length).toBeGreaterThan(0)

    // ── Invalid postcode: 4000 (Brisbane CBD — outside zone) ─────────────────
    // Clear field: select all + type replacement (replaces existing text).
    await element(by.id('delivery-postcode')).clearText()
    await element(by.id('delivery-postcode')).typeText('4000')
    await waitFor(
      element(by.text('Sorry, we only deliver to 4211, 4214, 4215, 4216, 4217, 4218.')),
    )
      .toBeVisible()
      .withTimeout(8_000)

    const pathErr = await device.takeScreenshot('d4-postcode-4000-out-of-zone')
    jestExpect(typeof pathErr).toBe('string')
    jestExpect(pathErr.length).toBeGreaterThan(0)
  })
})
