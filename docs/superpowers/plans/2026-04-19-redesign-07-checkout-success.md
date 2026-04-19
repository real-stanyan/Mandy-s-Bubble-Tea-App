# Redesign Phase 7 — Checkout + Success Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Dispatch a fresh implementer subagent per task; run two-stage review (spec compliance then code quality) on multi-file / integration tasks; compress to inline diff verify for trivial single-file tasks. Preserve Phase 3d WIP 13 paths byte-identical across every commit. Each task's Steps use checkbox (`- [ ]`) syntax.

**Goal:** Re-skin `app/checkout.tsx` to the Phase 1 design system (T / FONT / TYPE / SHADOW / RADIUS tokens, CardBlock pattern), add `Notes for barista` wired to Square Order `note`, replace the navigate-to-`/order-confirmation` success step with an in-place `OrderPlaced` overlay.

**Architecture:**
- Additive component work: `components/checkout/CardBlock.tsx` (shared container) and `components/checkout/OrderPlaced.tsx` (success overlay with Reanimated spring check-icon). Both scoped to checkout only.
- Targeted hook extension: `useCreateOrder` accepts optional `note`, forwards to `/api/orders` body (backend already supports).
- Icon expansion: `components/brand/Icon.tsx` gains `apple` / `google` / `card` / `wallet` names so checkout can drop Ionicons.
- Single big rewrite: `app/checkout.tsx` is rewritten top-to-bottom preserving every data/auth/payment/loyalty/welcome-discount wire, but swapping visual shell to stacked CardBlocks + sticky CTA + OrderPlaced overlay state.
- Optional cleanup: delete `components/checkout/OrderSummary.tsx` (only caller is `checkout.tsx`).

**Tech Stack:** Expo SDK 54 / React Native 0.81 / expo-router 6 / Reanimated 4.1 / expo-haptics 15 / Supabase Auth / Square In-App Payments SDK.

**Spec:** `docs/superpowers/specs/2026-04-19-redesign-07-checkout-success.md`

---

## Phase 3d WIP protection — applies to every task

Before any file edit, the implementer runs:

```bash
git status --porcelain
```

and verifies all 13 Phase 3d paths still appear as they did at Task 0 baseline (see Task 0 Step 3). If an implementer's work accidentally modifies one of those paths, the change must be reverted before commit. The final verification task (Task 7) diffs the 13-path list again vs Task 0 baseline.

The 13 paths to preserve byte-identical:

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

---

## Task 0: Baseline snapshot

**Purpose:** Capture the starting state for post-phase comparison. No code change.

**Files:** none.

- [ ] **Step 1: Confirm repo is clean of Phase 7 scope**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git log --oneline -3
# expected top commit: 00ce2de docs: redesign Phase 7 spec — Checkout + Success overlay
```

- [ ] **Step 2: Snapshot lint + typecheck baseline**

```bash
npx tsc --noEmit 2>&1 | tail -3
# expected exit 0, no output

npm run lint 2>&1 | tail -15
# expected: 1 error + 4 warnings
# the 1 error is app/login.tsx:467:41 unescaped entity (Phase 3d WIP, do not touch)
```

Record the exact counts for final verification. If higher than expected, investigate (possibly another Phase 3d WIP path regressed) before starting Phase 7.

- [ ] **Step 3: Snapshot Phase 3d WIP 13-path list**

```bash
git status --porcelain | sort > /tmp/phase7-task0-wip.txt
cat /tmp/phase7-task0-wip.txt
```

Verify the output contains exactly the 13 paths listed above (8 `M` + 5 `??`). This file is reused in Task 7 to confirm byte-identity.

- [ ] **Step 4: No commit** — this is a baseline-only task.

---

## Task 1: Add `apple` / `google` / `card` / `wallet` icons

**Files:**
- Modify: `components/brand/Icon.tsx`

**Purpose:** Let the redesigned checkout drop Ionicons. All icon rendering goes through `<Icon>`.

- [ ] **Step 1: Read the current `Icon.tsx` to find the switch shape**

```bash
# Expected: switch (name) { case 'bag': ... case 'bell': ... }
# Expected 21 existing cases per Phase 1 spec.
```

- [ ] **Step 2: Extend the `IconName` union type**

Add four names to the existing union (keep alphabetical-ish order or append at end — follow existing convention):

```ts
export type IconName =
  | 'bag' | 'bell' | 'pin' | 'star' | 'arrow' | 'arrowL' | 'plus' | 'check'
  | 'search' | 'close' | 'home' | 'cafe' | 'receipt' | 'user' | 'qr'
  | 'clock' | 'chevR' | 'logout' | 'gift' | 'cup' | 'settings'
  | 'apple' | 'google' | 'card' | 'wallet';
