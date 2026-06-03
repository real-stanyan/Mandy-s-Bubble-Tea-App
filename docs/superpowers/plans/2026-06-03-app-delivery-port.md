# App Delivery Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the web customer-facing "Deliver" experience (fulfillment selection, address + quote, DE order, Uber-Eats live tracking) into the RN app, fully aligned in functionality/layout/copy, themed in the app's existing brown palette.

**Architecture:** The backend is shared (`mandybubbletea.com`) and already supports delivery, so this is a client-side port plus ONE new backend route (Places proxy). The app calls existing routes: `/api/delivery/quote` (display), `/api/orders` (with a `delivery` body), `/api/payment` (settles by `orderId`), `/api/orders/{id}/status` (tracking). The live map is `react-native-webview` hosting self-contained Leaflet HTML; the native side polls status and injects fresh driver coords.

**Tech Stack:** Expo SDK 54 / RN 0.81, Expo Router, Zustand (AsyncStorage), Square Mobile Payments SDK (native), Jest + jest-expo, react-native-webview (new), Leaflet via CDN inside the WebView.

**Repos:**
- Phase 0 → `~/Github/mandys_bubble_tea` (web backend), branch `feat/delivery` (web worktree already exists at `mandys_bubble_tea-delivery`; **use a fresh branch off `origin/main` — do NOT reuse the stale `feat/delivery` worktree**).
- Phases 1–9 → `~/Github/mandys_bubble_tea_app`, branch `feat/delivery` (already created, spec committed `8d9e197`).

**Reference (web source, read for exact behavior):**
- `src/lib/delivery-fee.ts`, `src/lib/constants.ts` (DELIVERY block), `src/lib/delivery-zone.ts`, `src/lib/places.ts`
- `src/app/api/delivery/quote/route.ts`, `src/app/api/orders/route.ts` (delivery body), `src/app/api/orders/[orderId]/status/route.ts`
- `src/components/checkout/DeliveryAddressForm.tsx`, `src/app/checkout/page.tsx` (quote fetch + reason map + summary)
- `src/app/order-confirmation/[orderId]/DeliveryMap.tsx` (Leaflet + FreshnessBar)

**App money convention:** the app uses **cents as plain `number`** (not BigInt like web). `formatPrice(cents)` in `lib/utils` renders AUD. All delivery math here is in `number` cents.

---

## File Structure

**Web repo (Phase 0):**
- Create: `src/app/api/delivery/places/route.ts` — Google Places proxy (autocomplete + details).
- Create: `src/app/api/delivery/places/route.test.ts` — mocked-fetch unit test.

**App repo:**
- Create: `lib/delivery.ts` — display-only constants + pure helpers (postcode, eligibility, fee display, quote reason copy).
- Create: `lib/delivery.test.ts`
- Create: `lib/places-client.ts` — calls `/api/delivery/places`.
- Create: `lib/places-client.test.ts`
- Create: `hooks/use-delivery-quote.ts` — quote state machine.
- Create: `hooks/use-delivery-tracking.ts` — 5s status poll.
- Create: `components/checkout/FulfillmentSelector.tsx`
- Create: `components/checkout/DeliveryAddressForm.tsx`
- Create: `components/checkout/DeliveryQuoteCard.tsx`
- Create: `components/delivery/TrackingMap.tsx` — WebView + Leaflet HTML.
- Create: `components/delivery/FreshnessBar.tsx`
- Modify: `store/cart.ts` — add `fulfillmentType` + `deliveryAddress` + setters; exclude address from persistence.
- Modify: `store/cart.test.ts` (or new `store/cart-delivery.test.ts`) — store actions.
- Modify: `hooks/use-create-order.ts` — add `fulfillmentType` + `delivery` to body.
- Modify: `app/checkout.tsx` — render selector + address form + quote card; summary fee rows; pay gate; pass delivery to create-order; navigate with `fulfillment` param.
- Modify: `app/order-confirmation.tsx` — delivery branch (TrackingMap + bottom sheet + DE copy).
- Modify: `package.json` — add `react-native-webview`.

---

## Phase 0 — Backend Places proxy (web repo)

### Task 0: `/api/delivery/places` proxy route

**Files (in `~/Github/mandys_bubble_tea`):**
- Create: `src/app/api/delivery/places/route.ts`
- Test: `src/app/api/delivery/places/route.test.ts`

> First: `cd ~/Github/mandys_bubble_tea && git fetch origin && git checkout -b feat/app-places-proxy origin/main`. Confirm `GOOGLE_PLACES_API_KEY` exists server-side: `grep GOOGLE_PLACES .env*` (the existing key is `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`; reuse it server-side here — it has Places API enabled).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/delivery/places/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const KEY = "test-key";
beforeEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY = KEY;
  vi.restoreAllMocks();
});

function req(body: unknown) {
  return new Request("http://x/api/delivery/places", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

it("autocomplete returns predictions", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({
      status: "OK",
      predictions: [{ description: "1 Test St, Southport QLD", place_id: "p1" }],
    })),
  ));
  const res = await POST(req({ input: "1 Test", sessionToken: "s1" }));
  const json = await res.json();
  expect(json.predictions).toEqual([{ description: "1 Test St, Southport QLD", placeId: "p1" }]);
});

it("details returns address + lat/lng + postcode", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({
      status: "OK",
      result: {
        formatted_address: "1 Test St, Southport QLD 4215, Australia",
        geometry: { location: { lat: -27.97, lng: 153.41 } },
        address_components: [{ long_name: "4215", types: ["postal_code"] }],
      },
    })),
  ));
  const res = await POST(req({ placeId: "p1" }));
  const json = await res.json();
  expect(json).toEqual({
    address: "1 Test St, Southport QLD 4215, Australia",
    lat: -27.97,
    lng: 153.41,
    postcode: "4215",
  });
});

