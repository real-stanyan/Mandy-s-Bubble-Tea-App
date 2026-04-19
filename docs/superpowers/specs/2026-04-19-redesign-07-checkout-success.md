# Redesign Phase 7 — Checkout + Success Overlay

Date: 2026-04-19
Phase umbrella: `docs/superpowers/specs/2026-04-19-redesign-umbrella.md`
Design reference: `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/CheckoutScreen.jsx`
Target screen: `app/checkout.tsx`

## Goal

Re-skin the Checkout screen to the Phase 1 design system (`T` / `FONT` / `TYPE` / `SHADOW` / `RADIUS` tokens, `<Icon>`, `<CupArt>`), introduce the stacked `CardBlock` visual pattern, add a `Notes for barista` section wired to Square Order `note`, and replace the navigate-to-`/order-confirmation` success step with an in-place `OrderPlaced` overlay that animates in, then routes to the My Orders tab when dismissed.

## Non-goals

- **No backend / API changes.** `/api/orders` and `/api/payment` wire unchanged (`note` field already supported on the backend).
- **No multi-store selector.** Southport is the only real store; the Pickup store card is display-only (no radio list, no edit affordance).
- **No pickup-time scheduler.** Square App integration doesn't schedule ahead; the pickup time card shows a read-only "ASAP · ~6 min" chip only.
- **No gift-card option.** Out of scope for the app; payment methods stay Apple Pay / Google Pay / Card.
- **No changes to `order-confirmation`, `order-detail`, `promotions`, or `(tabs)` screens.** This phase only touches the Checkout surface.
- **No Phase 3d WIP file edits.** `app/_layout.tsx`, `app/(tabs)/account.tsx`, `components/auth/AuthProvider.tsx`, the 5 untracked Phase 3d paths (`app/login.tsx`, `components/auth/AuthGate.tsx`, `components/legal/**`, `lib/legal.ts`, `assets/images/login-banner.webp`), and the 5 modified iOS project files must remain byte-identical through every commit.

## Design decisions (recommended options pre-authorized)