```

- [ ] **Step 3: Add four `case` branches inside the switch**

Return `<Svg>` with the following minimal paths (viewBox `0 0 24 24`, `fill={color}`). Colors default to `T.ink` per existing component convention.

```tsx
case 'apple':
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.5 12c-.1-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.7-3.4z"/>
    </Svg>
  );

case 'google':
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21.35 11.1h-9.17v2.9h5.27c-.23 1.45-1.69 4.26-5.27 4.26-3.17 0-5.75-2.62-5.75-5.86 0-3.23 2.58-5.86 5.75-5.86 1.8 0 3.02.77 3.71 1.43l2.53-2.44C16.82 3.93 14.68 3 12.18 3 7.52 3 3.73 6.79 3.73 11.4s3.79 8.4 8.45 8.4c4.88 0 8.11-3.43 8.11-8.26 0-.55-.06-.98-.14-1.44z" fill={color}/>
    </Svg>
  );

case 'card':
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6.5C3 5.12 4.12 4 5.5 4h13C19.88 4 21 5.12 21 6.5v11c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20 3 18.88 3 17.5v-11Z" stroke={color} strokeWidth={1.7}/>
      <Path d="M3 9.5h18" stroke={color} strokeWidth={1.7}/>
      <Path d="M6.5 15.5h3" stroke={color} strokeWidth={1.7} strokeLinecap="round"/>
    </Svg>
  );

case 'wallet':
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8.5C3 7.12 4.12 6 5.5 6h13C19.88 6 21 7.12 21 8.5v9c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20 3 18.88 3 17.5v-9Z" stroke={color} strokeWidth={1.7}/>
      <Path d="M16 13.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill={color}/>
    </Svg>
  );
```

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 5: Commit**

```bash
git add components/brand/Icon.tsx
git commit -m "feat(icons): add apple/google/card/wallet icons for Phase 7 checkout

Extends the Phase 1 Icon component with four more names so the
redesigned checkout can render payment-method glyphs without
pulling Ionicons back in.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: New shared `CardBlock` component

**Files:**
- Create: `components/checkout/CardBlock.tsx`

**Purpose:** Re-usable container wrapping every section of the redesigned checkout (Pickup store, Pickup time, Your order, Rewards, Payment, Notes). Matches reference `CardBlock` in `CheckoutScreen.jsx:60-100`.

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { T, FONT, RADIUS } from '@/constants/theme'

export interface CardBlockProps {
  eyebrow?: string
  title: string
  right?: React.ReactNode
  onEdit?: () => void
  children?: React.ReactNode
}

export function CardBlock({ eyebrow, title, right, onEdit, children }: CardBlockProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {right ?? null}
        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={8}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontFamily: FONT.serif,
    fontSize: 17,
    fontWeight: '500',
    color: T.ink,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(141,85,36,0.08)',
  },
  editText: {
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '700',
    color: T.brand,
  },
})
```

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 3: Commit**

```bash
git add components/checkout/CardBlock.tsx
git commit -m "feat(checkout): add shared CardBlock container

Eyebrow + title + right slot + optional Edit chip, used by every
section of the Phase 7 redesigned checkout. Scoped to checkout/
for now; promote to components/brand/ if reused elsewhere.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: New `OrderPlaced` success overlay component

**Files:**
- Create: `components/checkout/OrderPlaced.tsx`

**Purpose:** Absolute-positioned success view rendered on top of checkout root after `pay()` resolves. Animates a spring check icon, shows pickup number + stars earned + total, offers a "Track my order →" CTA.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Icon } from '@/components/brand/Icon'
import { T, FONT, RADIUS, SHADOW } from '@/constants/theme'
import { formatPrice } from '@/lib/utils'

export interface OrderPlacedProps {
  pickupNumber: string
  totalCents: number
  starsEarned: number
  storeName: string
  onTrack: () => void
}

