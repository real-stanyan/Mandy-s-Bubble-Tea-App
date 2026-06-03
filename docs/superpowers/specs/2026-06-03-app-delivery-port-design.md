# App Delivery Port — Design Spec

**Date:** 2026-06-03
**Repo:** `mandys_bubble_tea_app` (primary) + one route in `mandys_bubble_tea` (web backend)
**Goal:** Port the web customer-facing "Deliver" experience to the RN app, fully aligned — identical functionality and pages.

## Context

The web delivery feature is live on `mandys_bubble_tea` main (`a419c90c` pricing + `afb66665`
checkout display + PR#18/19/20 live tracking). The **backend is shared**: the app already talks
to the same Vercel backend (`mandybubbletea.com`) via `lib/api.ts`. Therefore this is almost
entirely a **client-side port** — the app calls existing backend routes; only one new backend
route is required (Places proxy).

The app today is **pickup-only**: no fulfillment selector, no address entry, no map library, and
the cart has no delivery fields. It is Expo SDK 54 / RN 0.81 with native `ios/`, Expo Router,
Zustand cart (AsyncStorage), and the native **Square Mobile Payments SDK** (payment settles by
`orderId`, not a client-supplied amount).

### Confirmed backend behavior (no change needed)
- `POST /api/orders` already accepts `fulfillmentType: "DELIVERY"` + a `delivery` object
  (`{address, lat, lng, unit, driverNote, postcode, phone}`). The **server recomputes the delivery
  fee and 5% service fee authoritatively** and stamps them as `SUBTOTAL_PHASE` service charges.
  The returned Square order total includes them.
- `POST /api/payment` settles by `orderId` → delivery fees are charged automatically; **no
  client-side amount math changes.**
- `POST /api/delivery/quote` is display-only (returns `{ok, feeCents, serviceFeeCents}` or
  `{ok:false, reason}`). Server is the authoritative gate for distance/hours/postcode.
- `GET /api/orders/{orderId}/status` returns fulfillment state + a `tracking` object with
  store/dest/driver coords for live tracking.
- Delivery orders get a `DE`-prefixed order number (vs `OL` for pickup).

## Decisions (approved)
1. **Address autocomplete:** new backend proxy route `/api/delivery/places` reusing the existing
   server-side Google key (key stays off-device). The browser referrer-restricted key cannot be
   used from a native app.
2. **Tracking map:** `react-native-webview` hosting a self-contained Leaflet HTML (OSM tiles +
   emoji pins, identical to web). Native side polls + injects fresh coords. **No new web embed
   route**, no Google Maps SDK key.
3. **Scope:** full experience — fulfillment selector + address form + quote + DE order + live
   tracking.

## Architecture

### Reuse vs new
| Concern | Reused from web (server) | New in app |
|---|---|---|
| Fee tiers / service fee / hours / postcode gate | ✅ server authoritative (`quote` + `orders`) | mirror display-only constants |
| Address autocomplete | ❌ (referrer key unusable) | new `/api/delivery/places` proxy + client |
| Order creation / payment | ✅ `/api/orders` + `/api/payment` | add `delivery` to request body |
| Live tracking data | ✅ `/api/orders/{id}/status` | native polling (JWT) |
| Tracking map render | ✅ Leaflet logic | WebView self-contained HTML, native pushes coords |

### Backend change (web repo — the only one)
`src/app/api/delivery/places/route.ts` — proxy Google Places REST with the existing
`GOOGLE_PLACES_API_KEY`:
- `POST {input, sessionToken}` → `{predictions: [{description, placeId}]}` (Autocomplete)
- `POST {placeId}` → `{address, lat, lng, postcode}` (Place Details; server extracts lat/lng +
  postcode from address components)
- AU-restricted; key never leaves the server.

### App: lib / state
- `lib/delivery.ts` — mirror display-only constants: `MIN_ORDER_CENTS = 1200`, tier free-at
  thresholds for copy, `DELIVERABLE_POSTCODES` (4211, 4214, 4215, 4216, 4217, 4218),
  `DELIVERY_FEE_NAME`, service-fee label "Service Fee (5%)", `DELIVERY_DRIVER`
  (Rick Zhang / +61404978238), store coords (-27.9660, 153.4115).
- `lib/places-client.ts` — calls `/api/delivery/places` (autocomplete + details), debounced, with a
  Places session token.
- `hooks/use-delivery-quote.ts` — when address + lat/lng + postcode + phone present and mode is
  DELIVERY, calls `/api/delivery/quote`; state machine `idle | loading | ok | error`; maps reason
  codes to the exact web copy (`out_of_zone`, `closed`, `min_order`, `auth`, `invalid_*`).
- `store/cart.ts` — add `fulfillmentType: "PICKUP" | "DELIVERY"` (persisted) + `deliveryAddress`
  object (session-level, not persisted, matching web).

### App: UI (native, copy/layout aligned to web)
- `components/checkout/FulfillmentSelector.tsx` — Pickup/Delivery two-button toggle. Delivery
  disabled below `MIN_ORDER_CENTS` showing "Add $X to enable"; eligible shows
  "Delivery · free over $35"; active style brick-red border + cream fill (`#C43A10` / `#F5E6C8`).
- `components/checkout/DeliveryAddressForm.tsx` — Address (autocomplete dropdown) + Postcode
  (4-digit, instant "✓ In our delivery zone" / "Sorry, we only deliver to 4211, 4214, …") + Unit
  (optional) + Note for driver (≤120 chars) + Phone (prefilled from profile).
- `components/checkout/DeliveryQuoteCard.tsx` — loading / available / error states, web copy.
- `app/checkout.tsx` — insert selector + (when DELIVERY) address form + quote card. SummaryBlock
  adds "Delivery Fee" and "Service Fee (5%)" lines with the `deliveryFeesPending` guard
  (`DELIVERY && !isFreeRedeem && quoteState !== "ok"` → "—"; FREE in green; else amount), matching
  web `afb66665` exactly. Pay gate: DELIVERY requires `quoteState === "ok"`.

### App: tracking map (WebView)
- `components/delivery/TrackingMap.tsx` — `react-native-webview` rendering self-contained Leaflet
  HTML (OSM tiles, 🧋 store / 🛵 driver / 🏠 destination emoji pins with colored rings, 900ms
  driver tween, auto-fit bounds). Visuals match web `DeliveryMap`.
- `hooks/use-delivery-tracking.ts` — polls `/api/orders/{orderId}/status` every **5s** (JWT),
  pushes `{storeLat/Lng, destLat/Lng, driverLat/Lng, heading, locationUpdatedAt}` into the WebView
  via `injectJavaScript`.
- `app/order-confirmation.tsx` — for a delivery order with `fulfillmentState === "PREPARED"` and
  tracking data, show the Uber-Eats-style bottom sheet ("Out for Delivery!" + driver card
  Rick Zhang + `tel:` call + order number + ETA + FreshnessBar "Live · driver on the way" /
  "Updated Ns ago") + TrackingMap. DE order number + delivery confirmation copy
  ("Our team will reference this number when they deliver.").

### Order / payment integration
- `hooks/use-create-order.ts` — when DELIVERY, add `fulfillmentType: "DELIVERY"` + `delivery`
  object to the request body. Server stamps fees → returned total includes them.
- `hooks/use-payment.ts` — unchanged (settles by `orderId`).

## Testing
- **Jest unit (pure logic):** `lib/delivery.ts` constants + postcode validation; quote
  reason→copy mapping; `deliveryFeesPending` / FREE / "—" display decision; selector min-order
  gate.
- **Detox (existing setup):** select Delivery → fill address → see quote → summary shows fees.
  Real-device / Square sandbox steps marked **known-gap** per `/tester` policy.
- **Map:** Detox screenshot verification (WebView; cmux browser not applicable to native).

## Dependencies / build
- Add `react-native-webview` (Expo SDK built-in config plugin) → one native rebuild → **Build 24**.
- **Not** needed: `expo-location` (web uses typed address + autocomplete, no device GPS),
  Google Maps SDK key (Leaflet uses OSM tiles).

## Out of scope
- Driver app (already shipped: `mandys-driver`).
- Any change to fee tiers / hours / postcode rules (server authoritative).
- Native interactive map for address picking (web uses typed autocomplete only).