| Decision | Choice | Rationale |
|---|---|---|
| Full-screen slide-in | Override `Stack.Screen options={{headerShown:false}}` *from inside* `app/checkout.tsx` (expo-router supports inline per-screen options) | Avoids touching `app/_layout.tsx` which is Phase 3d WIP. Native stack slide animation already matches reference. |
| Sticky inline header | Custom `<CheckoutHeader>` inside `checkout.tsx` with back chip + `CHECKOUT` eyebrow + "Review & pay" Fraunces title + `A$X.XX` mono total | Matches reference |
| CardBlock pattern | New shared component `components/checkout/CardBlock.tsx` with `eyebrow` / `title` / `right` / `onEdit` / `children` props; `T.card` bg + `T.line` border + `RADIUS.card` | Reusable across all sections; 1:1 with reference |
| Pickup store card | Display-only `Mandy's — Southport` + address + "Open now" pill + wait time; **no** edit, **no** list | Umbrella non-goal: no multi-store |
| Pickup time card | Display-only `ASAP · ~6 min`; no time slot scroller | Square app flow doesn't schedule ahead |
| Order items card | Re-render cart items with 40×40 CupArt thumbs (existing `imageUrl` still preferred; fallback to `<CupArt fill={hashColor(variationId)}>`); group modifiers by `listName` for subtitle | Matches Phase 5 past-row + reference |
| Rewards / loyalty card | Reuse existing `canRedeem` / `useReward` logic; new CardBlock UI replaces `<LoyaltyCard>` + `<RedeemToggle>` wrapper inside checkout only (LoyaltyCard itself untouched, still used in Home/Account) | Keeps existing behavior intact; strictly a visual shell swap in this screen |
| Welcome discount | Inline in Rewards card when active (sub-text: `"N drink off — saves A$X.XX"`); otherwise Rewards card shows star progress; mutual exclusion with loyalty reward as today | Preserves 2-drinks rollover semantics (already wired via `computeWelcomeDiscount` helper in `checkout.tsx`) |
| Payment section | CardBlock with `onEdit` expand/collapse → radio list of available methods (`apple` / `google` / `card`); row icons from `<Icon>` (Apple wallet glyph = `Icon.name="apple"` new OR existing `logo-apple`; see icon-addition note) | Matches reference radio UX; keeps SDK wiring identical |
| Notes for barista | New CardBlock with RN `<TextInput multiline>` 2 rows, `T.bg` input bg, Inter 13 | Placeholder `"e.g. less ice, extra pearls, gift wrap"` |
| Summary card | Standalone `T.paper` CardBlock (not via `CardBlock` component — different styling, eyebrow-less) matching reference `SummarySection`: subtotal / (rewards discount if any) / (welcome discount if any) / dashed divider / big Total mono | Keeps mono numeric style |
| Place-order CTA | Sticky bottom bar: full-width pill, `T.ink` bg + `T.cream` text + `SHADOW.primaryCta`; left side = eyebrow ("PAY WITH APPLE PAY") + "Place order" title; right = `T.brand` inner pill with `A$X.XX` mono total | Matches reference |
| Success overlay | New component `components/checkout/OrderPlaced.tsx` renders as absolute-positioned overlay on top of checkout body; spring-scale check icon (Reanimated) + eyebrow + "You're all set" + `#ref-id` pickup line + two-column info card (Total charged / Stars earned) + "Track my order →" ink CTA | Replaces `router.replace('/order-confirmation')` |
| Success → nav | `onClose` CTA = `router.replace('/(tabs)/order')` (My Orders tab shows Phase 5's ActiveOrderCard with live status). Keep `order-confirmation` route mounted for external deep-link backward compat; simply no longer referenced from checkout | Phase 5's polling + READY vibration already covers tracking UX |
| Icon additions | Expand `components/brand/Icon.tsx` with `apple` / `google` / `card` / `wallet` names (monochrome SVG paths); replace Ionicons `logo-apple` / `logo-google` / `card-outline` references in checkout | Keeps Ionicons out of Phase 7 scope |

## In-scope file changes

**New files (3):**
- `components/checkout/CardBlock.tsx` — shared eyebrow / title / right / onEdit / children container
- `components/checkout/OrderPlaced.tsx` — success overlay with spring check animation + two-column info card + "Track my order" CTA
- `components/checkout/CheckoutHeader.tsx` *(optional split)* — sticky top header; can inline if tight

**Modified files (4):**
- `app/checkout.tsx` — rewrite using new CardBlock sections + sticky CTA + OrderPlaced overlay state; keep all existing payment / auth / loyalty / welcome-discount wiring
- `components/brand/Icon.tsx` — add `apple` / `google` / `card` / `wallet` icons
- `hooks/use-create-order.ts` — extend `CreateOrderParams` with optional `note?: string`; pass through to `/api/orders` POST body
- `components/checkout/OrderSummary.tsx` — **delete or deprecate** (replaced inline by Order Items CardBlock + Summary block). Keep file if Account or other screens use it; otherwise remove. (Grep check: current usage in `app/checkout.tsx:236,263` only.)

**Not touched (explicit allowlist):**
- `app/_layout.tsx` *(Phase 3d WIP)*
- `app/(tabs)/account.tsx` *(Phase 3d WIP)*
- `components/auth/AuthProvider.tsx` *(Phase 3d WIP)*
- `components/auth/AuthGate.tsx`, `app/login.tsx`, `components/legal/**`, `lib/legal.ts`, `assets/images/login-banner.webp` *(Phase 3d WIP untracked)*
- `ios/**` *(Phase 3d WIP)*
- `app/order-confirmation.tsx` *(left intact for deep-link compat; no longer the post-checkout destination but the route stays mounted)*
- `app/order-detail.tsx`, `app/(tabs)/*.tsx`, `components/account/**`, `components/orders/**`, `components/home/**`, `components/menu/**`, `components/cart/**`, `constants/theme.ts`, `store/**`, `hooks/use-payment.ts`, `lib/square-payment.ts`

## Component contracts

### `CardBlock`

```tsx
type CardBlockProps = {
  eyebrow?: string;       // JetBrainsMono eyebrow (uppercase, T.brand)
  title: string;          // Fraunces 17 semi
  right?: React.ReactNode; // right-edge slot (e.g. pill, toggle)
  onEdit?: () => void;    // if provided, renders Edit chip right
  children?: React.ReactNode;
};
```

### `OrderPlaced`

```tsx
type OrderPlacedProps = {
  pickupNumber: string;    // e.g. "#OL804"
  total: number;           // cents
  starsEarned: number;     // 0 if reward redeemed or skipAccrual
  storeName: string;       // "Southport"
  onTrack: () => void;     // CTA, expected to route to /(tabs)/order
};
```

- Mounts as `<View style={StyleSheet.absoluteFill, zIndex: 80}>` inside checkout root.
- `useSharedValue<number>` for check-icon scale: animate `0.3 → 1.1 → 1` spring on mount.
- `Haptics.notificationAsync(Success)` fires on mount.

### `useCreateOrder` extension

```tsx
interface CreateOrderParams {
  items: CartItem[];
  applyWelcomeDiscount?: boolean;
  note?: string; // NEW — forwarded to /api/orders body.note
}
```

Body JSON adds `note: note?.trim() || undefined`. Backend already prepends `pickupNumber` + " — " + note (see web `src/app/api/orders/route.ts:221`).

### `Icon.tsx` additions

Add 4 names to the switch: `apple` (Apple logo glyph), `google` (G glyph), `card` (credit-card rounded rect + stripe), `wallet` (generic wallet). Keep existing 21 intact; no rename.

## Data / behavior invariants

- **Auth gate unchanged:** `!profile` branch still renders `<OrderSummary>` + `<SignInCard>` — restyled only, not rewired.
- **Payment methods:** `apple`/`google`/`card` availability detection via existing `canUseApplePay` / `canUseGooglePay` in `useEffect`; default = the first available wallet, fallback to `card`.
- **Loyalty reward mutual exclusion:** `useReward && canRedeem` wins over welcome discount, same computeWelcomeDiscount logic.
- **Free order path:** `amountCents <= 0` still skips SDK tokenization; `pay({ sourceId: undefined })` unchanged.
- **Cart clear + refreshAuth:** runs before overlay appears, same ordering as today.
- **`lastOrder:items` AsyncStorage:** still written for `order-confirmation` deep-link fallback compat.
- **Reference number on overlay:** use `createdOrder.referenceId` when present, otherwise fallback `#` + orderId last-3 digits (same rule as today's `order-confirmation` pickup number).
- **Stars earned for overlay:** `loyaltyAccrued ? items.reduce((s,i)=>s+i.quantity, 0) : 0`.

## Success overlay → navigation

Current flow:
```
pay() resolves → clearCart() → refreshAuth() → router.replace('/order-confirmation', { orderId, pickupNumber, loyaltyAccrued, total })
```

New flow:
```
pay() resolves → clearCart() → refreshAuth() → setPlaced({ pickupNumber, total, starsEarned, storeName: 'Southport' })
  → overlay animates in → user taps "Track my order →" → router.replace('/(tabs)/order')
```

`order-confirmation` screen stays mounted in `app/_layout.tsx` (unchanged) for external deep-link paths (push notifications etc.), but the checkout flow no longer navigates there. Nothing in `app/_layout.tsx` needs editing.

## Phase 3d WIP protection

The Phase 4 / Phase 5 discipline continues:

- Task 0 baseline snapshots `git status --porcelain` of the 13 Phase 3d paths for post-phase diff comparison.
- No Phase 7 task touches those paths.
- If any implementer proposes editing one, the controller rejects and re-scopes the task.
- Final verification (Task N) greps `git status` again and confirms byte-identity.

The 13 Phase 3d paths (as of 2026-04-19):
```
modified:   app/(tabs)/account.tsx
modified:   app/_layout.tsx
modified:   components/auth/AuthProvider.tsx
modified:   ios/Podfile.lock
modified:   ios/mandysbubbleteaapp.xcodeproj/project.pbxproj
modified:   ios/mandysbubbleteaapp/Info.plist
modified:   ios/mandysbubbleteaapp/PrivacyInfo.xcprivacy
modified:   ios/mandysbubbleteaapp/mandysbubbleteaapp.entitlements
untracked:  app/login.tsx
untracked:  assets/images/login-banner.webp
untracked:  components/auth/AuthGate.tsx
untracked:  components/legal/
untracked:  lib/legal.ts
```

## Success criteria

- `tsc --noEmit` exit 0.
- Eslint baseline: same `1 error + 4 warnings` as Task 0 baseline; Phase 7 contributes 0 new warnings or errors.
- Phase 7 files contain no `BRAND` or `Ionicons` imports.
- `components/checkout/OrderSummary.tsx` either deleted (preferred — only `app/checkout.tsx` uses it) or retained with zero new callers.
- Phase 3d 13 WIP paths byte-identical vs Task 0 baseline.
- Checkout screen visually matches reference `CheckoutScreen.jsx` (stacked CardBlocks + sticky CTA + OrderPlaced overlay) on iPhone 14 Pro.
- Existing behaviors regression-clean: Apple Pay end-to-end / Google Pay end-to-end / Card Entry end-to-end / free-order (reward) / welcome-discount single + multi-drink / auth gate `SignInCard` path.
- Android manual check: sticky CTA shadow (elevation fallback), dashed summary divider, overlay spring animation, `Notes` textarea behavior with soft keyboard (ScrollView `keyboardShouldPersistTaps="handled"` preserved).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `Stack.Screen options={{headerShown:false}}` inline override not honored in some expo-router 6 versions | Verify with a single-task spike: render `<Stack.Screen options={{headerShown:false}}/>` inside `checkout.tsx`, open screen, confirm no native header. If it fails, fall back to `useNavigation().setOptions({headerShown:false})` inside a `useLayoutEffect`. |
| `note` field not round-tripping — user types it, it disappears on server | Grep-verified: `src/app/api/orders/route.ts:36 note?:string` + `:221 note: [pickupNumber, body.note].filter(Boolean).join(" — ")`. Confirmed accepted. |
| Reanimated spring on overlay interferes with React Native Modal lifecycle | Overlay is not a `Modal` — it's a sibling `<View>` with `position:absolute` + `zIndex:80`. Lifecycle is pure mount/unmount. No Modal API touched. |
| `OrderSummary` deletion breaks something else | Grep `OrderSummary` across entire app before deleting. Current grep shows only `app/checkout.tsx` imports it. If grep changes, retain file. |
| CardBlock component lives in `components/checkout/` but might be useful elsewhere | Scoped to checkout for now. If reused later, move to `components/brand/`. YAGNI. |
| Apple/Google icon glyph in `Icon.tsx` looks off | Port the minimal paths from reference `shared.jsx` icon set (Apple pay wallet path already in reference at line 369). Side-by-side with iOS native Apple Pay button glyph for approximation; no branding-review blocker. |

## Out-of-scope / follow-ups

- Phase 6 Account (blocked on Phase 3d commit).
- Login redesign (blocked on Phase 3d commit + TestFlight).
- Phase 2 Home (never started; separate spec/plan).
- Future "Schedule pickup" feature — would need Square Ordering API extension; tracked separately.
- Deleting `app/order-confirmation.tsx` once all deep-link sources are gone (tracked in separate cleanup).
