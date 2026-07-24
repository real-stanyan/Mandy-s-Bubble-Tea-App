# Architecture — project structure & web-vs-app differences

(Migrated from the old `.claude/CLAUDE.md`; rules now live in `/AGENTS.md`.)

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
