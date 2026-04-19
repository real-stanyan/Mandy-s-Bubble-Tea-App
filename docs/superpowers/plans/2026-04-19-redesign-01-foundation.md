# Redesign Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared design-system primitives (tokens, fonts, SVG components) the whole redesign will consume, without changing any user-facing screen layout.

**Architecture:** A pure-additive phase. New files under `constants/theme.ts`, `components/brand/*`, one dev-only route at `app/dev/theme-showcase.tsx`, plus two minimal edits to `app/_layout.tsx` (font gate + root theme bg). The existing `BRAND` constant stays — later screen-level phases migrate references one file at a time.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript 5.9, `expo-font` + three `@expo-google-fonts/*` packages, `react-native-svg` (already installed), `expo-splash-screen` (already installed).

**Parent spec:** `docs/superpowers/specs/2026-04-19-redesign-01-foundation.md`

**Design reference:** `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/shared.jsx`

---

## Prerequisites

This plan is written for the RN app repo `~/Github/mandys_bubble_tea_app`. Run all commands from that directory.

Before starting, `git status` must show **either** a clean tree **or** only the known Phase 3d WIP set (all of these and nothing else):

```
 M app/(tabs)/account.tsx
 M app/_layout.tsx
 M components/auth/AuthProvider.tsx
 M ios/Podfile.lock
 M ios/mandysbubbleteaapp.xcodeproj/project.pbxproj
 M ios/mandysbubbleteaapp/Info.plist
 M ios/mandysbubbleteaapp/PrivacyInfo.xcprivacy
 M ios/mandysbubbleteaapp/mandysbubbleteaapp.entitlements
?? app/login.tsx
?? assets/images/login-banner.webp
?? components/auth/AuthGate.tsx
?? components/legal/
?? lib/legal.ts
```

Any other dirty state must be resolved first — either commit unrelated work or stash it. Do NOT `git stash` the Phase 3d WIP; it must survive this phase untouched.

All Phase 1 edits go to files OUTSIDE the Phase 3d WIP set, except for `app/_layout.tsx`. Task 6 and Task 7 modify `_layout.tsx` by adding lines; they must not revert or overwrite any Phase 3d line.

## Testing note

This project has no unit-test runner configured. Verification per task is:
- `npx tsc --noEmit` clean.
- `npm run lint` no new warnings above baseline.
- Dev-build visual check via the showcase route (added in Task 8) or Metro hot reload.

No tests are fabricated in this plan. Each task's "Verify" step is concrete and deterministic.

---

## Task 1: Install Google Fonts packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install packages via Expo**

Run from `~/Github/mandys_bubble_tea_app`:

```bash
npx expo install @expo-google-fonts/fraunces @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
```

Expected: three new entries in `package.json` `dependencies`; no errors. If Expo asks to update peer deps, accept.

- [ ] **Step 2: Verify resolution**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0, no output. If there are pre-existing tsc errors unrelated to this task, record them — they must not grow in later tasks.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add Google Fonts (Fraunces / Inter / JetBrains Mono)"
```

---

## Task 2: Create design tokens `constants/theme.ts`

**Files:**
- Create: `constants/theme.ts`

- [ ] **Step 1: Create the file**

Write the entire contents below to `constants/theme.ts`:

```ts
// Design tokens for the redesign. Coexists with `constants/index.ts#BRAND`
// during the phased migration; BRAND is removed only when the last screen
// stops importing it.
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
  serif: 'Fraunces',
  sans: 'Inter',
  mono: 'JetBrainsMono',
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

// iOS shadow* + Android elevation; spread into style.
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
// Font family strings match the exports of @expo-google-fonts/* loaded in app/_layout.tsx.
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

export type ThemeColor = keyof typeof T;
export type TypePreset = keyof typeof TYPE;
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0, no new errors versus Task 1.

- [ ] **Step 3: Commit**

```bash
git add constants/theme.ts
git commit -m "feat(theme): add design tokens (T, FONT, RADIUS, SPACING, SHADOW, TYPE)"
```

---

## Task 3: Create `<CupArt />` brand component

**Files:**
- Create: `components/brand/CupArt.tsx`

Source reference: `reference/src/shared.jsx` lines 152-166 (`function CupArt(...)`).

- [ ] **Step 1: Create the file**

Write to `components/brand/CupArt.tsx`:

