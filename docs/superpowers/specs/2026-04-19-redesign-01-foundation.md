# Redesign Phase 1 — Foundation

Date: 2026-04-19
Parent: `2026-04-19-redesign-umbrella.md`
Reference: `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/shared.jsx`

## Goal

Build the shared primitives every later phase depends on: design tokens, fonts, brand SVG components. No user-facing screen changes except the app background color and splash-font gate. When this phase ships, the app still looks like today (old layouts, old BRAND colors) except for `bg` and token-consuming ad-hoc test points. Phase 2 (Home) is the first phase that actually applies the tokens to a real screen.

## Deliverables

### 1. `constants/theme.ts`

Single new file, default-exports nothing, named-exports:

```ts
export const T = {
  bg:        '#F2E8DF',
  bg2:       '#E8DAC6',
  paper:     '#FFF9F0',
  card:      '#FFFFFF',
  ink:       '#2A1E14',
  ink2:      '#5A4330',
  ink3:      'rgba(42,30,20,0.55)',
  ink4:      'rgba(42,30,20,0.28)',
  line:      'rgba(42,30,20,0.10)',
  brand:     '#8D5524',
  brandDark: '#6B3E15',
  sage:      '#A2AD91',
  peach:     '#FFB380',
  cream:     '#FFF3DE',
  star:      '#F2B64A',
  green:     '#3CA96E',
  greenDark: '#2E7F52',
} as const;

export const FONT = {
  serif: 'Fraunces',           // Fraunces_400Regular / _500Medium / _600SemiBold / _700Bold
  sans: 'Inter',               // Inter_400Regular / _500Medium / _600SemiBold / _700Bold
  mono: 'JetBrainsMono',       // JetBrainsMono_400Regular / _500Medium
} as const;

export const RADIUS = {
  pill: 999,
  card: 20,
  tile: 12,
  small: 10,
  sheetTop: 24,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// iOS uses shadow*, Android uses elevation. Both are emitted so consumers can spread.
export const SHADOW = {
  card: {
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  miniCart: {
    shadowColor: '#6B3E15',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryCta: {
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  successBubble: {
    shadowColor: '#3C644C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 12,
  },
} as const;

// Named text presets. Consumers apply the whole object as a style.
export const TYPE = {
  screenTitleSm:  { fontFamily: 'Fraunces_500Medium', fontSize: 22, letterSpacing: -0.5 },
  screenTitleLg:  { fontFamily: 'Fraunces_500Medium', fontSize: 28, letterSpacing: -0.5 },
  cardTitle:      { fontFamily: 'Fraunces_500Medium', fontSize: 17, letterSpacing: -0.3 },
  productName:    { fontFamily: 'Fraunces_500Medium', fontSize: 26 },
  productNameSm:  { fontFamily: 'Fraunces_500Medium', fontSize: 24 },
  body:           { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  bodyStrong:     { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  label:          { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, lineHeight: 18 },
  priceLg:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22 },
  priceMd:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18 },
  priceSm:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13 },
  eyebrow:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10.5, letterSpacing: 1.3, textTransform: 'uppercase' as const },
} as const;
```