export function OrderPlaced({
  pickupNumber,
  totalCents,
  starsEarned,
  storeName,
  onTrack,
}: OrderPlacedProps) {
  const checkScale = useSharedValue(0.3)
  const overlayOpacity = useSharedValue(0)

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    overlayOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
    checkScale.value = withSequence(
      withTiming(1.1, { duration: 280, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    )
  }, [checkScale, overlayOpacity])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }))

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <View style={styles.content}>
        <Animated.View style={[styles.checkBubble, checkStyle, iosSageShadow]}>
          <Icon name="check" size={40} color="#fff" />
        </Animated.View>
        <Text style={styles.eyebrow}>Order placed</Text>
        <Text style={styles.headline}>You're all set</Text>
        <Text style={styles.body}>
          Order <Text style={styles.bodyMono}>{pickupNumber}</Text> will be ready in ~6 min at Mandy's — {storeName}.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Total charged</Text>
            <Text style={styles.infoValue}>{formatPrice(totalCents)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Stars earned</Text>
            <View style={styles.starsRow}>
              <Text style={styles.starsValue}>+{starsEarned}</Text>
              <Icon name="star" size={18} color={T.star} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Pressable onPress={onTrack} style={styles.cta}>
          <Text style={styles.ctaText}>Track my order</Text>
          <Icon name="arrow" size={14} color={T.cream} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

const iosSageShadow = Platform.select({
  ios: {
    shadowColor: SHADOW.successBubble.shadowColor,
    shadowOffset: SHADOW.successBubble.shadowOffset,
    shadowOpacity: SHADOW.successBubble.shadowOpacity,
    shadowRadius: SHADOW.successBubble.shadowRadius,
  },
  android: { elevation: SHADOW.successBubble.elevation },
  default: {},
})

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 80,
    backgroundColor: T.bg,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  checkBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 6,
    fontFamily: FONT.serif,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.7,
    color: T.ink,
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontFamily: FONT.sans,
    fontSize: 14,
    lineHeight: 20,
    color: T.ink2,
    textAlign: 'center',
    maxWidth: 280,
  },
  bodyMono: {
    fontFamily: FONT.mono,
    fontWeight: '700',
    color: T.ink,
  },
  infoCard: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS.card,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  infoCol: {
    alignItems: 'flex-start',
  },
  infoDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: T.line,
  },
  infoLabel: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: T.ink3,
    textTransform: 'uppercase',
  },
  infoValue: {
    marginTop: 3,
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    color: T.ink,
  },
  starsRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsValue: {
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    color: T.brand,
  },
  ctaWrap: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    backgroundColor: T.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontFamily: FONT.sans,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: T.cream,
  },
})
```

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 3: Commit**

```bash
git add components/checkout/OrderPlaced.tsx
git commit -m "feat(checkout): add OrderPlaced success overlay component

In-place absolute-fill overlay with Reanimated spring check icon,
haptics, two-column info card (total charged + stars earned), and
a 'Track my order' CTA. Replaces the router.replace('/order-confirmation')
navigation step in the Phase 7 checkout rewrite (Task 5).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Extend `useCreateOrder` to accept `note`

**Files:**
- Modify: `hooks/use-create-order.ts`

**Purpose:** Let the Notes-for-barista textarea feed into the Square Order `note` field. Backend already supports this (`src/app/api/orders/route.ts:36,221`).

- [ ] **Step 1: Update the interface**

```ts
interface CreateOrderParams {
  items: CartItem[]
  applyWelcomeDiscount?: boolean
  note?: string
}
```

- [ ] **Step 2: Destructure `note` in the function**

```ts
const createOrder = async ({
  items,
  applyWelcomeDiscount,
  note,
}: CreateOrderParams): Promise<CreateOrderResult> => {
```

- [ ] **Step 3: Forward `note` on the POST body**

```ts
const orderRes = await apiFetch<{
  ok: boolean
  orderId: string
  order: Order
}>('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    lines,
    applyWelcomeDiscount: !!applyWelcomeDiscount,
    note: note?.trim() ? note.trim() : undefined,
  }),
})
```

Notes:
- Trim to avoid sending whitespace-only strings.
- Send `undefined` when empty so the server falls back to the auto-generated pickupNumber prefix alone.

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 5: Commit**

