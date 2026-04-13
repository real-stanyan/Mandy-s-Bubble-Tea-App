# Mandy's Bubble Tea App — Claude Instructions

## Project Overview

A React Native (Expo) mobile app for Mandy's Bubble Tea, the native app counterpart to the Next.js web site. Shares the same Square backend (Catalog, Orders, Payments, Loyalty, Customers).

## Tech Stack

- **Framework**: Expo SDK 54 + Expo Router 6 (file-based routing)
- **Language**: TypeScript
- **UI**: React Native core components + `@expo/vector-icons`
- **Navigation**: Expo Router (tabs layout via `@react-navigation/bottom-tabs`)
- **Animations**: `react-native-reanimated` 4.x + `react-native-gesture-handler`
- **Images**: `expo-image`
- **State**: TBD — Zustand recommended (same as web project)
- **Backend**: Square API via a shared API layer (see `square-api.md`)

## Brand

- **Primary color**: `#C43A10` (brick red)
- **Accent color**: `#F5E6C8` (cream)
- **Font**: System default (San Francisco on iOS, Roboto on Android)
- **Tone**: Friendly, casual, bubble tea shop vibe

## Module Docs

Read these before working on each area:

- `.claude/square-api.md` — Square client setup, BigInt handling, error handling
- `.claude/catalog.md` — Menu, categories, item cards
- `.claude/cart-checkout.md` — Cart state, checkout flow, order creation
- `.claude/payment.md` — In-app payment (Apple Pay / Google Pay via Square Mobile Payments SDK)
- `.claude/loyalty.md` — Stars system, loyalty card, progress bar
- `.claude/account.md` — User account, phone-based lookup
- `.claude/deployment.md` — EAS Build, app store submission, OTA updates

## Key Rules

- Always use `serializeSquareResponse()` when handling Square API data — BigInt breaks JSON
- API calls go through a `lib/api.ts` layer that talks to the **existing Next.js API routes** (or a dedicated API server) — the app does NOT run server-side code
- All Square money amounts are in **cents as number** (BigInt converted server-side)
- Use `EXPO_PUBLIC_` prefix for env vars needed in the app (replaces `NEXT_PUBLIC_`)
- StyleSheet or NativeWind for styling — no web-only CSS
- File-based routing via Expo Router in `app/` directory
- Components in `components/[feature]/`

## Project Structure

```
app/
├── _layout.tsx              # Root layout (fonts, splash screen)
├── (tabs)/
│   ├── _layout.tsx          # Tab bar config
│   ├── index.tsx            # Home
│   ├── menu.tsx             # Menu entry (or nested menu/)
│   └── account.tsx          # Loyalty + account
├── menu/
│   └── [category].tsx       # Items in category
├── cart.tsx                 # Cart screen
├── checkout.tsx             # Checkout + payment
├── order-confirmation.tsx   # Post-payment
└── modal.tsx                # Reusable modal route
components/
├── menu/
├── cart/
├── checkout/
├── account/
└── ui/
lib/
├── api.ts                   # Fetch wrapper to backend API
├── constants.ts             # Brand, loyalty config
└── utils.ts                 # formatPrice, formatAUPhone
store/
└── cart.ts                  # Zustand cart (persisted to AsyncStorage)
types/
└── square.ts
```

## Differences from Web Version

| Area | Web (Next.js) | App (Expo) |
|------|--------------|------------|
| Routing | Next.js App Router | Expo Router (file-based) |
| Styling | Tailwind CSS + shadcn/ui | StyleSheet / NativeWind |
| State persistence | localStorage | AsyncStorage |
| Session persistence | sessionStorage | SecureStore or AsyncStorage |
| Payments | Square Web Payments SDK | Square Mobile Payments SDK or In-App Payments SDK |
| Server code | API routes in `src/app/api/` | No server code — calls external API |
| Images | `<Image>` (next/image) | `<Image>` (expo-image) |
| Environment vars | `NEXT_PUBLIC_` | `EXPO_PUBLIC_` |

## Loyalty System

- **Unit**: Stars
- **Rule**: 1 drink = 1 star (across all 7 categories)
- **Reward**: 9 stars = Free Drink of Your Choice
- **Categories**: MILKY, FRUITY, SPECIAL MIX, FRESH BREW, FRUITY BLACK TEA, FROZEN, CHEESE CREAM
- Configured in Square Dashboard — no code changes needed for rules

## Business Info

- **Name**: Mandy's Bubble Tea
- **Address**: 34 Davenport St, Southport QLD 4215
- **Phone**: 0404 978 238
- **Domain**: mandybubbletea.com
- **Timezone**: Australia/Brisbane
- **Currency**: AUD

## System

Cross-project tracking lives in `~/system/`. Check `~/system/DEV_QUEUE.md` for priorities if needed.