```tsx
import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { T } from '@/constants/theme';

export type CupArtProps = {
  fill?: string;
  stroke?: string;
  size?: number;
  filled?: boolean;
};

// Cup illustration with a straw and tapioca pearls. Matches the reference
// design's CupArt SVG (reference/src/shared.jsx).
export function CupArt({
  fill = T.brand,
  stroke = T.ink,
  size = 80,
  filled = true,
}: CupArtProps) {
  const h = size * 1.3;
  const pearls: Array<[number, number]> = [
    [28, 78], [38, 84], [50, 80], [34, 90], [48, 92], [42, 72],
  ];
  return (
    <Svg width={size} height={h} viewBox="0 0 80 104">
      {/* straw */}
      <Rect x={42} y={2} width={5} height={28} rx={1.5} fill={stroke} transform="rotate(10 44 15)" />
      {/* lid */}
      <Rect x={4} y={16} width={72} height={9} rx={2.5} fill={stroke} />
      {/* cup body */}
      <Path
        d="M10 25 L70 25 L63 95 Q63 100 58 100 L22 100 Q17 100 17 95 Z"
        fill={filled ? fill : 'none'}
        stroke={stroke}
        strokeWidth={2}
      />
      {filled && pearls.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3} fill={T.ink} />
      ))}
    </Svg>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/brand/CupArt.tsx
git commit -m "feat(brand): add CupArt SVG component"
```

---

## Task 4: Create `<Icon />` component with full icon set

**Files:**
- Create: `components/brand/Icon.tsx`

Source reference: `reference/src/shared.jsx` lines 24-150 (all entries of the `Icon` object).

- [ ] **Step 1: Create the file**

Write to `components/brand/Icon.tsx`:

```tsx
import React from 'react';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import { T } from '@/constants/theme';

export type IconName =
  | 'bag' | 'bell' | 'pin' | 'star'
  | 'arrow' | 'arrowL' | 'plus' | 'check'
  | 'search' | 'close'
  | 'home' | 'cafe' | 'receipt' | 'user'
  | 'qr' | 'clock'
  | 'chevR' | 'logout' | 'gift' | 'cup' | 'settings';

export type IconProps = {
  name: IconName;
  color?: string;
  size?: number;
  /** For icons that take a filled variant (home). */
  filled?: boolean;
};

export function Icon({ name, color, size, filled }: IconProps) {
  switch (name) {
    case 'bag': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 8h14l-1.3 11.2a2 2 0 01-2 1.8H8.3a2 2 0 01-2-1.8L5 8z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M9 8V6a3 3 0 016 0v2" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'bell': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 10a6 6 0 0112 0v4l1.5 3h-15L6 14v-4z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M10 20a2 2 0 004 0" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'pin': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s * 1.25} viewBox="0 0 14 18" fill="none">
          <Path d="M7 1c3.3 0 6 2.6 6 5.8C13 11 7 17 7 17S1 11 1 6.8C1 3.6 3.7 1 7 1z" stroke={c} strokeWidth={1.4} />
          <Circle cx={7} cy={7} r={2} fill={c} />
        </Svg>
      );
    }
    case 'star': {
      const c = color ?? T.star;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" fill={c} />
        </Svg>
      );
    }
    case 'arrow': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12h14M13 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'arrowL': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M19 12H5M11 6l-6 6 6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'plus': {
      const c = color ?? '#fff';
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'check': {
      const c = color ?? '#fff';
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'search': {
      const c = color ?? T.ink3;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={c} strokeWidth={1.7} />
          <Path d="M20 20l-3.5-3.5" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'close': {
      const c = color ?? T.ink3;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'home': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" fill={filled ? c : 'none'} />
        </Svg>
      );
    }
    case 'cafe': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10h13v6a4 4 0 01-4 4H8a4 4 0 01-4-4v-6z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M17 12h2a2 2 0 010 4h-2" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M8 4s-1 1.5 0 3M12 4s-1 1.5 0 3" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'receipt': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M9 8h6M9 12h6M9 16h4" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'user': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.5} stroke={c} strokeWidth={1.6} />
          <Path d="M4.5 20a7.5 7.5 0 0115 0" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'qr': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={14} y={3} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={3} y={14} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={6} y={6} width={1.5} height={1.5} fill={c} />
          <Rect x={17} y={6} width={1.5} height={1.5} fill={c} />
          <Rect x={6} y={17} width={1.5} height={1.5} fill={c} />
          <Path d="M14 14h2v2h-2zM18 14h3M14 18h2v3M19 17v4M17 21h4" stroke={c} strokeWidth={1.4} />
        </Svg>
      );
    }
    case 'clock': {
      const c = color ?? T.ink;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={1.6} />
          <Path d="M12 7v5l3 2" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'chevR': {
      const c = color ?? T.ink3;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M9 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'logout': {
      const c = color ?? T.ink2;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M16 8l4 4-4 4M20 12H10" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'gift': {
      const c = color ?? T.ink;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 10h18v3H3zM4 13h16v8H4zM12 10v11" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M12 10s-4-5-6-3 2 3 6 3zM12 10s4-5 6-3-2 3-6 3z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'cup': {
      const c = color ?? T.ink;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M7 4h10l-1 16a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 4z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M7 8h10" stroke={c} strokeWidth={1.4} />
        </Svg>
      );
    }
    case 'settings': {
      const c = color ?? T.ink;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={1.6} />
          <Path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0. TypeScript will enforce exhaustive `IconName` coverage.

- [ ] **Step 3: Commit**

```bash
git add components/brand/Icon.tsx
git commit -m "feat(brand): add Icon component with full icon set"
```

---

## Task 5: Create `<StarDots />` progress component

**Files:**
- Create: `components/brand/StarDots.tsx`

- [ ] **Step 1: Create the file**

Write to `components/brand/StarDots.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { T } from '@/constants/theme';