```bash
git add hooks/use-create-order.ts
git commit -m "feat(orders): forward optional user note to Square order

Adds note?: string to useCreateOrder's params and threads it
through the /api/orders POST body. Backend already merges it
with the pickup number (src/app/api/orders/route.ts:221). Used
by the Phase 7 Notes-for-barista checkout section (Task 5).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Rewrite `app/checkout.tsx` to the Phase 7 design

**Files:**
- Modify: `app/checkout.tsx` (full rewrite; ~552 → ~700 lines expected)

**Purpose:** Stacked CardBlocks + inline sticky header + Notes + sticky Place-order CTA + OrderPlaced overlay state, preserving 100% of existing data/auth/payment/loyalty/welcome-discount behavior.

This is the heaviest task of the phase. Plan on a fresh, capable implementer subagent.

- [ ] **Step 1: Open current `app/checkout.tsx` and plan the migration**

Map each existing behavior to its new location. **Nothing may be dropped.**

| Existing (today) | New location (Phase 7) |
|---|---|
| Zustand reads (`items`, `total`, `clearCart`) | same |
| `useAuth()` reads (`profile`, `loyalty`, `welcomeDiscount`, `starsPerReward`, `refreshAuth`) | same |
| `useCreateOrder()` / `usePayment()` | same; `createOrder` now receives `note` |
| `computeWelcomeDiscount` helper | keep inline (unchanged) |
| `cheapestItemPrice` helper | keep inline (unchanged) |
| `payMethod` state + `canUseApplePay` / `canUseGooglePay` `useEffect` | same — just restyled radio list inside Payment CardBlock |
| Welcome-discount banner line in `<OrderSummary>` | moved into Summary CardBlock (new inline renderer) |
| `<LoyaltyCard>` + `<RedeemToggle>` | replaced visually by Rewards CardBlock but reuses the same `useReward` state and `canRedeem` logic |
| `handlePay()` logic end-to-end | **byte-for-byte identical** through the `pay()` call. Only the tail branches change: where we used to `router.replace('/order-confirmation', ...)` we now `setPlaced({...})` |
| `PaymentErrorDialog` modal | same — wrap stays at root |
| `authLoading` + `!profile` guards | same; `!profile` branch still renders a scrollable SignInCard fallback (see Step 4 — it gets a light T-token restyle but same shape) |
| Ionicons imports | **removed** — replaced by `<Icon>` |
| BRAND import | **removed** — replaced by `T.brand` |

- [ ] **Step 2: Write the new file scaffold**

Top of file:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack, useRouter } from 'expo-router'
import { useCartStore } from '@/store/cart'
import { useCreateOrder } from '@/hooks/use-create-order'
import { usePayment } from '@/hooks/use-payment'
import { useAuth } from '@/components/auth/AuthProvider'
import { PaymentErrorDialog } from '@/components/ui/PaymentErrorDialog'
import { SignInCard } from '@/components/auth/SignInCard'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { CardBlock } from '@/components/checkout/CardBlock'
import { OrderPlaced } from '@/components/checkout/OrderPlaced'
import { hashColor } from '@/components/menu/color'
import { T, FONT, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import {
  initSquarePayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
} from '@/lib/square-payment'
import type { LoyaltyAccount, CartItem, CartModifier } from '@/types/square'

type PayMethod = 'card' | 'apple' | 'google'
```

- [ ] **Step 3: Screen options + helpers**

Inside the default export function, mount `<Stack.Screen>` at the top of the JSX to override the layout's header:

```tsx
return (
  <View style={styles.root}>
    <Stack.Screen options={{ headerShown: false }} />
    {/* ... rest */}
  </View>
)
```

Reuse the existing `computeWelcomeDiscount` and `cheapestItemPrice` helpers verbatim.

Add a modifier-summary helper for Order Items CardBlock rows:

```tsx
function groupModifiers(mods: CartModifier[] | undefined): string {
  if (!mods || mods.length === 0) return ''
  const byList = new Map<string, string[]>()
  for (const m of mods) {
    const key = (m.listName || 'OTHER').toLowerCase()
    const arr = byList.get(key) ?? []
    arr.push(m.name)
    byList.set(key, arr)
  }
  const parts: string[] = []
  for (const [, names] of byList) parts.push(names.join(', '))
  return parts.join(' · ')
}
```

- [ ] **Step 4: Auth gate branch**

Keep the early-return pattern:

```tsx
if (authLoading && !profile) {
  return (
    <View style={styles.centerLoad}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={T.brand} />
    </View>
  )
}

if (!profile) {
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <InlineHeader onBack={handleBack} total={total} />
        {/* Simple summary card so the user sees what they'll buy before signing in */}
        <SimpleSummaryBlock items={items} total={total} />
        <View style={{ marginHorizontal: 16, marginTop: 4 }}>
          <SignInCard
            heading="Sign in to continue"
            subheading="We need your name + phone to place an order."
          />
        </View>
      </ScrollView>
    </View>
  )
}
```

Where `SimpleSummaryBlock` is an inline component rendering item names + total inside a CardBlock:

```tsx
function SimpleSummaryBlock({ items, total }: { items: CartItem[]; total: number }) {
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return (
    <CardBlock eyebrow="Your order" title={`${count} drink${count === 1 ? '' : 's'}`}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: 13, color: T.ink2 }}>
          Total {formatPrice(total)}
        </Text>
      </View>
    </CardBlock>
  )
}
```

- [ ] **Step 5: Inline header component**

```tsx
function InlineHeader({ onBack, total }: { onBack: () => void; total: number }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Icon name="arrowL" size={18} color={T.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerEyebrow}>Checkout</Text>
        <Text style={styles.headerTitle}>Review & pay</Text>
      </View>
      <Text style={styles.headerTotal}>{formatPrice(total)}</Text>
    </View>
  )
}
```

`onBack` = `router.canGoBack() ? router.back() : router.replace('/(tabs)/menu')`.

- [ ] **Step 6: Main screen body — sections**

After the auth gate passes, render in ScrollView:

1. `<InlineHeader total={displayedTotal} />` — sticky via `position:absolute` at `paddingTop: 56` from safe area inset (use `useSafeAreaInsets()`)
2. `<StoreBlock />` — CardBlock, eyebrow `Pickup store`, title `Mandy's — Southport`, address line + Open-now pill + wait chip
3. `<PickupTimeBlock />` — CardBlock, eyebrow `Pickup time`, title `ASAP · ~6 min` (no children)
4. `<OrderItemsBlock items={items} />` — CardBlock, eyebrow `Your order`, title `${count} drinks`; body rows: 40×40 thumb (imageUrl or CupArt with `hashColor(item.variationId)`), `{qty}× {name}`, modifier summary, price mono right
5. `<RewardsBlock stars={loyaltyBalance} goal={perReward} useReward={useReward} setUseReward={canRedeem ? toggle : noop} welcomeInfo={welcomeDiscountForSummary} />` — progress bar when not ready, toggle pill when ready, welcome hint when applicable
6. `<PaymentBlock payMethod={payMethod} applePay={applePayAvailable} googlePay={googlePayAvailable} onChange={setPayMethod} />` — radio list
7. `<NotesBlock value={note} onChange={setNote} />` — TextInput multiline
8. `<SummaryBlock subtotal={total} welcome={welcomeDiscountForSummary} rewardDiscount={useReward && canRedeem ? cheapestItemPrice(items) : 0} />`
9. Spacer `{ height: 130 }` for sticky CTA

Sticky CTA at bottom of root View (outside ScrollView):

```tsx
<View style={styles.ctaBar}>
  <Pressable
    onPress={handlePay}
    disabled={isLoading}
    style={[styles.placeBtn, isLoading && { opacity: 0.65 }]}
  >
    <View style={{ flex: 1, paddingLeft: 18 }}>
      <Text style={styles.placeEyebrow}>{payLabel(payMethod)}</Text>
      <Text style={styles.placeTitle}>Place order</Text>
    </View>
    <View style={styles.placeAmount}>
      {isLoading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.placeAmountText}>{formatPrice(displayedTotal)}</Text>}
    </View>
  </Pressable>
</View>
```

`payLabel(m)` returns `'Pay with Apple Pay'` / `'Pay with Google Pay'` / `'Pay with Card'`.

`displayedTotal = Math.max(total - (useReward && canRedeem ? cheapestItemPrice(items) : 0) - (welcomeDiscountForSummary?.amountCents ?? 0), 0)`.

- [ ] **Step 7: OrderPlaced overlay mount**

Inside the root `<View>`, after the ScrollView + CTA bar, conditionally render:

```tsx
{placed && (
  <OrderPlaced
    pickupNumber={placed.pickupNumber}
    totalCents={placed.totalCents}
    starsEarned={placed.starsEarned}
    storeName="Southport"
    onTrack={() => {
      setPlaced(null)
      router.replace('/(tabs)/order')
    }}
  />
)}
```

Where `placed` state:

```ts
const [placed, setPlaced] = useState<{
  pickupNumber: string
  totalCents: number
  starsEarned: number
} | null>(null)
```

- [ ] **Step 8: `handlePay` tail swap**

Everything up to and including `const result = await pay({ sourceId: nonce, orderId })` stays byte-identical. Replace the tail:

```ts
// before the try-catch tail:
await AsyncStorage.setItem('mbt:lastOrder:items', JSON.stringify(items))

const pickupRef = createdOrder.referenceId
  ? `#${createdOrder.referenceId}`
  : orderId
    ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0')
    : '#---'
const starsEarned = result.loyaltyAccrued
  ? items.reduce((s, i) => s + i.quantity, 0)
  : 0
const totalCents = Math.max(amountCents, 0)