it("rejects empty body", async () => {
  const res = await POST(req({}));
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Github/mandys_bubble_tea && npx vitest run src/app/api/delivery/places/route.test.ts`
Expected: FAIL — cannot find `./route`.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/delivery/places/route.ts
import { NextResponse } from "next/server";
import { extractPostcode } from "@/lib/delivery-zone";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

// Server-side proxy for Google Places so the native app never embeds a key.
// Two shapes on one POST: { input, sessionToken } → autocomplete predictions;
// { placeId } → place details (address + lat/lng + postcode). AU-restricted.
export async function POST(request: Request) {
  if (!KEY) {
    return NextResponse.json({ error: "places_unconfigured" }, { status: 503 });
  }
  let body: { input?: string; sessionToken?: string; placeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.placeId === "string" && body.placeId.length > 0) {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(body.placeId)}` +
      `&fields=formatted_address,geometry/location,address_components&key=${KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    const result = data.result;
    const loc = result?.geometry?.location;
    if (!result?.formatted_address || !loc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      address: result.formatted_address,
      lat: loc.lat,
      lng: loc.lng,
      postcode: extractPostcode(result.address_components),
    });
  }

  if (typeof body.input === "string" && body.input.trim().length >= 3) {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(body.input)}` +
      `&components=country:au&key=${KEY}` +
      (body.sessionToken ? `&sessiontoken=${encodeURIComponent(body.sessionToken)}` : "");
    const r = await fetch(url);
    const data = await r.json();
    const predictions = Array.isArray(data.predictions)
      ? data.predictions.map((p: { description: string; place_id: string }) => ({
          description: p.description,
          placeId: p.place_id,
        }))
      : [];
    return NextResponse.json({ predictions });
  }

  return NextResponse.json({ error: "invalid_body" }, { status: 400 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/delivery/places/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit + push**

```bash
git add src/app/api/delivery/places/route.ts src/app/api/delivery/places/route.test.ts
git commit -m "feat(delivery): Places proxy route for native app autocomplete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push -u origin feat/app-places-proxy
```

> This is the only backend change. Merge to main + deploy before the app can autocomplete in production. The rest of the plan runs in the app repo.

---

## Phase 1 — App delivery pure logic (`lib/delivery.ts`)

> All remaining work is in `~/Github/mandys_bubble_tea_app` on branch `feat/delivery`.
> Mirror values from web `src/lib/constants.ts` DELIVERY block (verbatim):
> tiers `[{maxKm:4,fee:499,freeAt:3500},{maxKm:6,fee:699,freeAt:5000},{maxKm:8,fee:899,freeAt:5000}]`,
> farFee 1500, minOrder 1200, serviceFeeBps 500, postcodes `4211,4214,4215,4216,4217,4218`,
> store `-27.9660,153.4115`, driver `Rick Zhang / +61404978238 / "+61 404 978 238"`.
> The **fee math itself is NOT replicated** — the server computes it; the app only mirrors
> display constants + the lowest free-at threshold for selector copy ("free over $35").

### Task 1: `lib/delivery.ts` constants + postcode + eligibility

**Files:**
- Create: `lib/delivery.ts`
- Test: `lib/delivery.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/delivery.test.ts
import {
  DELIVERABLE_POSTCODES,
  MIN_ORDER_CENTS,
  isDeliverablePostcode,
  isDeliveryEligible,
  deliverySubtitle,
} from './delivery'

describe('delivery zone + eligibility', () => {
  it('whitelists exactly the 6 postcodes', () => {
    expect([...DELIVERABLE_POSTCODES]).toEqual(['4211', '4214', '4215', '4216', '4217', '4218'])
  })
  it('isDeliverablePostcode trims + matches', () => {
    expect(isDeliverablePostcode('4215')).toBe(true)
    expect(isDeliverablePostcode(' 4215 ')).toBe(true)
    expect(isDeliverablePostcode('4000')).toBe(false)
    expect(isDeliverablePostcode('')).toBe(false)
    expect(isDeliverablePostcode(null)).toBe(false)
  })
  it('isDeliveryEligible gates at $12', () => {
    expect(isDeliveryEligible(1199)).toBe(false)
    expect(isDeliveryEligible(1200)).toBe(true)
    expect(isDeliveryEligible(2000)).toBe(true)
  })
  it('deliverySubtitle shows free-over when eligible, add-to-enable when not', () => {
    expect(deliverySubtitle(2000)).toBe('free over $35')
    expect(deliverySubtitle(1000)).toBe('Add $2.00 to enable')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/delivery.test.ts`
Expected: FAIL — cannot find module `./delivery`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/delivery.ts
import { formatPrice } from '@/lib/utils'

export const MIN_ORDER_CENTS = 1200

// Mirror of web src/lib/constants.ts DELIVERABLE_POSTCODES (server is authoritative;
// this is for instant client-side hints only).
export const DELIVERABLE_POSTCODES = ['4211', '4214', '4215', '4216', '4217', '4218'] as const

// Lowest tier free-at threshold ($35) — selector copy only.
export const FREE_OVER_CENTS = 3500

export const DELIVERY_FEE_NAME = 'Delivery Fee'
export const SERVICE_FEE_LABEL = 'Service Fee (5%)'

export const STORE_LAT = -27.966
export const STORE_LNG = 153.4115

export const DELIVERY_DRIVER = {
  name: 'Rick Zhang',
  phone: '+61404978238',
  phoneDisplay: '+61 404 978 238',
} as const

const ALLOWED = new Set<string>(DELIVERABLE_POSTCODES)

export function isDeliverablePostcode(pc: string | null | undefined): boolean {
  if (!pc) return false
  return ALLOWED.has(pc.trim())
}

export function isDeliveryEligible(drinksSubtotalCents: number): boolean {
  return drinksSubtotalCents >= MIN_ORDER_CENTS
}

// Selector subtitle text under "Delivery".
export function deliverySubtitle(drinksSubtotalCents: number): string {
  if (isDeliveryEligible(drinksSubtotalCents)) {
    return `free over ${formatPrice(FREE_OVER_CENTS)}`
  }
  const remaining = MIN_ORDER_CENTS - drinksSubtotalCents
  return `Add ${formatPrice(remaining)} to enable`
}
```

> Note: confirm `formatPrice(3500)` renders `"$35.00"` (web copy says "free over $35"). If `formatPrice`
> always shows cents, the string becomes "free over $35.00" — acceptable and unambiguous; keep it. If you
> want exactly "$35", special-case whole dollars in `deliverySubtitle` only. Default: keep `formatPrice`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/delivery.test.ts`
Expected: PASS. (If the subtitle assertion mismatches on `$35` vs `$35.00`, update the test to the actual `formatPrice` output and keep going — the output, not the literal, is the contract.)

- [ ] **Step 5: Commit**

```bash
git add lib/delivery.ts lib/delivery.test.ts
git commit -m "feat(delivery): app-side display constants + postcode/eligibility helpers"
```

### Task 2: Quote reason→copy + fee display resolver

**Files:**
- Modify: `lib/delivery.ts`
- Modify: `lib/delivery.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// lib/delivery.test.ts — append
import {
  quoteReasonCopy,
  feeValueText,
  deliveryFeesPending,
  deliveryAddOnCents,
} from './delivery'

describe('quote reason copy (verbatim from web)', () => {
  it('maps known reasons', () => {
    expect(quoteReasonCopy('out_of_zone')).toBe("Sorry, we don't deliver to that postcode")
    expect(quoteReasonCopy('closed')).toBe('Delivery hours: 10:30am–10:30pm')
    expect(quoteReasonCopy('min_order')).toBe('Add more to qualify for delivery')
    expect(quoteReasonCopy('auth')).toBe('Sign in to get a delivery quote')
    expect(quoteReasonCopy('invalid_body')).toBe('Address looks invalid — try a fuller address')
    expect(quoteReasonCopy('invalid_json')).toBe('Address looks invalid — try a fuller address')
  })
  it('falls back for unknown', () => {
    expect(quoteReasonCopy('weird')).toBe('Delivery unavailable')
  })
})

describe('fee display', () => {
  it('pending → em dash, free → FREE, else amount', () => {
    expect(feeValueText(true, 499)).toBe('—')
    expect(feeValueText(false, 0)).toBe('FREE')
    expect(feeValueText(false, 499)).toBe('$4.99')
  })
  it('deliveryFeesPending only when DELIVERY + not free-redeem + quote not ok', () => {
    expect(deliveryFeesPending('DELIVERY', false, 'loading')).toBe(true)
    expect(deliveryFeesPending('DELIVERY', false, 'ok')).toBe(false)
    expect(deliveryFeesPending('DELIVERY', true, 'loading')).toBe(false) // free redeem
    expect(deliveryFeesPending('PICKUP', false, 'loading')).toBe(false)
  })
  it('deliveryAddOnCents adds fee+service only when applicable', () => {
    const ok = { kind: 'ok' as const, feeCents: 499, serviceFeeCents: 100 }
    expect(deliveryAddOnCents('DELIVERY', false, ok)).toBe(599)
    expect(deliveryAddOnCents('DELIVERY', true, ok)).toBe(0) // free redeem
    expect(deliveryAddOnCents('PICKUP', false, ok)).toBe(0)
    expect(deliveryAddOnCents('DELIVERY', false, { kind: 'loading' })).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/delivery.test.ts`
Expected: FAIL — new exports undefined.

- [ ] **Step 3: Write minimal implementation (append to `lib/delivery.ts`)**

```ts
// lib/delivery.ts — append

export type FulfillmentType = 'PICKUP' | 'DELIVERY'

export type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; feeCents: number; serviceFeeCents: number }
  | { kind: 'error'; message: string }

// Verbatim from web checkout/page.tsx reason map.
const REASON_COPY: Record<string, string> = {
  out_of_zone: "Sorry, we don't deliver to that postcode",
  closed: 'Delivery hours: 10:30am–10:30pm',
  min_order: 'Add more to qualify for delivery',
  auth: 'Sign in to get a delivery quote',
  invalid_body: 'Address looks invalid — try a fuller address',
  invalid_json: 'Address looks invalid — try a fuller address',
}

export function quoteReasonCopy(reason: string): string {
  return REASON_COPY[reason] ?? 'Delivery unavailable'
}

// "—" while a quote is pending, "FREE" at $0, else the formatted amount.
export function feeValueText(pending: boolean, cents: number): string {
  if (pending) return '—'
  if (cents === 0) return 'FREE'
  return formatPrice(cents)
}

export function deliveryFeesPending(
  fulfillment: FulfillmentType,
  isFreeRedeem: boolean,
  quoteKind: QuoteState['kind'],
): boolean {
  return fulfillment === 'DELIVERY' && !isFreeRedeem && quoteKind !== 'ok'
}

// Cents to add to the order total for delivery (fee + 5% service), only when a
// quote has resolved and the order isn't fully covered by a reward.
export function deliveryAddOnCents(
  fulfillment: FulfillmentType,
  isFreeRedeem: boolean,
  quote: QuoteState,
): number {
  if (fulfillment !== 'DELIVERY' || isFreeRedeem) return 0
  if (quote.kind !== 'ok') return 0
  return quote.feeCents + quote.serviceFeeCents
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/delivery.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add lib/delivery.ts lib/delivery.test.ts
git commit -m "feat(delivery): quote reason copy + fee display + total add-on helpers"
```

---

## Phase 2 — Places client (`lib/places-client.ts`)

### Task 3: `placesAutocomplete` + `placeDetails`

**Files:**
- Create: `lib/places-client.ts`
- Test: `lib/places-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/places-client.test.ts
import { placesAutocomplete, placeDetails } from './places-client'

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))
import { apiFetch } from '@/lib/api'
const mockFetch = apiFetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

it('placesAutocomplete posts input + sessionToken, returns predictions', async () => {
  mockFetch.mockResolvedValue({ predictions: [{ description: 'A St', placeId: 'p1' }] })
  const out = await placesAutocomplete('A St', 'sess-1')
  expect(mockFetch).toHaveBeenCalledWith('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ input: 'A St', sessionToken: 'sess-1' }),
  })
  expect(out).toEqual([{ description: 'A St', placeId: 'p1' }])
})

it('placeDetails posts placeId, returns address payload', async () => {
  mockFetch.mockResolvedValue({ address: '1 A St QLD 4215', lat: -27.97, lng: 153.41, postcode: '4215' })
  const out = await placeDetails('p1')
  expect(mockFetch).toHaveBeenCalledWith('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ placeId: 'p1' }),
  })
  expect(out.postcode).toBe('4215')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/places-client.test.ts`
Expected: FAIL — cannot find `./places-client`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/places-client.ts
import { apiFetch } from '@/lib/api'

export type Prediction = { description: string; placeId: string }
export type PlaceDetails = {
  address: string
  lat: number
  lng: number
  postcode: string | null
}

export async function placesAutocomplete(
  input: string,
  sessionToken: string,
): Promise<Prediction[]> {
  const res = await apiFetch<{ predictions: Prediction[] }>('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ input, sessionToken }),
  })
  return res.predictions ?? []
}

export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  return apiFetch<PlaceDetails>('/api/delivery/places', {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/places-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/places-client.ts lib/places-client.test.ts
git commit -m "feat(delivery): Places client (autocomplete + details) over backend proxy"
```

---

## Phase 3 — Cart store delivery fields

### Task 4: Add `fulfillmentType` + `deliveryAddress` to cart store

**Files:**
- Modify: `store/cart.ts`
- Test: `store/cart-delivery.test.ts`

> First read `store/cart.ts` fully. It is a Zustand `create(persist(...))` store keyed `mandys-cart`.
> Find the `partialize` (or persisted shape) — `deliveryAddress` must be EXCLUDED from persistence
> (session-level, matching web), but `fulfillmentType` IS persisted. `clearCart()` must reset both.

- [ ] **Step 1: Write the failing test**

```ts
// store/cart-delivery.test.ts
import { useCart } from './cart'

beforeEach(() => {
  useCart.setState({
    items: [],
    fulfillmentType: 'PICKUP',
    deliveryAddress: { address: '', lat: 0, lng: 0, unit: '', driverNote: '', postcode: '' },
  })
})

it('defaults to PICKUP with empty address', () => {
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('PICKUP')
  expect(s.deliveryAddress.lat).toBe(0)
})

it('setFulfillmentType + setDeliveryAddress mutate state', () => {
  useCart.getState().setFulfillmentType('DELIVERY')
  useCart.getState().setDeliveryAddress({
    address: '1 A St QLD 4215', lat: -27.97, lng: 153.41, unit: '2', driverNote: 'gate code 1', postcode: '4215',
  })
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('DELIVERY')
  expect(s.deliveryAddress.postcode).toBe('4215')
})

it('clearCart resets fulfillment + address', () => {
  useCart.getState().setFulfillmentType('DELIVERY')
  useCart.getState().setDeliveryAddress({ address: 'x', lat: 1, lng: 2, unit: '', driverNote: '', postcode: '4215' })
  useCart.getState().clearCart()
  const s = useCart.getState()
  expect(s.fulfillmentType).toBe('PICKUP')
  expect(s.deliveryAddress.lat).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest store/cart-delivery.test.ts`
Expected: FAIL — `setFulfillmentType` is not a function.

- [ ] **Step 3: Implement (edit `store/cart.ts`)**

Add to the state type/interface:

```ts
export type DeliveryAddress = {
  address: string
  lat: number
  lng: number
  unit: string
  driverNote: string
  postcode: string
}

// inside CartState:
fulfillmentType: 'PICKUP' | 'DELIVERY'
deliveryAddress: DeliveryAddress
setFulfillmentType: (t: 'PICKUP' | 'DELIVERY') => void
setDeliveryAddress: (patch: Partial<DeliveryAddress>) => void
```

Add the initial values to the store creator:

```ts
const EMPTY_ADDRESS: DeliveryAddress = {
  address: '', lat: 0, lng: 0, unit: '', driverNote: '', postcode: '',
}

// in create():
fulfillmentType: 'PICKUP',
deliveryAddress: EMPTY_ADDRESS,
setFulfillmentType: (t) => set({ fulfillmentType: t }),
setDeliveryAddress: (patch) =>
  set((s) => ({ deliveryAddress: { ...s.deliveryAddress, ...patch } })),
```

In `clearCart`, also reset:

```ts
// merge into the existing clearCart set({...}) payload:
fulfillmentType: 'PICKUP',
deliveryAddress: EMPTY_ADDRESS,
```

In the `persist` config `partialize` (add one if absent), persist `fulfillmentType` but NOT `deliveryAddress`:

```ts
partialize: (s) => ({
  items: s.items,
  labelSelections: s.labelSelections,
  cartSessionId: s.cartSessionId,
  fulfillmentType: s.fulfillmentType,
  // deliveryAddress intentionally omitted — session-level only.
}),
```

> If a `partialize` already exists, just add `fulfillmentType: s.fulfillmentType` to it and leave
> `deliveryAddress` out. Match the existing persisted keys exactly so you don't drop any.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest store/cart-delivery.test.ts`
Expected: PASS (3 tests). Also run the existing cart tests to confirm no regression:
Run: `npx jest store/cart-migration.test.ts store/cart-selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add store/cart.ts store/cart-delivery.test.ts
git commit -m "feat(delivery): cart store fulfillment type + session-level delivery address"
```

---

## Phase 4 — Quote hook

### Task 5: `hooks/use-delivery-quote.ts`

**Files:**
- Create: `hooks/use-delivery-quote.ts`

> Logic mirrors web checkout/page.tsx quote effect: when DELIVERY + address+lat/lng+postcode present
> + deliverable postcode + subtotal ≥ min, POST `/api/delivery/quote` with `drinksSubtotalCents`.
> Re-quote when address or subtotal changes. Map `data.ok` → ok; else `quoteReasonCopy(data.reason)`.
> No render test (hook around network); the reason/pending logic is already unit-tested in `lib/delivery`.

- [ ] **Step 1: Write the hook**

```ts
// hooks/use-delivery-quote.ts
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  type QuoteState,
  type FulfillmentType,
  type DeliveryAddress,
  isDeliverablePostcode,
  isDeliveryEligible,
  quoteReasonCopy,
} from '@/lib/delivery'
import type { DeliveryAddress as StoreAddress } from '@/store/cart'

type Args = {
  fulfillment: FulfillmentType
  address: StoreAddress
  drinksSubtotalCents: number
}

export function useDeliveryQuote({ fulfillment, address, drinksSubtotalCents }: Args): QuoteState {
  const [state, setState] = useState<QuoteState>({ kind: 'idle' })

  useEffect(() => {
    if (fulfillment !== 'DELIVERY') {
      setState({ kind: 'idle' })
      return
    }
    if (!address.lat || !address.lng || !address.address) {
      setState({ kind: 'idle' })
      return
    }
    if (!address.postcode) {
      setState({ kind: 'error', message: 'Enter your delivery postcode' })
      return
    }
    if (!isDeliverablePostcode(address.postcode)) {
      setState({ kind: 'error', message: "Sorry, we don't deliver to that postcode" })
      return
    }
    if (!isDeliveryEligible(drinksSubtotalCents)) {
      setState({ kind: 'error', message: 'Add more to qualify for delivery' })
      return
    }

    setState({ kind: 'loading' })
    let cancelled = false
    apiFetch<{ ok: boolean; feeCents?: number; serviceFeeCents?: number; reason?: string }>(
      '/api/delivery/quote',
      {
        method: 'POST',
        body: JSON.stringify({
          address: address.address,
          lat: address.lat,
          lng: address.lng,
          unit: address.unit,
          driverNote: address.driverNote,
          postcode: address.postcode,
          drinksSubtotalCents,
        }),
      },
    )
      .then((data) => {
        if (cancelled) return
        if (data.ok) {
          setState({ kind: 'ok', feeCents: data.feeCents!, serviceFeeCents: data.serviceFeeCents! })
        } else {
          setState({ kind: 'error', message: quoteReasonCopy(data.reason ?? '') })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'error', message: "Couldn't reach delivery service" })
      })
    return () => {
      cancelled = true
    }
  }, [fulfillment, address.address, address.lat, address.lng, address.postcode, address.unit, address.driverNote, drinksSubtotalCents])

  return state
}
```

> `apiFetch` throws on non-2xx. The web quote route returns 401 for `auth` and 400 for invalid — those
> reject and land in `.catch`. To surface the exact `auth` copy, the hook's catch shows a generic
> message; that's acceptable because the app requires login before checkout (no anon checkout). If anon
> checkout is ever allowed, add a 401-specific branch. Note this in the order-confirmation/known-gaps.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 new errors in `hooks/use-delivery-quote.ts` (pre-existing repo errors unrelated).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-delivery-quote.ts
git commit -m "feat(delivery): useDeliveryQuote hook (mirrors web quote effect)"
```

---

## Phase 5 — Checkout UI components

### Task 6: `FulfillmentSelector`

**Files:**
- Create: `components/checkout/FulfillmentSelector.tsx`

> Read an existing checkout component (e.g. the PaymentBlock area in `app/checkout.tsx`, ~line 439+,
> and the StyleSheet at the bottom) to match spacing/typography tokens. Use `BRAND.color` for the
> active border and `BRAND.accentColor` for the active fill. Pickup subtitle: "~10 min · 34 Davenport St".

- [ ] **Step 1: Write the component**

```tsx
// components/checkout/FulfillmentSelector.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BRAND } from '@/lib/constants'
import { deliverySubtitle, isDeliveryEligible, type FulfillmentType } from '@/lib/delivery'

type Props = {
  value: FulfillmentType
  onChange: (t: FulfillmentType) => void
  drinksSubtotalCents: number
}

export function FulfillmentSelector({ value, onChange, drinksSubtotalCents }: Props) {
  const eligible = isDeliveryEligible(drinksSubtotalCents)
  return (
    <View style={styles.row}>
      <Option
        active={value === 'PICKUP'}
        title="Pickup"
        subtitle="~10 min · 34 Davenport St"
        onPress={() => onChange('PICKUP')}
      />
      <Option
        active={value === 'DELIVERY'}
        title="Delivery"
        subtitle={deliverySubtitle(drinksSubtotalCents)}
        disabled={!eligible}
        onPress={() => eligible && onChange('DELIVERY')}
      />
    </View>
  )
}

function Option({
  active, title, subtitle, onPress, disabled,
}: { active: boolean; title: string; subtitle: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={[
        styles.option,
        active && { borderColor: BRAND.color, backgroundColor: BRAND.accentColor },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.title, active && { color: BRAND.color }]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  option: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5DED3', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff',
  },
  disabled: { opacity: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: '#3A3A3A' },
  subtitle: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in the file.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/FulfillmentSelector.tsx
git commit -m "feat(delivery): FulfillmentSelector (Pickup/Delivery toggle, app palette)"
```

### Task 7: `DeliveryAddressForm`

**Files:**
- Create: `components/checkout/DeliveryAddressForm.tsx`

> Mirrors web `DeliveryAddressForm.tsx` fields/copy: Address (autocomplete via `placesAutocomplete`/
> `placeDetails`), Postcode (4-digit, instant zone hint), Unit (optional), Note for driver (≤120),
> Phone (prefilled, display only — NOT sent; server uses profile phone). Selecting a prediction sets
> lat/lng/postcode; editing the address text after selection invalidates coords (sets lat/lng = 0).
> Generate one Places session token per form mount (use a UUID; the app already mints UUIDs for
> `cartSessionId` — reuse that util, e.g. `import { randomUUID } from 'expo-crypto'` or the existing
> helper in `store/cart.ts`; check which is used and match it).

- [ ] **Step 1: Write the component**

```tsx
// components/checkout/DeliveryAddressForm.tsx
import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BRAND } from '@/lib/constants'
import { isDeliverablePostcode, DELIVERABLE_POSTCODES } from '@/lib/delivery'
import { placesAutocomplete, placeDetails, type Prediction } from '@/lib/places-client'
import type { DeliveryAddress } from '@/store/cart'

type Props = {
  value: DeliveryAddress
  onChange: (patch: Partial<DeliveryAddress>) => void
  defaultPhone?: string
}

// One Places billing session per form mount. Use the same UUID source the app
// already uses for cartSessionId (match store/cart.ts).
function useSessionToken(): string {
  const ref = useRef<string>('')
  if (!ref.current) {
    ref.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  return ref.current
}

export function DeliveryAddressForm({ value, onChange, defaultPhone }: Props) {
  const sessionToken = useSessionToken()
  const [query, setQuery] = useState(value.address)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const confirmedRef = useRef<string>(value.lat && value.lng ? value.address : '')

  // Debounced autocomplete.
  useEffect(() => {
    if (query.trim().length < 3 || query === confirmedRef.current) {
      setPredictions([])
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const preds = await placesAutocomplete(query, sessionToken)
        if (!cancelled) setPredictions(preds)
      } catch {
        if (!cancelled) setPredictions([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query, sessionToken])

  const selectPrediction = async (p: Prediction) => {
    setPredictions([])
    setQuery(p.description)
    try {
      const d = await placeDetails(p.placeId)
      confirmedRef.current = d.address
      setQuery(d.address)
      onChange({
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        ...(d.postcode ? { postcode: d.postcode } : {}),
      })
    } catch {
      // leave coords unset; quote stays idle until a valid selection
    }
  }

  const handleAddressInput = (text: string) => {
    setQuery(text)
    const diverged = text !== confirmedRef.current
    onChange({ address: text, ...(diverged ? { lat: 0, lng: 0 } : {}) })
  }

  const confirmed = !!value.lat && !!value.lng
  const pc = value.postcode.trim()

  return (
    <View style={styles.wrap}>
      <Field label="Delivery Address">
        <TextInput
          value={query}
          onChangeText={handleAddressInput}
          placeholder="Start typing your address…"
          style={styles.input}
          autoCorrect={false}
        />
        {confirmed ? (
          <Text style={styles.ok}>✓ Address confirmed</Text>
        ) : query.trim().length > 0 ? (
          <Text style={styles.warn}>Select your address from the list</Text>
        ) : null}
        {predictions.length > 0 && (
          <View style={styles.dropdown}>
            <FlatList
              data={predictions}
              keyExtractor={(p) => p.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.predRow} onPress={() => selectPrediction(item)}>
                  <Text style={styles.predText}>{item.description}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </Field>

      <Field label="Postcode (required for delivery)">
        <TextInput
          value={value.postcode}
          onChangeText={(t) => onChange({ postcode: t.replace(/[^0-9]/g, '').slice(0, 4) })}
          placeholder="4215"
          keyboardType="number-pad"
          maxLength={4}
          style={styles.input}
        />
        {pc.length === 4 &&
          (isDeliverablePostcode(pc) ? (
            <Text style={styles.ok}>✓ In our delivery zone</Text>
          ) : (
            <Text style={styles.warn}>
              Sorry, we only deliver to {DELIVERABLE_POSTCODES.join(', ')}.
            </Text>
          ))}
      </Field>

      <Field label="Apartment / Unit (optional)">
        <TextInput
          value={value.unit}
          onChangeText={(t) => onChange({ unit: t })}
          placeholder="Unit 2"
          style={styles.input}
        />
      </Field>

      <Field label="Note for driver (optional)">
        <TextInput
          value={value.driverNote}
          onChangeText={(t) => onChange({ driverNote: t.slice(0, 120) })}
          placeholder="Gate code, landmark…"
          multiline
          style={[styles.input, styles.multiline]}
        />
      </Field>

      <Field label="Phone (required for delivery)">
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="0404 978 238"
          keyboardType="phone-pad"
          style={styles.input}
        />
      </Field>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#3A3A3A' },
  input: {
    borderWidth: 1, borderColor: '#D8D2C7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff',
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  ok: { fontSize: 12, color: '#3F7A3F', marginTop: 2 },
  warn: { fontSize: 12, color: '#B07A1E', marginTop: 2 },
  dropdown: {
    borderWidth: 1, borderColor: '#E5DED3', borderRadius: 10, marginTop: 4,
    maxHeight: 180, backgroundColor: '#fff', overflow: 'hidden',
  },
  predRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFEAE1' },
  predText: { fontSize: 13, color: '#3A3A3A' },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in the file. (`React` namespace: if the repo doesn't auto-import `React`, add `import React from 'react'` or use `import { type ReactNode } from 'react'` and type `children: ReactNode`.)

- [ ] **Step 3: Commit**

```bash
git add components/checkout/DeliveryAddressForm.tsx
git commit -m "feat(delivery): DeliveryAddressForm (autocomplete + postcode zone hint + unit/note/phone)"
```

### Task 8: `DeliveryQuoteCard`

**Files:**
- Create: `components/checkout/DeliveryQuoteCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/checkout/DeliveryQuoteCard.tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { BRAND } from '@/lib/constants'
import type { QuoteState } from '@/lib/delivery'

export function DeliveryQuoteCard({ quote }: { quote: QuoteState }) {
  if (quote.kind === 'idle') return null
  if (quote.kind === 'loading') {
    return (
      <View style={[styles.card, styles.neutral]}>
        <ActivityIndicator size="small" color={BRAND.color} />
        <Text style={styles.text}>Checking delivery availability…</Text>
      </View>
    )
  }
  if (quote.kind === 'error') {
    return (
      <View style={[styles.card, styles.error]}>
        <Text style={styles.errorText}>{quote.message}</Text>
      </View>
    )
  }
  return (
    <View style={[styles.card, styles.ok]}>
      <Text style={styles.okText}>✓ Delivery available — our team brings it to your door</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 8 },
  neutral: { backgroundColor: '#F5F1EA' },
  ok: { backgroundColor: '#EAF3EA' },
  error: { backgroundColor: '#FBEFE0' },
  text: { fontSize: 13, color: '#5A5A5A' },
  okText: { fontSize: 13, color: '#3F7A3F', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#B07A1E', fontWeight: '600' },
})
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no new errors.

```bash
git add components/checkout/DeliveryQuoteCard.tsx
git commit -m "feat(delivery): DeliveryQuoteCard (loading/available/error states)"
```

---

## Phase 6 — Wire delivery into checkout

### Task 9: Render selector + address form + quote in `app/checkout.tsx`

**Files:**
- Modify: `app/checkout.tsx`

> Read `app/checkout.tsx` around lines 220–320 (totals + payment amount math), 430–490 (render: where
> `<StoreBlock/>`, `<PickupTimeBlock/>`, `<SummaryBlock .../>` are mounted), and 790–915 (SummaryBlock).
> You will: (a) read cart fulfillment state, (b) compute the quote, (c) render selector + (when DELIVERY)
> address form + quote card replacing/above the Pickup blocks, (d) pass delivery fee data into SummaryBlock,
> (e) gate Place Order on a resolved quote, (f) send delivery in create-order, (g) navigate with a
> `fulfillment` param. Split across Tasks 9–12.

- [ ] **Step 1: Add state + quote wiring near the top of the checkout component**

```tsx
// imports
import { useCart } from '@/store/cart'
import { FulfillmentSelector } from '@/components/checkout/FulfillmentSelector'
import { DeliveryAddressForm } from '@/components/checkout/DeliveryAddressForm'
import { DeliveryQuoteCard } from '@/components/checkout/DeliveryQuoteCard'
import { useDeliveryQuote } from '@/hooks/use-delivery-quote'
import { deliveryAddOnCents, deliveryFeesPending } from '@/lib/delivery'

// inside the component (use the existing cart hook instance if one already exists):
const fulfillmentType = useCart((s) => s.fulfillmentType)
const setFulfillmentType = useCart((s) => s.setFulfillmentType)
const deliveryAddress = useCart((s) => s.deliveryAddress)
const setDeliveryAddress = useCart((s) => s.setDeliveryAddress)

// `subtotal` is the existing drinks subtotal in cents (number). Reuse it.
const quote = useDeliveryQuote({
  fulfillment: fulfillmentType,
  address: deliveryAddress,
  drinksSubtotalCents: subtotal,
})
```

- [ ] **Step 2: Render the selector + delivery UI in place of the pickup-only blocks**

Replace the `<StoreBlock />` + `<PickupTimeBlock />` region (~lines 439–440) with:

```tsx
<FulfillmentSelector
  value={fulfillmentType}
  onChange={setFulfillmentType}
  drinksSubtotalCents={subtotal}
/>
{fulfillmentType === 'PICKUP' ? (
  <>
    <StoreBlock />
    <PickupTimeBlock />
  </>
) : (
  <>
    <DeliveryAddressForm
      value={deliveryAddress}
      onChange={setDeliveryAddress}
      defaultPhone={profilePhone /* reuse however the screen already reads the signed-in phone; pass undefined if not handy */}
    />
    <DeliveryQuoteCard quote={quote} />
  </>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Resolve `profilePhone` to the actual source (the screen likely has a `useAuth`/profile hook; if not trivially available, pass `defaultPhone={undefined}` — phone is display-only).

- [ ] **Step 4: Manual verify (Metro)**

Run: `npx expo start` (or the project's existing dev command). In the simulator: open checkout, toggle Pickup/Delivery. Confirm Delivery is disabled under $12 (subtitle "Add $X to enable"), and enabled above it (subtitle "free over $35"). Selecting Delivery shows the address form + quote card.

- [ ] **Step 5: Commit**

```bash
git add app/checkout.tsx
git commit -m "feat(delivery): checkout fulfillment selector + address form + quote card"
```

### Task 10: Delivery fee + service fee rows in `SummaryBlock`

**Files:**
- Modify: `app/checkout.tsx` (SummaryBlock + its call site + total math)

- [ ] **Step 1: Extend `SummaryBlock` props + rows**

Add props to `SummaryBlock` and render two fee rows. Add a string-value row helper next to `SummaryRow`:

```tsx
// new prop types on SummaryBlock:
//   delivery?: { pending: boolean; feeCents: number; serviceFeeCents: number } | null

// in SummaryBlock, BEFORE the divider/Total, when delivery != null:
{delivery && (
  <>
    <SummaryTextRow label="Delivery Fee" value={feeValueText(delivery.pending, delivery.feeCents)} />
    <SummaryTextRow label="Service Fee (5%)" value={feeValueText(delivery.pending, delivery.serviceFeeCents)} />
  </>
)}
```

Add the helper component (next to `SummaryRow`):

```tsx
function SummaryTextRow({ label, value }: { label: string; value: string }) {
  const isFree = value === 'FREE'
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, styles.summaryLabelMuted]}>{label}</Text>
      <Text style={[styles.summaryValue, styles.summaryValueMuted, isFree && { color: '#3F7A3F' }]}>
        {value}
      </Text>
    </View>
  )
}
```

Import `feeValueText` at the top: `import { feeValueText } from '@/lib/delivery'`.

Update the `total` inside SummaryBlock to include the resolved add-on. Since SummaryBlock currently
computes `total` itself, pass the add-on in and include it:

```tsx
// add prop: deliveryAddOnCents?: number  (default 0)
const total = Math.max(
  subtotal - discountTotal + surcharge + platformFeeAmt + phSurcharge + (deliveryAddOnCents ?? 0),
  0,
)
```

- [ ] **Step 2: Update the `<SummaryBlock .../>` call site (~line 475)**

```tsx
<SummaryBlock
  /* ...existing props... */
  delivery={
    fulfillmentType === 'DELIVERY'
      ? {
          pending: deliveryFeesPending(fulfillmentType, isFreeRedeem, quote.kind),
          feeCents: quote.kind === 'ok' ? quote.feeCents : 0,
          serviceFeeCents: quote.kind === 'ok' ? quote.serviceFeeCents : 0,
        }
      : null
  }
  deliveryAddOnCents={deliveryAddOnCents(fulfillmentType, isFreeRedeem, quote)}
/>
```

> `isFreeRedeem` already exists in the checkout component (line ~226). Reuse it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 4: Manual verify**

Simulator: Delivery selected, address incomplete → both fee rows show "—". Complete a valid address →
rows show resolved fee (or "FREE" in green) + service fee; Total increases by fee+service. Switch to
Pickup → fee rows disappear, Total reverts.

- [ ] **Step 5: Commit**

```bash
git add app/checkout.tsx
git commit -m "feat(delivery): summary delivery + service fee rows with pending/FREE states"
```

### Task 11: Pay gate + create-order delivery body + nav param

**Files:**
- Modify: `app/checkout.tsx`
- Modify: `hooks/use-create-order.ts`

- [ ] **Step 1: Extend `use-create-order.ts` to accept + send delivery**

In `CreateOrderParams` add:

```ts
fulfillmentType?: 'PICKUP' | 'DELIVERY'
delivery?: { address: string; lat: number; lng: number; unit?: string; driverNote?: string; postcode?: string }
```

In the destructure and the POST body:

```ts
// destructure params: add fulfillmentType, delivery
// in body: JSON.stringify({ ...existing,
  fulfillmentType: fulfillmentType ?? 'PICKUP',
  ...(fulfillmentType === 'DELIVERY' && delivery ? { delivery } : {}),
// })
```

> The server recomputes delivery + service fees from `delivery` and stamps them; do not send fee amounts.

- [ ] **Step 2: Gate Place Order + pass delivery on submit (in `app/checkout.tsx`)**

Where the Place Order button's disabled/handler is computed, add a delivery gate:

```tsx
const deliveryReady = fulfillmentType !== 'DELIVERY' || quote.kind === 'ok'
// merge into the existing disabled condition for the pay/place button:
//   disabled={...existing || !deliveryReady}
```

In the order-creation call, pass delivery:

```tsx
await createOrder({
  /* ...existing args... */
  fulfillmentType,
  delivery:
    fulfillmentType === 'DELIVERY'
      ? {
          address: deliveryAddress.address,
          lat: deliveryAddress.lat,
          lng: deliveryAddress.lng,
          unit: deliveryAddress.unit || undefined,
          driverNote: deliveryAddress.driverNote || undefined,
          postcode: deliveryAddress.postcode || undefined,
        }
      : undefined,
})
```

- [ ] **Step 3: Pass `fulfillment` to the confirmation route on navigate**

Find the `router.push`/`router.replace` to `order-confirmation` after payment. Add `fulfillment` to its
params (the DE/OL number already flows as `pickupNumber`):

```tsx
router.replace({
  pathname: '/order-confirmation',
  params: {
    orderId,
    pickupNumber, // already DE… for delivery (server prefixes)
    loyaltyAccrued: String(loyaltyAccrued ?? 0),
    fulfillment: fulfillmentType,
  },
})
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/checkout.tsx hooks/use-create-order.ts
git commit -m "feat(delivery): send delivery body, gate pay on quote, pass fulfillment to confirmation"
```

---

## Phase 7 — Tracking map (WebView + Leaflet)

### Task 12: Install `react-native-webview`

**Files:**
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Install**

Run: `npx expo install react-native-webview`
Expected: adds `react-native-webview` to dependencies (Expo picks the SDK-54-compatible version).

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(delivery): add react-native-webview for live tracking map"
```

> A native rebuild is required before this renders on device (Task 16). It runs fine in the dev client
> once rebuilt; in Expo Go it will not load (custom native module).

### Task 13: `TrackingMap` component (self-contained Leaflet HTML)

**Files:**
- Create: `components/delivery/TrackingMap.tsx`

> Port web `DeliveryMap.tsx` Leaflet behavior into an HTML string: OSM tiles, emoji divIcons
> (🧋 store / 🛵 driver / 🏠 destination) with `BRAND.color` rings on store+driver and `#5B7A52` on
> destination, 900ms driver tween, `fitBounds` with bottom padding for the overlay sheet. The native
> side calls `window.updateTracking(json)` via `injectJavaScript`. Store + destination are passed once;
> driver updates re-fit + tween.

- [ ] **Step 1: Write the component**

```tsx
// components/delivery/TrackingMap.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { BRAND } from '@/lib/constants'

export type Tracking = {
  destLat: number | null
  destLng: number | null
  storeLat: number
  storeLng: number
  driverLat: number | null
  driverLng: number | null
  driverHeading: number | null
  locationUpdatedAt: string | null
}

export type TrackingMapHandle = { update: (t: Tracking) => void }

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;background:#E8E5DE}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var PRIMARY=${JSON.stringify(BRAND.color)};
var map=L.map('map',{zoomControl:false,scrollWheelZoom:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
function pin(emoji,ring){return L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],
  html:'<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#fff;border:2px solid '+ring+';box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:18px;line-height:1">'+emoji+'</div>'});}
var storeM=null,destM=null,driverM=null,anim=null,cur={};
function pts(){var a=[[cur.storeLat,cur.storeLng]];
  if(cur.destLat!=null&&cur.destLng!=null)a.push([cur.destLat,cur.destLng]);
  if(cur.driverLat!=null&&cur.driverLng!=null)a.push([cur.driverLat,cur.driverLng]);return a;}
function fit(){var p=pts();if(p.length===1){map.setView(p[0],15);return;}
  var h=map.getSize().y||600,bp=Math.min(240,Math.round(h*0.38));
  map.fitBounds(L.latLngBounds(p).pad(0.3),{maxZoom:16,paddingTopLeft:[30,40],paddingBottomRight:[30,bp]});}
window.updateTracking=function(t){
  cur=t;
  if(!storeM){storeM=L.marker([t.storeLat,t.storeLng],{icon:pin('🧋',PRIMARY)}).addTo(map).bindTooltip("Mandy's");}
  if(t.destLat!=null&&t.destLng!=null&&!destM){destM=L.marker([t.destLat,t.destLng],{icon:pin('🏠','#5B7A52')}).addTo(map).bindTooltip('Your address');}
  if(t.driverLat!=null&&t.driverLng!=null){
    var target=[t.driverLat,t.driverLng];
    if(!driverM){driverM=L.marker(target,{icon:pin('🛵',PRIMARY),zIndexOffset:1000}).addTo(map).bindTooltip('Driver');fit();}
    else{var s=driverM.getLatLng(),f=[s.lat,s.lng],t0=Date.now();
      if(anim)cancelAnimationFrame(anim);
      (function step(){var p=Math.min(1,(Date.now()-t0)/900);
        driverM.setLatLng([f[0]+(target[0]-f[0])*p,f[1]+(target[1]-f[1])*p]);
        if(p<1)anim=requestAnimationFrame(step);else fit();})();}
  } else { fit(); }
  setTimeout(function(){map.invalidateSize();fit();},50);
};
</script></body></html>`

export const TrackingMap = forwardRef<TrackingMapHandle, { initial: Tracking }>(
  function TrackingMap({ initial }, ref) {
    const webRef = useRef<WebView>(null)
    const inject = (t: Tracking) => {
      webRef.current?.injectJavaScript(`window.updateTracking(${JSON.stringify(t)});true;`)
    }
    useImperativeHandle(ref, () => ({ update: inject }), [])
    return (
      <View style={styles.fill}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: HTML }}
          onLoadEnd={() => inject(initial)}
          style={styles.fill}
          scrollEnabled={false}
        />
      </View>
    )
  },
)

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#E8E5DE' } })
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → no new errors (WebView types come from the package).

- [ ] **Step 3: Commit**

```bash
git add components/delivery/TrackingMap.tsx
git commit -m "feat(delivery): TrackingMap WebView with self-contained Leaflet (emoji pins, 900ms tween)"
```

### Task 14: `FreshnessBar` + `use-delivery-tracking`

**Files:**
- Create: `components/delivery/FreshnessBar.tsx`
- Create: `hooks/use-delivery-tracking.ts`

- [ ] **Step 1: FreshnessBar (port of web FreshnessBar)**

```tsx
// components/delivery/FreshnessBar.tsx
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export function FreshnessBar({
  hasDriver, locationUpdatedAt,
}: { hasDriver: boolean; locationUpdatedAt: string | null }) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 10000)
    return () => clearInterval(id)
  }, [])

  let label: string
  if (!hasDriver || !locationUpdatedAt) {
    label = 'Waiting for driver location…'
  } else {
    const ageSec = Math.max(0, Math.round((Date.now() - new Date(locationUpdatedAt).getTime()) / 1000))
    if (ageSec < 15) label = 'Live · driver on the way'
    else if (ageSec < 60) label = `Updated ${ageSec}s ago`
    else label = `Updated ${Math.round(ageSec / 60)}m ago`
  }
  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: hasDriver ? '#5B7A52' : '#C9A227' }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600', color: '#3F3F46' },
})
```

- [ ] **Step 2: tracking hook (5s poll of status)**

```ts
// hooks/use-delivery-tracking.ts
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { Tracking } from '@/components/delivery/TrackingMap'

type StatusResponse = { ok: boolean; state: string | null; tracking: Tracking | null }

const POLL_MS = 5000

export function useDeliveryTracking(orderId: string, active: boolean) {
  const [state, setState] = useState<string | null>(null)
  const [tracking, setTracking] = useState<Tracking | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !orderId) return
    let cancelled = false
    const poll = async () => {
      try {
        const data = await apiFetch<StatusResponse>(`/api/orders/${orderId}/status`)
        if (cancelled) return
        setState(data.state)
        setTracking(data.tracking)
      } catch {
        /* keep last known; next tick retries */
      }
    }
    poll()
    timer.current = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
    }
  }, [orderId, active])

  return { state, tracking }
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → no new errors.

```bash
git add components/delivery/FreshnessBar.tsx hooks/use-delivery-tracking.ts
git commit -m "feat(delivery): FreshnessBar + useDeliveryTracking (5s status poll)"
```

---

## Phase 8 — Order confirmation delivery branch

### Task 15: Delivery tracking view in `app/order-confirmation.tsx`

**Files:**
- Modify: `app/order-confirmation.tsx`

> Read the file. It reads params (`orderId`, `pickupNumber`, `loyaltyAccrued`), polls status, holds
> `fulfillmentState`, and renders pickup UI (pickup card + Carto map tile). Add a `fulfillment` param,
> and when `fulfillment === 'DELIVERY'`: change the number label/subtitle to delivery copy, and when
> `fulfillmentState === 'PREPARED'` with tracking coords, render `TrackingMap` + the Uber-Eats bottom
> sheet (driver card + call + ETA + FreshnessBar) instead of the static store tile. The existing 5s
> status poll can stay for pickup; for delivery use `useDeliveryTracking` to get the `tracking` object
> and feed the map. Avoid double-polling: if the screen already polls status, EITHER reuse that poll's
> response to also set `tracking` (add `tracking` to its parsed shape) OR gate the existing poll to
> pickup-only and use `useDeliveryTracking` for delivery. Prefer the latter (clean separation).

- [ ] **Step 1: Read fulfillment param + wire tracking**

```tsx
// imports
import { TrackingMap, type TrackingMapHandle } from '@/components/delivery/TrackingMap'
import { FreshnessBar } from '@/components/delivery/FreshnessBar'
import { useDeliveryTracking } from '@/hooks/use-delivery-tracking'
import { DELIVERY_DRIVER } from '@/lib/delivery'
import { Linking } from 'react-native'

// in the component, read the param:
const { orderId, pickupNumber: pickupNum, loyaltyAccrued, fulfillment } = useLocalSearchParams<{
  orderId: string; pickupNumber: string; loyaltyAccrued: string; fulfillment?: string
}>()
const isDelivery = fulfillment === 'DELIVERY'

// delivery tracking (only polls when delivery):
const { state: deliveryState, tracking } = useDeliveryTracking(orderId, isDelivery)
const mapRef = useRef<TrackingMapHandle>(null)
useEffect(() => {
  if (tracking) mapRef.current?.update(tracking)
}, [tracking])

const outForDelivery = isDelivery && deliveryState === 'PREPARED' && tracking
const hasDriver = !!tracking && tracking.driverLat != null && tracking.driverLng != null
```

> If the screen's existing `fulfillmentState` poll conflicts, gate it: only run it when `!isDelivery`.

- [ ] **Step 2: Delivery number copy**

Where the pickup card renders (`YOUR PICKUP NUMBER` / pickup subtitle), branch the label + subtitle:

```tsx
<Text style={styles.pickupLabel}>{isDelivery ? 'YOUR ORDER NUMBER' : 'YOUR PICKUP NUMBER'}</Text>
<Text style={styles.pickupNumber}>{pickupNumber}</Text>
{/* subtitle, wherever the pickup instruction text is: */}
<Text style={styles.pickupHint}>
  {isDelivery
    ? 'Our team will reference this number when they deliver.'
    : 'Show your pickup number to our team.'}
</Text>
```

- [ ] **Step 3: Render the tracking view when out for delivery**

Replace the static store-map card region with a branch — when `outForDelivery`, render the full-bleed
map + overlay; otherwise keep the existing pickup map tile (for pickup orders and pre-PREPARED delivery):

```tsx
{outForDelivery ? (
  <View style={styles.trackWrap}>
    <TrackingMap ref={mapRef} initial={tracking!} />
    <View style={styles.freshnessFloat}>
      <FreshnessBar hasDriver={hasDriver} locationUpdatedAt={tracking!.locationUpdatedAt} />
    </View>
    <View style={styles.sheet}>
      <Text style={styles.sheetTitle}>Out for Delivery!</Text>
      <Text style={styles.sheetSub}>Your driver is on the way to your address.</Text>
      <View style={styles.driverCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{DELIVERY_DRIVER.name}</Text>
          <Text style={styles.driverRole}>On the way with your order</Text>
        </View>
        <Pressable
          style={styles.callBtn}
          onPress={() => Linking.openURL(`tel:${DELIVERY_DRIVER.phone}`)}
          accessibilityRole="button"
        >
          <Text style={styles.callText}>Call</Text>
        </Pressable>
      </View>
      <View style={styles.sheetRow}>
        <View>
          <Text style={styles.sheetMeta}>Order Number</Text>
          <Text style={[styles.sheetMetaVal, { color: BRAND.color }]}>{pickupNumber}</Text>
        </View>
        <View>
          <Text style={styles.sheetMeta}>ETA</Text>
          <Text style={styles.sheetMetaVal}>~15–25 min</Text>
        </View>
      </View>
    </View>
  </View>
) : (
  /* existing pickup map-tile card stays here unchanged */
)}
```

Add styles (append to the screen's StyleSheet):

```tsx
trackWrap: { height: 460, borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginTop: 12, backgroundColor: '#E8E5DE' },
freshnessFloat: { position: 'absolute', top: 12, left: 12 },
sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10 },
sheetTitle: { fontSize: 18, fontWeight: '800', color: '#2A2A2A' },
sheetSub: { fontSize: 13, color: '#6B6B6B' },
driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F2EB', borderRadius: 14, padding: 12 },
driverName: { fontSize: 15, fontWeight: '700', color: '#2A2A2A' },
driverRole: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
callBtn: { backgroundColor: BRAND.color, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
callText: { color: '#fff', fontWeight: '700', fontSize: 14 },
sheetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
sheetMeta: { fontSize: 11, color: '#9A9A9A', textTransform: 'uppercase' },
sheetMetaVal: { fontSize: 16, fontWeight: '700', color: '#2A2A2A', marginTop: 2 },
```

> Confirm `BRAND` is imported in this file (it likely is, for the existing styles). The ETA "~15–25 min"
> matches no exact web value (web shows an ETA label too) — keep this static string; if web computes an
> ETA, mirror that instead.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/order-confirmation.tsx
git commit -m "feat(delivery): order-confirmation live tracking (map + bottom sheet + DE copy)"
```

---

## Phase 9 — Build + E2E + handoff

### Task 16: Native rebuild (Build 24) + smoke

**Files:** (build artifacts; bump version)

- [ ] **Step 1: Bump iOS build number**

Match the existing release pattern (see commit `1d2d251` "bump iOS app to 1.1.3 (build 23)"). Bump to
build 24 in `app.json`/`app.config` and the iOS project as that commit did. Run: `git diff` to confirm
only version fields changed.

- [ ] **Step 2: Prebuild + rebuild the dev client (for react-native-webview native module)**

Run the project's existing iOS build path (the repo has committed `ios/`). Typically:
`npx expo prebuild -p ios` (if needed) then build via Xcode/`xcodebuild` as prior builds did. The goal:
a dev/simulator build that includes `react-native-webview`.

- [ ] **Step 3: Smoke (simulator)**

- Cart ≥ $12 → Delivery selectable. Select Delivery, pick an address (autocomplete), valid postcode →
  quote resolves, summary shows fee + service + correct total.
- Place order → confirmation shows DE number + delivery copy.
- (Tracking requires a delivery order at PREPARED with driver GPS — drive via the driver app/admin or a
  seeded `delivery_dispatch` row. Mark real-device driver-GPS as a **/tester known-gap** if not seedable.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build(delivery): bump iOS to build 24 (react-native-webview native module)"
```

### Task 17: Detox happy-path (existing setup)

**Files:**
- Create: `e2e/delivery.e2e.ts` (match the repo's existing Detox spec location/pattern)

> Follow the repo's existing Detox config (see memory: `launchArgs.detoxEnableSynchronization=0` +
> `device.disableSynchronization()` for Reanimated). Add `testID`s to FulfillmentSelector options,
> address/postcode inputs, and the Place Order button as you write the test.

- [ ] **Step 1: Write the E2E (select Delivery → fill address/postcode → see quote → fees in summary)**

```ts
// e2e/delivery.e2e.ts (sketch — align to existing e2e helpers)
describe('delivery checkout', () => {
  it('selects delivery, shows fees once quote resolves', async () => {
    // add ≥$12 to cart via existing e2e helper, open checkout
    await element(by.id('fulfillment-delivery')).tap()
    await element(by.id('delivery-postcode')).typeText('4215')
    // address autocomplete needs network + a tap on a prediction; if not stubbable,
    // mark the address-selection step a known-gap and assert the zone hint instead:
    await expect(element(by.text('✓ In our delivery zone'))).toBeVisible()
  })
})
```

- [ ] **Step 2: Run Detox**

Run the repo's Detox build+test commands (`.detoxrc`). Expected: the zone-hint assertion passes.
Network-dependent address selection + Square sandbox payment + real driver GPS are **known-gaps** per
`/tester` policy — document them in the test file header.

- [ ] **Step 3: Commit**

```bash
git add e2e/delivery.e2e.ts
git commit -m "test(delivery): Detox happy-path for delivery selection + zone hint"
```

### Task 18: Finish branch

- [ ] **Step 1: Full typecheck + unit suite**

Run: `npx tsc --noEmit` (no new errors) and `npx jest lib/delivery.test.ts lib/places-client.test.ts store/cart-delivery.test.ts` (all pass).

- [ ] **Step 2: Use `superpowers:finishing-a-development-branch`** to decide merge/PR. The web Places
  proxy branch (`feat/app-places-proxy`) must merge + deploy first so production autocomplete works.

---

## Self-Review

**Spec coverage:**
- Backend Places proxy → Task 0 ✓
- Mirror display constants / postcode / eligibility → Task 1 ✓
- Quote reason copy + fee display (`deliveryFeesPending`/FREE/"—") + total add-on → Task 2 ✓
- Places client → Task 3 ✓
- Cart fulfillment + session address (not persisted) → Task 4 ✓
- Quote hook → Task 5 ✓
- FulfillmentSelector / DeliveryAddressForm / DeliveryQuoteCard → Tasks 6–8 ✓
- Checkout wiring (selector, summary rows, pay gate, create-order body, nav param) → Tasks 9–11 ✓
- WebView dep + TrackingMap + FreshnessBar + tracking hook → Tasks 12–14 ✓
- Order-confirmation delivery branch (map + sheet + DE copy) → Task 15 ✓
- Build 24 + Detox → Tasks 16–17 ✓

**Type consistency:** `QuoteState`/`FulfillmentType`/`DeliveryAddress`/`Tracking` are defined once
(`lib/delivery.ts`, `store/cart.ts`, `components/delivery/TrackingMap.tsx`) and imported everywhere;
`feeValueText`/`deliveryFeesPending`/`deliveryAddOnCents` signatures match their call sites in checkout.

**Known-gaps (carry to /tester):** real Google autocomplete in Detox (network), Square sandbox payment,
real driver-GPS tracking at PREPARED (needs a dispatch row / driver app), `auth`-reason exact copy in the
quote hook catch (app requires login so unreachable in normal flow).