export type StarDotsProps = {
  value: number;
  total?: number;
  size?: number;
  gap?: number;
  filledColor?: string;
  emptyColor?: string;
};

export function StarDots({
  value,
  total = 9,
  size = 12,
  gap = 6,
  filledColor = T.star,
  emptyColor = T.ink4,
}: StarDotsProps) {
  const clamped = Math.max(0, Math.min(value, total));
  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < clamped ? filledColor : emptyColor,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/brand/StarDots.tsx
git commit -m "feat(brand): add StarDots progress component"
```

---

## Task 6: Wire `useFonts` + splash gate into `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

This task edits the Phase 3d WIP `_layout.tsx` in place — do NOT revert any existing Phase 3d changes.

- [ ] **Step 1: Add font imports at the top of the file**

Open `app/_layout.tsx`. Below the existing imports (after `import { useReadyVibration } from '@/hooks/use-ready-vibration';`), add:

```tsx
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
```

- [ ] **Step 2: Prevent splash auto-hide module-scope**

Immediately below the import block (still top of file, above the `LightTheme` declaration), add:

```tsx
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — splash may already be auto-hidden in some dev contexts
});
```

If you see a lint error that `SplashScreen.preventAutoHideAsync` is already called elsewhere, remove the duplicate call (keep the one higher in the startup sequence) and skip this step.

- [ ] **Step 3: Add `useFonts` + gate inside `RootLayout`**

All React hooks must run on every render — call them BEFORE any early return. Place the font hook and effect **before** the existing `useReadyVibration();` call, and the `if (!fontsLoaded) return null;` guard **after** all hooks (including `useReadyVibration`).

The head of `RootLayout` must read:

```tsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);
  useReadyVibration();
  if (!fontsLoaded) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    // ...existing body unchanged
```

Leave all JSX below untouched.

- [ ] **Step 4: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0. If TS complains about React imports, the file may need `import React from 'react';` — add it if so.

- [ ] **Step 5: Verify runtime on iOS simulator**

Run (in a separate terminal):

```bash
npx expo start --clear
```

Then press `i` to open iOS simulator. Expected:
1. Splash screen appears.
2. Metro bundler shows "Waiting on..." then completes.
3. App opens to the tabs — visual must be identical to before (fonts not yet applied anywhere).
4. No red error screen.

Close Metro (Ctrl-C) after verification.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): gate splash on Google Fonts load (Foundation phase)"
```

---

## Task 7: Switch global background color to `T.bg`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Import `T`**

At the top of `app/_layout.tsx`, add the import (place near other `@/`-prefixed imports):

```tsx
import { T } from '@/constants/theme';
```

- [ ] **Step 2: Replace `LightTheme.colors.background`**

Find the `LightTheme` declaration:

```tsx
const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#8D5524',
    background: '#fff',
    card: '#fff',
    text: '#11181C',
    border: '#e0e0e0',
  },
};
```

Change it to:

```tsx
const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: T.brand,
    background: T.bg,
    card: T.card,
    text: T.ink,
    border: T.line,
  },
};
```

- [ ] **Step 3: Update `GestureHandlerRootView` background**

Change:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
```

