# Redesign Phase 5 — My Orders

Date: 2026-04-19
Umbrella: `docs/superpowers/specs/2026-04-19-redesign-umbrella.md`
Depends on: Phase 1 (Foundation — `T` tokens + `<Icon>` + `<CupArt>`)
Design reference: `reference/src/OrdersScreen.jsx` (HTML/React prototype, iPhone 14 Pro 402×874pt)

## Goal

Re-skin the `My Orders` tab screen to the new visual system: full-bleed active-order card with embedded 3-step status timeline, paper-card past-order rows with CupArt glyph and inline Reorder link, and a three-way `All / Active / Past` filter strip. Existing data layer (`useOrderHistory` → `useOrdersStore` → `/api/orders/history`) and polling/focus behavior unchanged. Past and active rendering paths consolidated into one screen file driven by a single `orders` list plus `filter` state.

## Non-goals

- No change to order-history data shape (`OrderHistoryItem`) or API.
- No change to single-flight polling (`inFlight` in `store/orders.ts`) or `refresh`/`clear` contracts.
- No change to `order-detail.tsx` screen. Both `Track order →` and `Show pickup →` CTAs route to the existing detail screen; visual redesign of order-detail is deferred.
- No new pickup-QR backend. The reference's `PickupQRSheet` is not implemented here. `Show pickup →` simply navigates to `/order-detail`, which already surfaces the member QR card through `MemberQrCard` on the Account tab — sufficient for staff-side lookup pending a future order-specific QR feature.
- No change to `components/account/OrderHistory.tsx`. That component is still consumed by `app/(tabs)/account.tsx` (Phase 6 re-skin replaces it there). It is **not** used by the new Orders screen.
- No change to Reorder data flow — same "clear cart → loop-add line items → push `/checkout`" pattern as today's `OrderHistory.tsx`, relocated into a shared helper.
- No change to the legacy `BRAND` constant. Only files touched in this phase migrate `BRAND.*` → `T.*`.
- No deep-link param changes on the detail route. `referenceId` / `createdAt` / `state` / `totalCents` / `itemSummary` / `lineCount` / `orderId` / `from` stay as-is.
- No new order lifecycle states. We continue to recognize `OPEN` / `OPEN+PREPARED` (READY) / `COMPLETED` / `CANCELED` only. `PREPARING` in the reference is a display-only bucket mapped from `OPEN` without `PREPARED`.

## Current state (2026-04-19)

- `app/(tabs)/order.tsx` — 141 lines. Renders `<OrderHistory orders={activeOrders} title="In Progress" />` + `<OrderHistory orders={pastOrders} title="Past Orders" />` inside a `ScrollView`. Empty / loading / unauth branches render inline. Uses `Ionicons` + `BRAND.color`.
- `components/account/OrderHistory.tsx` — shared between the two consumers. Encapsulates catalog-image single-flight cache, card styling (shadow-on-white, brick-red price, Reorder / Track buttons), and state badges. Still uses `Ionicons` + `BRAND`.
- `useOrderHistory` — thin wrapper over `useOrdersStore`.
- `useOrdersStore` — exposes `orders`, `activeOrderCount`, `refresh`, `clear`, `isUnfinished` helper. Single-flight via module-level `inFlight`.
- Orders-tab focus behavior: `useFocusEffect` fires `refresh()` on focus; if `activeOrders.length > 0`, starts a 10-second interval polling `refresh()`. Pull-to-refresh via `RefreshControl`. Loading splash is `<ActivityIndicator size="large" color={BRAND.color} />`.
- Unauth branch: centered "Sign in to view your orders" + `Sign in` button routing to `/account`.
- Empty branch: `Ionicons receipt-outline` + "No orders yet" copy.

## Target state

### Screen structure (top → bottom)

