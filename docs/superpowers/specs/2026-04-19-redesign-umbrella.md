# Mandy's Bubble Tea App — Redesign Umbrella Spec

Date: 2026-04-19
Design handoff source: `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/` (HTML/React prototype, iPhone 14 Pro 402×874pt, high fidelity).

## Goal

Re-skin the existing Expo/React Native app to match the new design handoff, keeping all current backend wiring intact (Supabase Auth, Square SDK / Catalog / Orders / Payment, loyalty, welcome discount 2-drinks rollover, device OTP). This is a **visual + interaction overhaul**, not a rewrite.

## Non-goals

- No backend / API changes. Web `~/Github/mandys_bubble_tea` endpoints stay as-is.
- No multi-store. Design shows 3 stores (Southport / Robina / Burleigh); only Southport exists in Square. Store selector in checkout: single-store chip, no radio list.
- No notification system. Design shows a bell icon on Home; it renders but is inert (no notifications tab, no push registration beyond what already exists).
- No NEW / BESTSELLER tag badges on product rows. Square catalog has no such field; will skip until a catalog metadata plan exists.
- No `react-native-maps`. "Your store" section uses a static map image.
- Login screen redesign is out of scope for this umbrella. Gated behind Phase 3d (Supabase Auth migration) commit + TestFlight verification. Separate spec will follow.

## In-scope new features (beyond pure re-skin)

Confirmed during brainstorming — all have existing data / API support:

- Home **Order Again** rail — repopulate past orders' first line-item as quick-add cards.
- Checkout **Notes for barista** textarea — wire to Square Order `note` field.
- Checkout **OrderPlaced success overlay** — replace current `router.replace('/order-confirmation')` with an in-place overlay with pop animation, then navigate.
- Product Detail **restructured Size / Sugar / Ice / Toppings sections** — current modifier UI adapted to the new pill/checkbox patterns.
- Home **"Your store" section** — single-store simplified version (Southport address + hours + static map thumbnail + tap to navigate).

## Kept as-is (functional carry-over)

- Cart state (Zustand `cart.ts`)
- `useOrdersStore` + single-flight polling
- Welcome discount 2-drinks rollover (banner + card + promotions)
- Loyalty stars / redeem free drink
- Payment SDK (Apple Pay / Google Pay / Card Entry)
- Supabase Auth, phone OTP, Apple/Google SSO, device-token legacy path
- READY vibration hook
- All Square catalog / order / payment API plumbing

## Cross-cutting design decisions

### Design tokens

New `constants/theme.ts` exports `T` (color), `FONT`, `RADIUS`, `SHADOW`, `SPACING`, `TYPE` (named presets). **Coexists** with the existing `BRAND` const — no bulk rename. Each screen migrates `BRAND.xxx` → `T.xxx` when that screen's visual phase lands. `BRAND` is removed only after the last screen migrates.

### Fonts