to:

```tsx
<GestureHandlerRootView style={{ flex: 1, backgroundColor: T.bg }}>
```

- [ ] **Step 4: Verify typecheck and runtime**

```bash
npx tsc --noEmit
```

Expected: exit 0.

Re-run iOS simulator:

```bash
npx expo start --clear
```

Expected: navigation backgrounds (between-screen transitions, pull-to-refresh overscroll) now show warm cream `#F2E8DF`. Individual screens still render with their own current backgrounds (unchanged until later phases).

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(theme): switch global background to T.bg warm cream"
```

---

## Task 8: Dev-only theme showcase route

**Files:**
- Create: `app/dev/theme-showcase.tsx`

- [ ] **Step 1: Create the file**

Write to `app/dev/theme-showcase.tsx`:

```tsx
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, TYPE, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { CupArt } from '@/components/brand/CupArt';
import { Icon, type IconName } from '@/components/brand/Icon';
import { StarDots } from '@/components/brand/StarDots';

const COLORS: Array<{ name: keyof typeof T; value: string }> = (
  Object.entries(T) as Array<[keyof typeof T, string]>
).map(([name, value]) => ({ name, value }));

const ICONS: IconName[] = [
  'bag', 'bell', 'pin', 'star', 'arrow', 'arrowL', 'plus', 'check',
  'search', 'close', 'home', 'cafe', 'receipt', 'user', 'qr', 'clock',
  'chevR', 'logout', 'gift', 'cup', 'settings',
];

const TYPE_ENTRIES = Object.entries(TYPE) as Array<[keyof typeof TYPE, (typeof TYPE)[keyof typeof TYPE]]>;