```
<View bg=T.bg>
  <OrderScreenHeader
    title="My Orders"
    subtitle={active ? "N in progress · M past" : "M past orders"}
    rightIcon={clock}   // decorative, inert
  />

  <OrdersFilterPills filter state … />  // All / Active (N) / Past

  <ScrollView refreshControl pull-to-refresh>
    {filter ∈ {all, active} && active.length > 0 && (
      <SectionHead label="In progress" count="N order(s)" />
      {active.map ActiveOrderCard}
    )}

    {filter ∈ {all, past} && (
      <SectionHead label="Past orders" />
      {past.map PastOrderRow}
      {past.length === 0 && <EmptyPast />}
    )}

    <View height=40 />
  </ScrollView>
</View>
```

### Active-order card (`<ActiveOrderCard />`)

Derived from `reference/src/OrdersScreen.jsx:93-220`.

Two visual modes, gated by `status === 'READY'`:

| Prop | PREPARING (status=OPEN, fulfillment≠PREPARED) | READY (status=OPEN, fulfillment=PREPARED) |
|---|---|---|
| Background | `T.card` (paper white), 1px `T.line` border | Linear gradient `#A2AD91 → #8CA07D` (sage), no border |
| Text color | `T.ink` | `#fff` |
| Container shadow | `SHADOW.card` | `shadowColor #3C644C`, opacity 0.45, radius 26, offsetY 14 (sage-shadow preset — add to `constants/theme.ts` as `SHADOW.readyCard`) |
| Eyebrow | `IN PROGRESS` (brand color) | `READY FOR PICKUP` (rgba-white 0.75) |
| Eyebrow font | JetBrainsMono 700, 10.5pt, letterSpacing 1.3 | same |
| Title | `Order #A-182` — Fraunces 500 22pt, letterSpacing -0.5 | same but white |
| Meta line | `Placed 2 min ago · 2 items` — 12pt | same, white 85% |
| Top-right pill | `rgba(141,85,36,0.12)` bg + clock icon (T.brand) + `Preparing` | `rgba(255,255,255,0.2)` bg + clock icon (white) + `Now` |
| StatusTimeline | visible (3 steps, idx=1) | hidden (full card is the status signal) |
| Item separator | 1px dashed `T.line`, marginTop 12 | 1px dashed `rgba(255,255,255,0.3)` |
| Line item row | 36×36 CupArt tile on `#f1ebe4` square 8rad, qty × name + mods, JetBrainsMono price | CupArt stroke white, tile `rgba(255,255,255,0.18)` |
| Footer separator | 1px solid `T.line` | 1px solid `rgba(255,255,255,0.25)` |
| Total label | `TOTAL` 10pt caps `T.ink3` | rgba-white 0.7 |
| Total value | JetBrainsMono 700, 18pt, `T.ink` | white |
| CTA | `Track order →` pill — `T.brand` bg, white, 13pt 700, arrow icon | `Show pickup →` pill — white bg, `T.greenDark` text, qr icon |

Container radius 22. Full bleed inside 16px horizontal margin, marginBottom 14.

Line-item rendering uses `<CupArt fill={hashColor(line.name)} />` as the thumb — no product image. The existing `firstItemImageUrl` is ignored here for visual consistency with reference; each line renders a CupArt glyph. `hashColor(id)` already exists in `components/brand/color.ts` (Phase 3) and is the same helper Menu uses — reuse directly. Two-line mod summary from `modifiers` array, grouped the same way `CartItem` does it (`Size: Large 700ml · Sugar: 50%` etc).

### StatusTimeline (`<StatusTimeline />`)

3 circles + 2 connecting bars, horizontally laid out (`flex-direction: row; alignItems: center`).

Steps: `{key: 'OPEN', label: 'Received'}`, `{key: 'PREPARING', label: 'Preparing'}`, `{key: 'READY', label: 'Ready'}`.

Prop: `status: 'OPEN' | 'PREPARING' | 'READY'`. Derivation in `order.tsx`:
- `state === 'OPEN' && fulfillment !== 'PREPARED'` → `'PREPARING'` (newly placed orders visually land on step 2; step 1 `Received` shows done since the order has been accepted)
- `state === 'OPEN' && fulfillment === 'PREPARED'` → `'READY'`