Three Google Fonts families via `@expo-google-fonts/fraunces`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`. `useFonts()` in `app/_layout.tsx` gates `SplashScreen.hideAsync()`. Weights loaded: Fraunces 400/500/600/700, Inter 400/500/600/700, JetBrainsMono 400/500. Expected bundle increase ~1–2 MB.

Fallbacks on load failure: system `serif` for Fraunces, system default for Inter, `Menlo` for JetBrains Mono.

### Asset strategy

- **Product images**: existing `assets/images/*.webp` + Square catalog `imageUrl` kept. No re-export.
- **Cup fallback**: `<CupArt fill={hashedColor} />` when a product has no `imageUrl`, and for small decorative placements (Home featured card backdrop when desired).
- **Category banners**: existing `assets/images/categories/*.webp` kept — Menu two-column layout continues to use them.
- **Icons**: ported SVG via `react-native-svg` (already a dep) into a `<Icon name="bag" />` component. No third-party icon lib.
- **Southport static map**: one-time fetch from Mapbox static-image API, cached locally as `assets/images/southport-map.webp`. No runtime map SDK.

### New file structure (additive only)

```
components/brand/
  CupArt.tsx
  Icon.tsx
  StarDots.tsx
constants/
  theme.ts
```

Existing `components/`, `app/`, `store/` folder layout unchanged.

## Phased breakdown

Each phase is its own spec + plan + PR. Phases 2–7 all depend on Phase 1. Order inside Phases 2–7 is flexible; below is the default sequence with Home as the vertical-slice validator.

| # | Phase | Scope | Depends on |
|---|---|---|---|
| 1 | **Foundation** | Tokens, fonts, `CupArt` / `Icon` / `StarDots`, global bg switch | — |
| 2 | **Home** (vertical slice) | Greeting header, LoyaltyCard redo, Order Again rail, Featured hero (existing carousel re-skinned), Your store section | 1 |
| 3 | **Menu + Product Detail sheet** | Two-column refinement, ProductDetailSheet restructure (Size/Sugar/Ice/Toppings) | 1 |
| 4 | **Tab bar 4-tab + Mini-cart pill + Cart sheet** | Remove Cart tab, global mini-cart pill, Cart bottom-sheet modal | 1, 2, 3 |
| 5 | **My Orders** | Active order 4-step vertical progress, Past orders list | 1 |
| 6 | **Account** | Avatar header, stars activity ledger, settings list | 1 |
| 7 | **Checkout + Success overlay** | Full-screen slide-in, stacked CardBlocks, Notes for barista, OrderPlaced overlay, Place-order CTA | 1 |
| post | Login redesign | Re-skin `app/login.tsx` keeping Apple/Google/Phone OTP paths | Phase 3d commit + TestFlight |

Validation after each phase: real-device iOS + Android walk-through, visual compare against `reference/src/<Screen>.jsx`, then commit + optional EAS preview build.

## Success criteria (umbrella)

- All 7 phases' `reference/` screens visually match on iPhone 14 Pro and a mid-size Android.
- Zero regression in existing behaviors: order placement (Apple Pay / Google Pay / Card), OTP, loyalty earn/redeem, welcome discount grant/consume, past-order Reorder.
- Bundle size increase ≤ 3 MB after Foundation (fonts).
- No new `tsc` errors at any phase boundary.
- No new eslint warnings beyond the current baseline.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Font loading delays cold start noticeably | Measure on low-end Android; if > 400ms added to splash, fall back to Inter-only + keep Fraunces for headlines (variable woff2). |
| Tab-bar 5→4 breaks deep links (`/(tabs)/cart`) | Phase 4 must add a redirect from the legacy route to open the cart sheet. |
| `BRAND` → `T` parallel migration drift | Lint rule / grep check at each phase PR: no new `BRAND` import added; count of `BRAND` imports strictly decreases phase-over-phase. |
| Product images don't fit new layout aspect ratios | Host images are already square / portrait; new layouts reserve `<Image contentFit="cover">` containers, not `aspectRatio`-driven. |
| Uncommitted Phase 3d WIP (auth / login) overlaps with this work | All Phase 1–7 work stays outside `app/login.tsx`, `components/auth/AuthProvider.tsx`, `components/auth/AuthGate.tsx`, `components/legal/`, `lib/legal.ts`, `app/(tabs)/account.tsx` (account tab is Phase 6 — picked up only after Phase 3d commits). |

## Open items (answered during brainstorm — recorded for traceability)

- Tab bar structure → **4 tabs**, Cart becomes modal sheet.
- Product imagery → **real webp kept**, CupArt fallback only.
- Login scope → **deferred**, Phase 3d first.
- New features → **B**: visual + data-backed features only (Order Again / Notes / Success overlay / Product Detail restructure / single-store Your store). Skipped: multi-store, notifications, NEW/BESTSELLER tags.
- Roll-out order → **A**: Foundation → Home vertical slice → batch.