Weights not in the loaded Google Fonts set fall back silently to the closest available (Expo's `useFonts` resolves this).

### 2. Font loading

Install:
```
npx expo install @expo-google-fonts/fraunces @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono expo-font expo-splash-screen
```

`expo-font` and `expo-splash-screen` are likely already present — verify in `package.json` and skip if so.

In `app/_layout.tsx`:

```tsx
import * as SplashScreen from 'expo-splash-screen';
import { useFonts,
  Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync();

// inside RootLayout component:
const [fontsLoaded] = useFonts({
  Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold,
});
useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
if (!fontsLoaded) return null;
```

If `SplashScreen.preventAutoHideAsync()` is already called elsewhere (e.g. the Supabase Auth migration), do not double-call. Gate splash hide on both `fontsLoaded` AND existing readiness checks (auth hydrated).

Note: the README handoff lists JetBrains Mono weights 400/500, but the type scale also specifies prices at weight 700. Loading 400+500+700 matches the scale; `TYPE.price*` and `TYPE.eyebrow` use `JetBrainsMono_700Bold`.

### 3. `components/brand/CupArt.tsx`

Port from `reference/src/shared.jsx` `CupArt`. Uses `react-native-svg` (already a dep).

```tsx
type Props = { fill?: string; stroke?: string; size?: number; };
// default: fill=T.brand, stroke=T.ink, size=80
```

Renders tapioca cup: trapezoid body with fill, rounded lid ellipse, straw diagonal, 4–5 pearl circles inside bottom. Exact SVG path copied from reference.

### 4. `components/brand/Icon.tsx`

Export as `<Icon name="bag" color={T.ink} size={20} />`.

Port every icon in `reference/src/shared.jsx`'s `Icon` object:

```
bag, bell, pin, star, arrow, arrowL, plus, check, search, close,
home, cafe, receipt, user, qr, clock
```

Each icon keeps its intrinsic viewBox from the reference. Props forwarded to inner `<Svg>` (color maps to `stroke` / `fill` per each icon's reference impl).

### 5. `components/brand/StarDots.tsx`

```tsx
type Props = { value: number; total?: number; size?: number; gap?: number; filledColor?: string; emptyColor?: string; };
// default total=9, size=12, gap=6, filledColor=T.star, emptyColor=T.ink4
```

Renders `total` circles horizontally; first `value` filled with `filledColor`, rest `emptyColor`. Used by Home LoyaltyCard and Checkout Rewards.

### 6. Global background

`app/_layout.tsx` root view `backgroundColor: T.bg`. `app/(tabs)/_layout.tsx` tab bar screen options `sceneStyle.backgroundColor: T.bg`. `SafeAreaView` wrappers in existing screens are not touched at this phase — they still show `BRAND.background` until their phase lands. Side effect: screens that were relying on tab bar container showing `#FFF9F0` may flash `T.bg` briefly on navigation; acceptable.

### 7. Temporary showcase (deleted on phase exit)

New route `app/dev/theme-showcase.tsx` (gated behind `__DEV__` only — do not export from any menu, accessible via `router.push('/dev/theme-showcase')` or deep link during review):

- Grid of 16 color swatches (name + hex).
- Type scale samples: each `TYPE.*` preset rendered with its name and a Lorem line.
- All Icons rendered in a row with `T.ink` and `T.brand` colors.
- `<CupArt>` at sizes 40 / 80 / 160 with three `fill` colors.
- `<StarDots value={5} />` and `<StarDots value={8} />`.

This file is deleted as part of Phase 2's first task.

## Out of scope for this phase

- Any change to `app/(tabs)/index.tsx`, `menu.tsx`, `cart.tsx`, `order.tsx`, `account.tsx` layouts or styles.
- Any change to `components/auth/*` (owned by Phase 3d migration).
- Removal of `BRAND` const from `constants/index.ts`.
- Tab bar structural change (stays 5 tabs until Phase 4).

## Validation

1. `tsc --noEmit` clean.
2. `npm run ios` and `npm run android`: app cold-starts, splash screen gates on font load, hides once Fraunces/Inter/JetBrainsMono are all registered. No crash on Android's font fallback path.
3. `/dev/theme-showcase` reachable in dev build; all 16 swatches, all type presets, all icons, CupArt, and StarDots render as expected.
4. Existing screens (Home, Menu, Cart, Order, Account) still look the same as before the phase except app bg now `#F2E8DF` (was `#FFF9F0`).
5. Bundle-size check: compare `npx expo export` (or EAS build size) before/after; delta ≤ 2 MB.

## Success criteria

- `T`, `FONT`, `RADIUS`, `SPACING`, `SHADOW`, `TYPE` exported from `constants/theme.ts` and importable anywhere.
- `<CupArt />`, `<Icon />`, `<StarDots />` render in the dev showcase on both platforms.
- Splash gate waits for fonts; no FOUT (flash of unstyled text) seen in normal cold start.
- No new eslint errors. No `BRAND` usages removed (strictly additive).

## Files touched (estimate)

- `constants/theme.ts` (new)
- `components/brand/CupArt.tsx` (new)
- `components/brand/Icon.tsx` (new)
- `components/brand/StarDots.tsx` (new)
- `app/_layout.tsx` (useFonts + splash gate + root bg)
- `app/(tabs)/_layout.tsx` (tab bar scene bg)
- `app/dev/theme-showcase.tsx` (new, deleted next phase)
- `package.json` / `package-lock.json` (three `@expo-google-fonts/*` packages)