Circle: 22×22, radius 11. Done: bg `T.brand`, 1.6px border `T.brand`, check icon `<Icon name="check" color="#fff" size={12} />` inside. Not done: transparent bg, 1.6px border `T.ink4`.

Bar: flex 1, height 2, radius 1, marginTop -14 (offsets from label row). Done (i+1 done): bg `T.brand`. Not done: bg `T.ink4`.

Label: 10pt, 500/700 (done → 700), color `T.ink3` / `T.ink`, letterSpacing 0.2, marginTop 4.

Reasoning for OPEN: showing OPEN status with only the first circle filled would be a misleading "we haven't started" signal — orders accepted by Square are already in-queue. Step 1 represents "Received", which is always done once the order exists. Step 2 "Preparing" lights up when the kitchen starts (we don't have that signal — treat it as always lit for OPEN non-PREPARED, since in practice orders are picked up by baristas within seconds). If we want stricter semantics later, the API can surface a distinct `IN_PROGRESS` fulfillment state.

### Past order row (`<PastOrderRow />`)

Derived from `reference/src/OrdersScreen.jsx:222-273`.

One-row card: 44×44 CupArt tile (square 10rad, bg `#f1ebe4`) · middle text block · right price/reorder column.

- Container: `T.card` bg, 1px `T.line` border, 14rad, 12×14 padding, marginBottom 10.
- Middle: row 1 (baseline) JetBrainsMono `#A-058` 11pt `T.ink3` + 12.5pt `T.ink3` relative time; row 2 `13.5pt 600 T.ink` with `items.map(qty× name).join(', ')`, single-line ellipsis.
- Right (column, `alignItems: flex-end`): JetBrainsMono 13pt 700 price; `Reorder →` text button 11pt 700 `T.brand` with 10pt arrow, marginTop 4. Tap triggers same Reorder flow as today.
- Whole row is tappable → open `/order-detail` with the same params the current `goToDetail` sends. The Reorder affordance `onPressIn`-stops-propagation so tapping it doesn't also open detail.

### Filter pills (`<OrdersFilterPills />`)

Row of 3 pills, gap 6, padded 16/14.

| State | Background | Border | Text color | Font |
|---|---|---|---|---|
| Active | `T.ink` | `T.ink` | `T.cream` | Inter 600 12.5pt |
| Inactive | transparent | 1px `T.line` | `T.ink2` | same |

Labels: `All` / `Active (N)` / `Past` (no count on Past per reference). Pills have `paddingH 14 / paddingV 7 / radius 999`.

Filter values: `'all' | 'active' | 'past'`, default `'all'`. Selecting `active` hides the past section; selecting `past` hides the active section. `all` shows both.

### Screen header (`<OrderScreenHeader />`)

Left-aligned title/subtitle pair + right-side round icon button (40×40 circle, `rgba(42,30,20,0.05)` bg, clock icon `T.ink` 18pt, inert — visual only).

Inline in `order.tsx` — not a separate component — matches umbrella-style `ScreenTitle` inlined where used.

Title: Fraunces 500, 28pt, letterSpacing -0.5.
Subtitle: Inter 400, 13pt `T.ink3`, marginTop 2.

Subtitle string:
- `active > 0` → `"{N} in progress · {M} past"`
- `active === 0` → `"{M} past order{M === 1 ? '' : 's'}"`
- both zero → no subtitle

Padded `top 56 / horiz 20 / bottom 10`. (Header is inside the ScrollView so pull-to-refresh reveals it; the tabs layout already manages its own header for this screen — see "Stack header" below.)

### Stack header removal

`app/(tabs)/_layout.tsx` renders the tab-screens with `headerShown: true` default. Inline `OrderScreenHeader` duplicates that. Solution: set `headerShown: false` on the `<Tabs.Screen name="order" />` entry. `_layout.tsx` is the ONLY file outside `components/orders/` and `app/(tabs)/order.tsx` to change.

### Empty states

- **No orders at all** (both active and past empty, profile loaded): inside ScrollView, show the reference's centered `receipt` icon in a circle (56×56, 28rad, `rgba(42,30,20,0.05)` bg), Fraunces 500 16pt "No orders yet" `T.ink2`, 12.5pt `T.ink3` subtitle "Your orders will show up here once you place one."
- **Past empty only** (has active, no past): inside Past section, smaller receipt-in-circle, "No past orders yet", "Your past orders will show up here.".
- **Not signed in**: same centered "Sign in to view your orders" + pill button, re-skinned to `T.ink` bg / white text, 13pt 700, 24×10 padding. Button routes to `/account`.
- **Loading (initial)**: `ActivityIndicator size="large" color={T.brand}` centered. No skeleton — the initial load is single-flight and typically < 400ms.

### `components/brand/color.ts` hashColor reuse

Existing `components/brand/color.ts` exports `hashColor(id: string): string` (djb2 mod 5-color palette: peach/cream/star/brand/sage). Reused unchanged for all CupArt line-item thumbs and past-row thumbs. No new helper, no palette change.

### Reorder helper extraction

Today `addItemLine(add, line)` lives at module scope in `components/account/OrderHistory.tsx`. Since Phase 5 needs it in `PastOrderRow` but doesn't want to import from `components/account/`, extract it into a new `components/orders/reorder.ts` exporting two functions:

```ts
export function reorder(
  replaceCart: () => void,
  addItem: (item: CartItemInput) => void,
  order: OrderHistoryItem,
  onNoItems: () => void,
  onDone: () => void,
): void
```

`components/account/OrderHistory.tsx` switches to import from `components/orders/reorder.ts` to keep the two consumers in sync. The old local definition is deleted.

This is the single cross-phase edit to the Account OrderHistory component — motivated by DRY, not redesign. No visual or behavior change to the Account tab.

### Reference number rendering

Reference mocks use `order.no` like `"#A-182"`. Our data has `referenceId` — the alphanumeric Square order reference (can be null). When `referenceId` exists, render `#{referenceId}`. When null (Square hasn't assigned one, edge case), fall back to `#{id.slice(-6).toUpperCase()}`. Both Active and Past rows follow this rule.

### Placed-time formatting

Relative-time helper, new in `components/orders/time.ts`:

```ts
export function placedRelative(createdAt: string | null, now: Date = new Date()): string
```

Rules:
- null → `''`
- < 60s → `'just now'`
- < 60min → `'{N} min ago'`
- same calendar day → `'Today, {h}:{mm} {am/pm}'`
- yesterday → `'Yesterday, {h}:{mm} {am/pm}'`
- same calendar week → `'{Weekday short}, {h}:{mm} {am/pm}'` (e.g. `'Mon, 2:10 pm'`)
- older → `'{Weekday} {D} {Mon} · {h}:{mm} {am/pm}'` (e.g. `'Sat 12 Oct · 2:10 pm'`)

Exact string forms match the reference where given, short-weekday everywhere. Locale `en-AU` via `Intl.DateTimeFormat`.

Active card uses this for "Placed X". Past row uses the same helper for its middle-column time.

## Behavior / data flow (unchanged)

Focus effect / polling / refresh / refreshControl / isUnfinished filter all behave exactly as today. The rewrite is a pure view + derived-state refactor. `useFocusEffect` dependency list and interval logic copy-pasted from the current `order.tsx`.

Reorder: clear-cart → for each `line.variationId`-carrying item loop `addItem` `quantity` times → `router.push('/checkout')`. Same as today.

Deep-link to detail: `router.push({pathname:'/order-detail', params:{orderId,referenceId,createdAt,state,totalCents,itemSummary,lineCount,from}})`. `from: 'orders'` for Orders tab rows.

## File layout

New (Phase 5):
```
app/(tabs)/order.tsx                     (rewrite)
components/orders/ActiveOrderCard.tsx    (new)
components/orders/StatusTimeline.tsx     (new)
components/orders/PastOrderRow.tsx       (new)
components/orders/OrdersFilterPills.tsx  (new)
components/orders/reorder.ts             (new)
components/orders/time.ts                (new)
constants/theme.ts                       (add SHADOW.readyCard preset)
app/(tabs)/_layout.tsx                   (headerShown: false on 'order')
components/account/OrderHistory.tsx      (import reorder from new module only)
```

No files deleted in Phase 5. `OrderHistory.tsx` stays (still used by Account tab); its local `addItemLine` is removed in favor of the shared helper.

## Lines of code budget

Rough: `order.tsx` target ~220 lines (up from 141 since filter + inline header + 3 empty states integrated). `ActiveOrderCard.tsx` ~180. `StatusTimeline.tsx` ~70. `PastOrderRow.tsx` ~130. `OrdersFilterPills.tsx` ~70. `reorder.ts` ~40. `time.ts` ~60. Plus ~6 lines in `_layout.tsx`, ~6 lines in `theme.ts`.

## Animations

- Active card entrance: no entrance animation (list rendering is native fast).
- StatusTimeline state transitions: `transition: all 200ms ease` in reference is a web-only CSS concept. On native: skip — transitions from OPEN→PREPARED→COMPLETED happen on polling intervals and users rarely watch it live. Static visual is sufficient for MVP.
- Filter pill switch: no shared-element / cross-fade. Immediate swap.
- Pull-to-refresh spinner: RN default (`tintColor={T.brand}`).
- READY card "Now" pill: no pulse. Reference had no pulse.

## Success criteria

- Orders tab matches `reference/src/OrdersScreen.jsx` visually on iPhone 14 Pro simulator and a mid-size Android (Pixel 5).
- Active card shows timeline for PREPARING orders, swaps to sage gradient for READY orders.
- Filter pills correctly show/hide sections; counts on `Active (N)` pill update when an order transitions to/from COMPLETED.
- Pull-to-refresh and 10-second polling unchanged in behavior.
- Reorder opens `/checkout` with the same cart state as today.
- `Track order →` (PREPARING) and `Show pickup →` (READY) both navigate to `/order-detail` with identical params.
- `tsc --noEmit` clean.
- No new eslint warnings.
- No `BRAND.*` imports in any file touched by Phase 5.
- No `Ionicons` imports in any file touched by Phase 5.
- Phase 3d Supabase Auth WIP files (`app/(tabs)/account.tsx`, `app/_layout.tsx`, `components/auth/AuthProvider.tsx`, 5 untracked paths + ios/*) remain byte-identical at phase end.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `hashColor` shape drift (palette not dark enough for CupArt contrast) | Palette is brand tokens (peach/cream/star/brand/sage); CupArt renders stroke over fill — contrast sufficient per existing Menu usage. If problem surfaces, tweak is isolated to `color.ts`. |
| `SHADOW.readyCard` preset drift vs other shadow presets | Values specified inline in theme.ts; picked to match Phase 4's `SHADOW.miniCart` sage variant (`#3C644C`). Spec reviewer re-checks byte values against this spec. |
| Reorder helper extraction breaks Account tab | Change is mechanical — delete local fn, import from new module. Account tab is not touched otherwise. A smoke test in the plan confirms reorder still works on Account tab. |
| Placed-time helper timezone edge case (Australia/Brisbane vs device) | Use device-local `toLocaleDateString('en-AU', ...)` — consistent with today's `formatDateTime`. No timezone conversion — displayed time matches order creation as recorded by Square. |
| 3-step timeline interpretation of OPEN-no-fulfillment as `PREPARING` | Explicitly justified in StatusTimeline section — safer than showing an "unstarted" indicator for accepted orders. |
| Pickup QR feature parity with reference | Out of scope, noted in Non-goals. `Show pickup →` still provides a back-pocket path via `/order-detail` which has `MemberQrCard`. |

## Open items

None. All decisions locked.