export default function ThemeShowcase() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.devOnly}>This screen is only available in dev builds.</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[TYPE.screenTitleLg, styles.h]}>Theme showcase</Text>

        <Section title="Colors (T.*)">
          <View style={styles.swatchGrid}>
            {COLORS.map(({ name, value }) => (
              <View key={name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: value }]} />
                <Text style={[TYPE.label, { color: T.ink }]}>{name}</Text>
                <Text style={[TYPE.priceSm, { color: T.ink3 }]}>{value}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Typography (TYPE.*)">
          {TYPE_ENTRIES.map(([name, preset]) => (
            <View key={name} style={styles.typeRow}>
              <Text style={[TYPE.label, { color: T.ink3 }]}>{name}</Text>
              <Text style={[preset, { color: T.ink }]}>
                The quick brown fox — $4.50
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Icons">
          <View style={styles.iconGrid}>
            {ICONS.map((name) => (
              <View key={name} style={styles.iconCell}>
                <Icon name={name} color={T.ink} size={24} />
                <Text style={[TYPE.label, { color: T.ink3, marginTop: 4 }]}>{name}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.iconGrid, { marginTop: SPACING.lg }]}>
            {ICONS.map((name) => (
              <View key={`brand-${name}`} style={styles.iconCell}>
                <Icon name={name} color={T.brand} size={24} />
              </View>
            ))}
          </View>
        </Section>

        <Section title="CupArt">
          <View style={styles.cupRow}>
            <CupArt size={40} />
            <CupArt size={80} fill={T.peach} />
            <CupArt size={120} fill={T.sage} />
            <CupArt size={80} filled={false} />
          </View>
        </Section>

        <Section title="StarDots">
          <View style={{ gap: SPACING.md }}>
            <StarDots value={0} />
            <StarDots value={3} />
            <StarDots value={8} />
            <StarDots value={9} />
          </View>
        </Section>

        <Section title="Shadows">
          <View style={styles.shadowRow}>
            <View style={[styles.shadowCard, SHADOW.card]}>
              <Text style={TYPE.label}>card</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.miniCart, { backgroundColor: T.brand }]}>
              <Text style={[TYPE.label, { color: T.cream }]}>miniCart</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.primaryCta, { backgroundColor: T.ink }]}>
              <Text style={[TYPE.label, { color: T.cream }]}>primaryCta</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.successBubble, { backgroundColor: T.sage }]}>
              <Text style={[TYPE.label, { color: T.ink }]}>success</Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[TYPE.cardTitle, { color: T.ink, marginBottom: SPACING.md }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl * 2 },
  h: { color: T.ink, marginBottom: SPACING.lg },
  devOnly: { padding: SPACING.xl, color: T.ink2 },
  section: { marginBottom: SPACING.xl },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  swatchCell: { width: '30%' },
  swatch: {
    height: 56,
    borderRadius: RADIUS.tile,
    marginBottom: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
  },
  typeRow: { marginBottom: SPACING.md, gap: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  iconCell: {
    width: 56,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  cupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.lg },
  shadowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  shadowCard: {
    width: 110,
    height: 70,
    borderRadius: RADIUS.card,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Verify routing by deep link**

`expo-router` exposes the file as `/dev/theme-showcase`. Start Metro:

```bash
npx expo start --clear
```

Press `i` to launch the iOS simulator and wait for the app to boot. Then open the showcase via the app's URL scheme. The scheme is defined in `app.json` under `expo.scheme` — read it first:

```bash
node -e "console.log(require('./app.json').expo.scheme)"
```

Then from a separate terminal (with sim booted):

```bash
xcrun simctl openurl booted "<scheme>://dev/theme-showcase"
```

Replace `<scheme>` with the value printed above (e.g. `mandysbubbleteaapp://dev/theme-showcase`).

Expected: the showcase screen renders with all 16 swatches, every type preset, every icon in both `T.ink` and `T.brand` rows, four CupArts, StarDots rows 0/3/8/9, and four shadow cards. No red error screen, no warnings about missing fonts in Metro.

If `app.json` has no scheme, fall back to manually adding a one-shot `router.push('/dev/theme-showcase')` call from an existing dev-only spot (e.g. the Account tab's dev header area), verify, then remove the call **before** committing Task 8.

- [ ] **Step 4: Commit**

```bash
git add app/dev/theme-showcase.tsx
git commit -m "chore(dev): add theme-showcase route for Foundation visual validation"
```

---

## Task 9: Final validation pass

- [ ] **Step 1: Confirm tsc + lint are clean**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both exit 0. If lint produces new warnings introduced by this phase (not pre-existing), fix them before moving on.

- [ ] **Step 2: Confirm Phase 3d WIP is untouched**

```bash
git status --short
```

Expected output must match the prerequisite set exactly (same list of `M` and `??` entries as before Phase 1 started). No Phase 3d file should appear in the Phase 1 commit range.

Verify the commit range (the 8 most recent commits should be this phase's):

```bash
git log --oneline -8
```

Every Phase 1 commit message should be one of:
- `chore(deps): add Google Fonts (Fraunces / Inter / JetBrains Mono)`
- `feat(theme): add design tokens (...)`
- `feat(brand): add CupArt SVG component`
- `feat(brand): add Icon component with full icon set`
- `feat(brand): add StarDots progress component`
- `feat(app): gate splash on Google Fonts load (Foundation phase)`
- `feat(theme): switch global background to T.bg warm cream`
- `chore(dev): add theme-showcase route for Foundation visual validation`

- [ ] **Step 3: Visual regression spot-check on real device**

Install a fresh development build (re-run `npx expo start`, or EAS dev-client rebuild if native deps changed — they shouldn't have; font packages are JS-only). Walk through: Home / Menu / Cart / Order / Account. Each screen should look indistinguishable from pre-phase **except** the navigation transition background (now warm cream).

- [ ] **Step 4: Bundle-size check (optional but recommended)**

If time permits:

```bash
npx expo export --platform ios --output-dir /tmp/expo-export-post-foundation
du -sh /tmp/expo-export-post-foundation
```

Compare to a pre-phase export if one was captured. Delta should be ≤ 2 MB (fonts only).

---

## Post-phase handoff

Once Task 9 is clean:

1. Announce in DEV queue: "Redesign Phase 1 Foundation complete. `/dev/theme-showcase` live on dev build."
2. Start writing Phase 2 (Home) detail spec — it can now reference `T`, `TYPE`, `CupArt`, `Icon`, `StarDots` concretely by import path.
3. Delete `app/dev/theme-showcase.tsx` at the start of Phase 2 Task 1.