clearCart()
refreshAuth()
setPlaced({ pickupNumber: pickupRef, totalCents, starsEarned })
```

No `router.replace('/order-confirmation')`.

Also: `createOrder` now receives `{ items, applyWelcomeDiscount: useWelcome, note }`.

- [ ] **Step 9: Section subcomponents**

Implement `StoreBlock`, `PickupTimeBlock`, `OrderItemsBlock`, `RewardsBlock`, `PaymentBlock`, `NotesBlock`, `SummaryBlock` as module-scope function components. Prefer local styles grouped at bottom of file; do not re-export.

Key snippets:

```tsx
function StoreBlock() {
  return (
    <CardBlock eyebrow="Pickup store" title="Mandy's — Southport">
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: 12.5, color: T.ink2, lineHeight: 18 }}>
          34 Davenport St · Southport QLD 4215
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.openPill}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>Open now</Text>
          </View>
          <View style={styles.waitPill}>
            <Icon name="clock" size={11} color={T.ink2} />
            <Text style={styles.waitText}>~6 min</Text>
          </View>
        </View>
      </View>
    </CardBlock>
  )
}
```

```tsx
function PickupTimeBlock() {
  return <CardBlock eyebrow="Pickup time" title="ASAP · ~6 min" />
}
```

```tsx
function OrderItemsBlock({ items }: { items: CartItem[] }) {
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return (
    <CardBlock eyebrow="Your order" title={`${count} drink${count === 1 ? '' : 's'}`}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {items.map((it, idx) => (
          <View key={it.lineId ?? it.variationId} style={[styles.itemRow, idx === 0 && { borderTopWidth: 1, borderTopColor: T.line }]}>
            <View style={styles.itemThumb}>
              <CupArt fill={hashColor(it.variationId)} stroke={T.ink} size={26} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={1}>{it.quantity}× {it.name}</Text>
              {groupModifiers(it.modifiers) ? (
                <Text style={styles.itemSub} numberOfLines={2}>{groupModifiers(it.modifiers)}</Text>
              ) : null}
            </View>
            <Text style={styles.itemPrice}>{formatPrice(it.price * it.quantity)}</Text>
          </View>
        ))}
      </View>
    </CardBlock>
  )
}
```

```tsx
function RewardsBlock({
  stars, goal, canRedeem, useReward, onToggle, welcome,
}: {
  stars: number
  goal: number
  canRedeem: boolean
  useReward: boolean
  onToggle: () => void
  welcome: { amountCents: number; coveredCount: number } | null
}) {
  const title = canRedeem
    ? 'Free drink available'
    : `${stars} / ${goal} stars`
  const progressPct = Math.min(goal > 0 ? stars / goal : 0, 1) * 100
  return (
    <CardBlock
      eyebrow="Rewards"
      title={title}
      right={
        canRedeem ? (
          <Pressable onPress={onToggle} style={styles.toggleRow} hitSlop={8}>
            <Text style={styles.toggleLabel}>Apply</Text>
            <View style={[styles.toggleTrack, useReward && { backgroundColor: T.brand }]}>
              <View style={[styles.toggleThumb, useReward && { transform: [{ translateX: 16 }] }]} />
            </View>
          </Pressable>
        ) : undefined
      }
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {!canRedeem && (
          <>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              +1 star with this order — {Math.max(goal - stars - 1, 0)} to go
            </Text>
          </>
        )}
        {canRedeem && (
          <Text style={styles.rewardsHint}>
            Toggle on to redeem one free drink from your order. Stars reset after redemption.
          </Text>
        )}
        {welcome && welcome.coveredCount > 0 && (
          <Text style={styles.welcomeHint}>
            Welcome 30% off applied to {welcome.coveredCount} drink{welcome.coveredCount === 1 ? '' : 's'} — saves {formatPrice(welcome.amountCents)}
          </Text>
        )}
      </View>
    </CardBlock>
  )
}
```

```tsx
function PaymentBlock({
  payMethod, applePay, googlePay, onChange,
}: {
  payMethod: PayMethod
  applePay: boolean
  googlePay: boolean
  onChange: (m: PayMethod) => void
}) {
  const [open, setOpen] = useState(false)
  const options: { id: PayMethod; label: string; icon: 'apple' | 'google' | 'card' }[] = []
  if (applePay) options.push({ id: 'apple', label: 'Apple Pay', icon: 'apple' })
  if (googlePay) options.push({ id: 'google', label: 'Google Pay', icon: 'google' })
  options.push({ id: 'card', label: 'Card', icon: 'card' })
  const cur = options.find(o => o.id === payMethod) ?? options[0]
  return (
    <CardBlock eyebrow="Payment" title={cur.label} onEdit={() => setOpen(o => !o)}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {!open ? null : (
          <View style={{ borderTopWidth: 1, borderTopColor: T.line, borderStyle: 'dashed', marginTop: 6, paddingTop: 8 }}>
            {options.map((o, i) => {
              const active = o.id === payMethod
              return (
                <Pressable
                  key={o.id}
                  onPress={() => { onChange(o.id); setOpen(false) }}
                  style={[styles.payRow, i === 0 && { borderTopWidth: 0 }]}
                >
                  <View style={styles.payIconBox}>
                    <Icon name={o.icon} size={14} color={T.ink} />
                  </View>
                  <Text style={styles.payLabel}>{o.label}</Text>
                  <View style={[styles.radioOuter, active && { borderColor: T.brand, backgroundColor: T.brand }]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </CardBlock>
  )
}
```

```tsx
function NotesBlock({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <CardBlock eyebrow="Notes for barista" title="Anything special?">
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="e.g. less ice, extra pearls, gift wrap"
          placeholderTextColor={T.ink3}
          multiline
          numberOfLines={2}
          style={styles.notesInput}
        />
      </View>
    </CardBlock>
  )
}
```

```tsx
function SummaryBlock({
  subtotal, welcome, rewardDiscount,
}: {
  subtotal: number
  welcome: { amountCents: number; percentage: number; coveredCount: number } | null
  rewardDiscount: number
}) {
  const discountTotal = (welcome?.amountCents ?? 0) + rewardDiscount
  const total = Math.max(subtotal - discountTotal, 0)
  return (
    <View style={styles.summaryCard}>
      <SummaryRow label="Subtotal" amountCents={subtotal} muted />
      {welcome && welcome.amountCents > 0 && (
        <SummaryRow
          label={`Welcome ${welcome.percentage}% off (${welcome.coveredCount} drink${welcome.coveredCount === 1 ? '' : 's'})`}
          amountCents={-welcome.amountCents}
          muted
        />
      )}
      {rewardDiscount > 0 && (
        <SummaryRow label="Reward discount" amountCents={-rewardDiscount} muted />
      )}
      <View style={styles.summaryDivider} />
      <SummaryRow label="Total" amountCents={total} bold />
    </View>
  )
}

function SummaryRow({
  label, amountCents, bold, muted,
}: { label: string; amountCents: number; bold?: boolean; muted?: boolean }) {
  const sign = amountCents < 0 ? '−' : ''
  const abs = Math.abs(amountCents)
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryLabelBold, muted && styles.summaryLabelMuted]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold, muted && styles.summaryValueMuted]}>
        {sign}{formatPrice(abs)}
      </Text>
    </View>
  )
}
```

- [ ] **Step 10: Styles**

Compile one `StyleSheet.create({...})` at the bottom. Use `T` / `FONT` tokens only. Do not import `BRAND`. Do not import `Ionicons`. Sticky CTA uses `SHADOW.primaryCta` via `Platform.select`.

- [ ] **Step 11: tsc + lint**

```bash
npx tsc --noEmit
# exit 0

npm run lint -- app/checkout.tsx components/checkout/CardBlock.tsx components/checkout/OrderPlaced.tsx hooks/use-create-order.ts components/brand/Icon.tsx 2>&1 | tail -20
# expected: no new warnings beyond pre-existing
```

- [ ] **Step 12: Grep guards**

```bash
# 0 expected
grep -n "from '@expo/vector-icons'" app/checkout.tsx
# 0 expected
grep -n "BRAND" app/checkout.tsx components/checkout/CardBlock.tsx components/checkout/OrderPlaced.tsx
# 1 expected (Stack.Screen options inline)
grep -n "Stack.Screen" app/checkout.tsx
# 0 expected (the new path is router.replace('/(tabs)/order'))
grep -n "/order-confirmation" app/checkout.tsx
```

- [ ] **Step 13: Phase 3d WIP diff**

```bash
git status --porcelain | sort > /tmp/phase7-task5-wip.txt
diff /tmp/phase7-task0-wip.txt /tmp/phase7-task5-wip.txt
# expected: only additions for currently-unstaged Phase 7 files in this task
# NO modifications to the 13 Phase 3d paths
```

- [ ] **Step 14: Commit**

```bash
git add app/checkout.tsx
git commit -m "feat(checkout): rewrite to Phase 7 tokens + stacked CardBlocks

- Inline sticky header (back chip + 'CHECKOUT' eyebrow + Fraunces
  title + mono total), override stack header via <Stack.Screen>
  options inside the screen (no touch to app/_layout.tsx).
- Stacked CardBlocks: Pickup store (display-only Southport), Pickup
  time (display-only ASAP), Your order (CupArt thumb + grouped
  modifier summary), Rewards (progress bar or Apply toggle +
  welcome-discount hint), Payment (onEdit radio list), Notes for
  barista (TextInput, wired via useCreateOrder note param),
  Summary (subtotal + discounts + dashed divider + bold total).
- Sticky Place-order CTA with payment-method eyebrow + mono total
  chip; T.ink bg + SHADOW.primaryCta.
- OrderPlaced overlay replaces router.replace('/order-confirmation')
  — animates in place, 'Track my order' CTA routes to /(tabs)/order.
- Keeps 100% of existing data wiring: Supabase auth gate, Square
  Payments SDK (Apple / Google / Card + verifyBuyer unchanged),
  loyalty reward redemption, welcome-discount cheapest-K algorithm,
  free-order path, PaymentErrorDialog, lastOrder:items persistence.
- Ionicons + BRAND imports removed from the file.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Delete `components/checkout/OrderSummary.tsx`

**Files:**
- Delete: `components/checkout/OrderSummary.tsx`

**Purpose:** After Task 5, nothing else imports `OrderSummary`. Remove the dead file per "No backwards-compatibility shims" project rule.

- [ ] **Step 1: Grep to confirm zero callers**

```bash
grep -rn "OrderSummary" --include='*.tsx' --include='*.ts' app components hooks store lib
# Expected: no matches (it's OK to see matches in docs/superpowers/** — those are plans/specs).
```

If any app-code matches remain, **stop**. Retain the file and skip this task.

- [ ] **Step 2: Delete**

```bash
git rm components/checkout/OrderSummary.tsx
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(checkout): remove legacy OrderSummary component

Phase 7's app/checkout.tsx rewrite no longer imports
components/checkout/OrderSummary. No other code path referenced it
(grep verified). Removing avoids a dead module.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Final verification

**Purpose:** Confirm Phase 7 didn't regress anything and Phase 3d WIP is untouched.

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
# exit 0
```

- [ ] **Step 2: Lint baseline check**

```bash
npm run lint 2>&1 | tail -6
# expected: still 1 error + 4 warnings (same as Task 0 baseline)
# new Phase 7 files should contribute 0 warnings/errors
```

- [ ] **Step 3: Phase 3d WIP byte-identity**

```bash
git status --porcelain | sort > /tmp/phase7-final-wip.txt
diff /tmp/phase7-task0-wip.txt /tmp/phase7-final-wip.txt
# expected: empty diff (no changes to tracked/untracked WIP paths; no new WIP added)
```

- [ ] **Step 4: Forbidden-import guard on Phase 7 files**

```bash
for f in app/checkout.tsx components/checkout/CardBlock.tsx components/checkout/OrderPlaced.tsx hooks/use-create-order.ts components/brand/Icon.tsx; do
  echo "=== $f ==="
  grep -cE "from '@expo/vector-icons'|import.*BRAND" "$f" || true
done
# expected: 0 for every file (grep -c prints 0 when no match)
```

- [ ] **Step 5: Behavior scene check (grep not-touched files)**

```bash
# order-confirmation route still mounted
grep -n "order-confirmation" app/_layout.tsx
# expected: 1 match (the Stack.Screen line)

# checkout.tsx no longer references order-confirmation
grep -n "order-confirmation" app/checkout.tsx
# expected: 0 matches

# my-orders tab still exists (Phase 5)
grep -n "ActiveOrderCard" app/(tabs)/order.tsx
# expected: at least 1 match
```

- [ ] **Step 6: Count commits**

```bash
git log --oneline 00ce2de..HEAD
# expected: roughly
#   <task 7 no commit>
#   <task 6 OrderSummary delete>
#   <task 5 checkout rewrite>
#   <task 4 useCreateOrder>
#   <task 3 OrderPlaced>
#   <task 2 CardBlock>
#   <task 1 icons>
# plus the spec and plan commits before 00ce2de.
```

- [ ] **Step 7: No commit** — verification only.

- [ ] **Step 8: On-device smoke checklist (user action)**

- [ ] iOS: open checkout with 1 item, 3 items, 1 item + toppings; header sticky + formatPrice total reflects live
- [ ] iOS Apple Pay path: verifyBuyer → success → OrderPlaced animates in → "Track my order" → `/(tabs)/order` Active card
- [ ] iOS Card path: native sheet → success path
- [ ] iOS free-order path: reward toggle on, 1-drink cart → amountCents ≤ 0 → skips SDK → OrderPlaced with "+0" stars (loyaltyAccrued false) + total A$0.00
- [ ] Welcome-discount path: fresh Supabase user, 3 drinks → Summary card shows "Welcome 30% off (2 drinks) −A$X.XX" → total reflects; post-pay, home banner + account card consume
- [ ] Android Google Pay path: Google Pay sheet → success
- [ ] Android Card path: Square card sheet → success
- [ ] Android Notes: soft keyboard pushes up, textarea doesn't collapse
- [ ] Notes textarea non-empty: Square Dashboard shows order `note` = "OL8XX — user text"
- [ ] Payment error (kill network mid-pay): PaymentErrorDialog appears, Retry re-runs `handlePay`
- [ ] Auth gate: sign out → `/(tabs)/checkout` shows SignInCard + SimpleSummaryBlock
- [ ] Back button: maps back to cart sheet (router.back) or `/(tabs)/menu` fallback

- [ ] **Step 9: Update DEV_QUEUE.md + DEV_HANDOFF.md** (controller, not subagent)

Add a Recently Completed entry in `~/system/DEV_QUEUE.md` summarizing the 7 commits + verification + on-device smoke items. Prepend a new session header in `~/system/DEV_HANDOFF.md`.

---

## Done criteria

- 7 feature/docs commits on main (2 docs already in — spec + plan — plus 5 feature commits from Tasks 1/2/3/4/5 and optionally 1 cleanup from Task 6).
- Task 7 Step 3 reports empty diff for Phase 3d WIP.
- Task 7 Step 2 reports unchanged lint baseline.
- tsc exit 0 at every task boundary.
- All on-device smoke checks pass (recorded in handoff by the user).
