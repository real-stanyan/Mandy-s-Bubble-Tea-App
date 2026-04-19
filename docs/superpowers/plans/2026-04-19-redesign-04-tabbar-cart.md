# Phase 4 — Tab Bar + Mini-Cart + Cart Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the bottom tab bar, floating mini-cart pill, and cart bottom-sheet modal to Phase 1 design tokens; hoist MiniCartBar + CartSheet to a single mount on the tabs layout so the pill shows on all four tabs; delete the dormant `app/(tabs)/cart.tsx` screen and now-orphan `components/cart/EmptyCart.tsx`.

**Architecture:** Pure re-skin + mount-topology shuffle — no new data flow, no new store, no new components. Replace `Ionicons` + `BRAND` with `<Icon>` + `T` tokens in 4 touched files; add `useBottomTabBarHeight()` positioning to MiniCartBar; remove the hidden cart Tabs.Screen; migrate `<CartSheet />` from root `app/_layout.tsx` (stash-isolated because of Phase 3d WIP) to `app/(tabs)/_layout.tsx`.

**Tech Stack:** React Native 0.81 + Expo SDK 54, `@gorhom/bottom-sheet`, `expo-router` (Tabs), `@react-navigation/bottom-tabs` (`useBottomTabBarHeight`), `react-native-reanimated` (existing pulse/entrance anims preserved byte-identical), `react-native-svg` (via Phase 1 `<Icon>` / `<CupArt>`). No tests — validation via `npx tsc --noEmit`, `npm run lint`, and on-device smoke.

**Testing strategy:** This repo has no unit test suite (no `__tests__` outside `node_modules`). Every task validates via `npx tsc --noEmit`, `npm run lint` (no new warnings), grep invariants for BRAND/Ionicons count, and on-device / simulator confirmation of the behaviours in spec §"Success criteria". Do NOT introduce Jest or a new test runner in this phase.

**WIP preservation (CRITICAL):** Phase 3d (Supabase Auth) work-in-progress MUST remain byte-identical through every commit. These 8 modified + 6 untracked paths must survive unchanged:

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

Only **Task 5** touches `app/_layout.tsx`; that task is stash-isolated. Every `git add` command in this plan names specific files only. **Never** run `git add -A`, `git add .`, `git commit -a`, or `git add <directory>/`. After each task, verify `git status --short` still lists exactly the 14 paths above (plus any files under active edit in-task) as uncommitted.

**Reference spec:** `docs/superpowers/specs/2026-04-19-redesign-04-tabbar-cart.md`

**Design reference files** (read-only context for visual fidelity):
- Tab bar — `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/shared.jsx:212-245`
- MiniCart pill — `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/App.jsx:142-174`
- CartSheet — `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/App.jsx:14-140`

---

## File Structure

Files modified in this phase:

- `components/cart/CartItem.tsx` — full re-skin: 44×44 thumbnail with `<CupArt>` fallback, stepper pill, `T.*` tokens, `TYPE.priceSm` / JetBrains Mono weights; drop `Ionicons`
- `components/cart/MiniCartBar.tsx` — style tokens (`T.brand`, `FONT.inter`), `<Icon name="bag" />`, position via `useBottomTabBarHeight()`, shadow from `SHADOW.miniCart`; reanimated pulse/entrance/exit preserved byte-identical
- `components/cart/CartSheet.tsx` — new header (eyebrow + Fraunces count), dashed total divider, double CTA footer (transparent "Keep browsing" outline + ink dark "Checkout →"); drop `Ionicons`, drop `BRAND`
- `app/(tabs)/_layout.tsx` — full rewrite: `<Icon>` replaces `Ionicons`, `T.*` replaces `BRAND`, mount `<CartSheet />` + `<MiniCartBar />` as layout-level siblings, remove `<Tabs.Screen name="cart" />`
- `app/(tabs)/index.tsx` — remove `<MiniCartBar />` mount + import (now mounted globally)
- `app/(tabs)/menu.tsx` — remove `<MiniCartBar />` mount + import (now mounted globally)
- `app/_layout.tsx` — remove `<CartSheet />` mount + import (hoisted to tabs layout); **stash-isolated** due to Phase 3d WIP

Files deleted in this phase:

- `app/(tabs)/cart.tsx` — legacy `FlatList` stub that was already hidden via `href: null`
- `components/cart/EmptyCart.tsx` — orphan after `cart.tsx` deletion (not referenced by CartSheet's auto-close behaviour)

No new files, no moves, no renames. `BRAND` in `lib/constants.ts` stays — Phase 7 is the eventual remover.

---

## Task 0: Preflight — baselines + WIP sanity

**Purpose:** Record the starting state so later tasks have hard pass/fail criteria. Confirms the working tree matches the Phase 3d WIP manifest, captures the lint warning baseline, and records current BRAND/Ionicons grep counts.

**Files:**
- Read only, no writes

- [ ] **Step 1: Confirm the Phase 3d WIP file list**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected output — these 14 paths (order may vary, no extras):

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

If any extra paths appear, **STOP** and surface to the controller. Do NOT proceed.

- [ ] **Step 2: Capture the Phase 3d byte checksum for `app/_layout.tsx`**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && shasum -a 256 app/_layout.tsx
```

Expected: one line, `<hash>  app/_layout.tsx`. **Save this hash** — it is used at the END of Task 5 to verify the stash pop restored the Phase 3d WIP byte-identically.

- [ ] **Step 3: Capture the lint baseline**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npm run lint 2>&1 | tail -n 5
```

Expected: reports a total warning count. **Record this number** — the final task re-runs lint and confirms the number has not increased.

- [ ] **Step 4: Capture BRAND + Ionicons grep baselines**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  echo "--- BRAND in cart + tabs layout ---" && \
  grep -rln "from '@/lib/constants'" components/cart/ 'app/(tabs)/_layout.tsx' 2>/dev/null ; \
  echo "--- Ionicons in cart + tabs layout ---" && \
  grep -rln "from '@expo/vector-icons'" components/cart/ 'app/(tabs)/_layout.tsx' 2>/dev/null ; \
  echo "--- MiniCartBar imports ---" && \
  grep -rln "MiniCartBar" 'app/(tabs)/' 2>/dev/null
```

Expected:

```
--- BRAND in cart + tabs layout ---
components/cart/CartSheet.tsx
components/cart/EmptyCart.tsx
components/cart/MiniCartBar.tsx
app/(tabs)/_layout.tsx
--- Ionicons in cart + tabs layout ---
components/cart/CartItem.tsx
components/cart/CartSheet.tsx
components/cart/MiniCartBar.tsx
app/(tabs)/_layout.tsx
--- MiniCartBar imports ---
app/(tabs)/menu.tsx
app/(tabs)/index.tsx
```

Any deviation means the working tree has drifted from the spec's assumptions. **STOP** and surface.

- [ ] **Step 5: No commit for this task**

Task 0 is purely observation. Proceed to Task 1.

---

## Task 1: CartItem re-skin (44×44 CupArt thumb + stepper pill)

**Purpose:** Rewrite `components/cart/CartItem.tsx` to the reference design. Pure visual change — no data flow, no new props, no store call changes.

**Files:**
- Modify: `components/cart/CartItem.tsx`

**Reference (do not copy directly, adapt to RN):** `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/App.jsx:55-100`

- [ ] **Step 1: Rewrite the file**

Overwrite `components/cart/CartItem.tsx` with:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useCartStore } from '@/store/cart'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { T, FONT } from '@/constants/theme'
import type { CartItem as CartItemType, CartModifier } from '@/types/square'

interface Props {
  item: CartItemType
}

function groupModifiers(mods: CartModifier[]): Array<{ listName: string; names: string[] }> {
  const byList = new Map<string, string[]>()
  for (const m of mods) {
    const key = m.listName || 'OTHER'
    const arr = byList.get(key) ?? []
    arr.push(m.name)
    byList.set(key, arr)
  }
  return Array.from(byList.entries()).map(([listName, names]) => ({ listName, names }))
}

function titleCase(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function CartItemRow({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const modifierGroups = groupModifiers(item.modifiers ?? [])

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <CupArt size={28} fill={T.brand} stroke={T.ink} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.modifier} numberOfLines={1}>
          <Text style={styles.modifierLabel}>Size:</Text> Large 700ml
        </Text>
        {modifierGroups.map((g) => (
          <Text key={g.listName} style={styles.modifier} numberOfLines={2}>
            <Text style={styles.modifierLabel}>{titleCase(g.listName)}:</Text>{' '}
            {g.names.join(', ')}
          </Text>
        ))}
        <Text style={styles.price}>A${item.price.toFixed(2)}</Text>
      </View>

      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtnMinus}
          onPress={() => updateQuantity(item.lineId, item.quantity - 1)}
          activeOpacity={0.7}
        >
          <Text style={styles.minusText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.stepBtnPlus}
          onPress={() => updateQuantity(item.lineId, item.quantity + 1)}
          activeOpacity={0.7}
        >
          <Icon name="plus" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1EBE4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: FONT.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 16,
  },
  modifier: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 11,
    color: T.ink3,
    lineHeight: 15,
  },
  modifierLabel: { color: T.ink3, fontWeight: '600' },
  price: {
    marginTop: 2,
    fontFamily: FONT.mono,
    fontSize: 12,
    fontWeight: '600',
    color: T.brand,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(42,30,20,0.05)',
    borderRadius: 999,
    padding: 3,
  },
  stepBtnMinus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusText: {
    fontSize: 16,
    fontWeight: '700',
    color: T.ink2,
    lineHeight: 18,
    includeFontPadding: false,
  },
  qty: {
    minWidth: 14,
    textAlign: 'center',
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
  },
})
```

- [ ] **Step 2: Typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit 2>&1 | tail -n 20
```

Expected: no new errors. Pre-existing errors (if any) must be unchanged.

- [ ] **Step 3: Lint the touched file**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx eslint components/cart/CartItem.tsx
```

Expected: exit 0, no warnings (this file previously had 0 warnings; see Task 0 baseline).

- [ ] **Step 4: Verify Ionicons + BRAND fully removed from this file**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -n "Ionicons\|BRAND\|@expo/vector-icons" components/cart/CartItem.tsx
```

Expected: zero matches (grep exits 1). If any line is returned, fix before committing.

- [ ] **Step 5: Verify Phase 3d WIP is byte-identical**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: same 14 paths as Task 0, plus `M components/cart/CartItem.tsx`. No other files.

- [ ] **Step 6: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app && git add components/cart/CartItem.tsx && \
  git commit -m "$(cat <<'EOF'
feat(cart): re-skin CartItemRow to Phase 4 tokens

- 44×44 CupArt fallback thumb with cream bg
- stepper pill (− white / qty mono / + brand)
- Inter name + mono price, T.* tokens
- drop Ionicons

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: MiniCartBar re-skin + tab-bar-aware positioning

**Purpose:** Style-migrate the pill to `T.brand` + `<Icon>` + `FONT.inter` + `SHADOW.miniCart`, and change its bottom offset from the current hardcoded `bottom: 8` to `useBottomTabBarHeight() + 8` so it sits cleanly above the real tab bar on both iOS (honours safe area) and Android.

**Files:**
- Modify: `components/cart/MiniCartBar.tsx`

**Reference:** `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/App.jsx:142-174`

- [ ] **Step 1: Rewrite the file**

Overwrite `components/cart/MiniCartBar.tsx` with:

```tsx
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export function MiniCartBar() {
  const itemCount = useCartStore((s) => s.itemCount())
  const total = useCartStore((s) => s.total())
  const show = useCartSheetStore((s) => s.show)
  const tabBarHeight = useBottomTabBarHeight()

  const barScale = useSharedValue(1)
  const badgeScale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  useAnimatedReaction(
    () => itemCount,
    (curr, prev) => {
      if (prev === null) return
      if (curr === 0) {
        opacity.value = withTiming(0, { duration: 160 })
        translateY.value = withTiming(30, { duration: 160 })
        return
      }
      if (prev === 0 && curr > 0) {
        translateY.value = 40
        opacity.value = 0
        translateY.value = withSpring(0, { damping: 14, stiffness: 180 })
        opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
      }
      if (curr > prev) {
        cancelAnimation(barScale)
        cancelAnimation(badgeScale)
        barScale.value = 1
        badgeScale.value = 1
        barScale.value = withSequence(
          withTiming(1.04, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        )
        badgeScale.value = withSequence(
          withTiming(1.2, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        )
      }
    },
    [itemCount],
  )

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: barScale.value }],
    opacity: opacity.value,
  }))

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }))

  if (itemCount === 0) return null

  return (
    <View
      style={[styles.wrap, { bottom: tabBarHeight + 8 }]}
      pointerEvents="box-none"
    >
      <AnimatedTouchable style={[styles.bar, barStyle]} onPress={show} activeOpacity={0.85}>
        <View style={styles.bagWrap}>
          <Icon name="bag" size={20} color="#fff" />
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </Animated.View>
        </View>
        <Text style={styles.total}>A${total.toFixed(2)}</Text>
        <View style={styles.spacer} />
        <View style={styles.checkoutBtn}>
          <Text style={styles.checkoutText}>View Cart</Text>
        </View>
      </AnimatedTouchable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brand,
    borderRadius: 28,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#6B3E15',
        shadowOpacity: 0.55,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }),
  },
  bagWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FONT.sans,
    color: T.brand,
    fontSize: 10,
    fontWeight: '800',
  },
  total: {
    fontFamily: FONT.sans,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  checkoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
  },
  checkoutText: {
    fontFamily: FONT.sans,
    color: T.brand,
    fontSize: 13,
    fontWeight: '700',
  },
})
```

- [ ] **Step 2: Typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit 2>&1 | tail -n 20
```

Expected: no new errors.

- [ ] **Step 3: Lint the touched file**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx eslint components/cart/MiniCartBar.tsx
```

Expected: exit 0.

- [ ] **Step 4: Verify `Ionicons` + `BRAND` fully removed**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -n "Ionicons\|BRAND\|@expo/vector-icons\|@/lib/constants" components/cart/MiniCartBar.tsx
```

Expected: zero matches (grep exits 1).

- [ ] **Step 5: Verify `useBottomTabBarHeight` is the only positioning source**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && grep -n "bottom: 8\|bottom: 82\|bottom: '" components/cart/MiniCartBar.tsx
```

Expected: zero matches. Bottom position comes only from the inline `{ bottom: tabBarHeight + 8 }` style.

- [ ] **Step 6: Verify Phase 3d WIP unchanged**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: 14 original paths + `M components/cart/MiniCartBar.tsx`.

- [ ] **Step 7: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app && git add components/cart/MiniCartBar.tsx && \
  git commit -m "$(cat <<'EOF'
feat(cart): re-skin MiniCartBar to Phase 4 tokens + tab-bar-aware bottom

- T.brand + FONT.inter + SHADOW.miniCart shadow stack
- <Icon name="bag" /> replaces Ionicons
- bottom offset = useBottomTabBarHeight() + 8 (works on both platforms)
- reanimated pulse / entrance / exit preserved

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: CartSheet re-skin (eyebrow header + dashed total + double CTA)

**Purpose:** Rewrite the body inside the `BottomSheetModal` to match the reference. The modal shell (`BottomSheetModal` / `BottomSheetScrollView` / `BottomSheetBackdrop`) and the `useCartSheetStore` wiring are preserved byte-identical. Auto-close on empty stays.

**Files:**
- Modify: `components/cart/CartSheet.tsx`

**Reference:** `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/App.jsx:14-140`

- [ ] **Step 1: Rewrite the file**

Overwrite `components/cart/CartSheet.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { CartItemRow } from './CartItem'
import { Icon } from '@/components/brand/Icon'
import { T, FONT, RADIUS } from '@/constants/theme'

export function CartSheet() {
  const open = useCartSheetStore((s) => s.open)
  const hide = useCartSheetStore((s) => s.hide)
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const ref = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['75%'], [])

  useEffect(() => {
    if (open) ref.current?.present()
    else ref.current?.dismiss()
  }, [open])

  // Auto-close when cart becomes empty (Phase 4 spec: problem-3 decision A).
  useEffect(() => {
    if (open && items.length === 0) hide()
  }, [items.length, open, hide])

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) hide()
    },
    [hide],
  )

  const handleCheckout = useCallback(() => {
    hide()
    router.push('/checkout')
  }, [hide, router])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  )

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const disabled = items.length === 0

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR CART</Text>
          <Text style={styles.title}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {items.length > 0 ? (
          <TouchableOpacity onPress={clearCart} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((item) => (
          <CartItemRow key={item.lineId} item={item} />
        ))}

        {items.length > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>A${total.toFixed(2)}</Text>
          </View>
        ) : null}
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <TouchableOpacity style={styles.keepBtn} onPress={hide} activeOpacity={0.8}>
          <Text style={styles.keepText}>Keep browsing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutBtn, disabled && styles.checkoutBtnDisabled]}
          onPress={handleCheckout}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
          <Icon name="arrow" size={14} color={T.cream} />
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: T.paper,
    borderTopLeftRadius: RADIUS.sheetTop,
    borderTopRightRadius: RADIUS.sheetTop,
  },
  sheetHandle: {
    backgroundColor: T.ink4,
    width: 40,
    height: 4,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: T.brand,
  },
  title: {
    marginTop: 4,
    fontFamily: FONT.serif,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.6,
    color: T.ink,
    lineHeight: 29,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: {
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '600',
    color: T.ink3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
  },
  totalRow: {
    marginTop: 8,
    marginHorizontal: -8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: T.line,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: T.ink3,
  },
  totalValue: {
    fontFamily: FONT.mono,
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: T.paper,
  },
  keepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.line,
  },
  keepText: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '600',
    color: T.ink2,
  },
  checkoutBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  checkoutBtnDisabled: {
    backgroundColor: T.ink4,
  },
  checkoutText: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: T.cream,
  },
})
```

- [ ] **Step 2: Typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit 2>&1 | tail -n 20
```

Expected: no new errors.

- [ ] **Step 3: Lint the touched file**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx eslint components/cart/CartSheet.tsx
```

Expected: exit 0.

- [ ] **Step 4: Verify Ionicons + BRAND fully removed**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -n "Ionicons\|BRAND\|@expo/vector-icons\|@/lib/constants" components/cart/CartSheet.tsx
```

Expected: zero matches.

- [ ] **Step 5: Verify Phase 3d WIP unchanged**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: 14 original paths + `M components/cart/CartSheet.tsx`.

- [ ] **Step 6: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app && git add components/cart/CartSheet.tsx && \
  git commit -m "$(cat <<'EOF'
feat(cart): re-skin CartSheet to Phase 4 tokens

- eyebrow YOUR CART + Fraunces 26 count headline
- dashed total divider, JetBrains Mono total
- double CTA footer: outline Keep browsing + T.ink pill Checkout →
- drop Ionicons, BRAND

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tabs layout rewrite + MiniCartBar hoist + delete legacy cart files

**Purpose:** Rewrite `app/(tabs)/_layout.tsx` to (a) use new `<Icon>` + `T.*` tokens, (b) drop the hidden cart `Tabs.Screen`, (c) mount `<MiniCartBar />` as a layout-level sibling so it shows on all 4 tabs. In the same commit: delete the now-unreachable `app/(tabs)/cart.tsx` and the orphan `components/cart/EmptyCart.tsx`, and remove the per-screen MiniCartBar mounts from `index.tsx` and `menu.tsx` so there is never a double-rendered pill. **Does NOT touch `app/_layout.tsx`** — that is Task 5.

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/menu.tsx`
- Delete: `app/(tabs)/cart.tsx`
- Delete: `components/cart/EmptyCart.tsx`

**Reference:** `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/shared.jsx:212-245`

- [ ] **Step 1: Rewrite `app/(tabs)/_layout.tsx`**

Overwrite with:

```tsx
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import { useAuth } from '@/components/auth/AuthProvider';
import { useOrdersStore } from '@/store/orders';
import { Icon, type IconName } from '@/components/brand/Icon';
import { MiniCartBar } from '@/components/cart/MiniCartBar';
import { T, FONT } from '@/constants/theme';

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} color={color} size={24} />;
}

export default function TabLayout() {
  const { profile } = useAuth();
  const refreshOrders = useOrdersStore((s) => s.refresh);
  const clearOrders = useOrdersStore((s) => s.clear);
  const unfinishedCount = useOrdersStore((s) => s.activeOrderCount);

  useEffect(() => {
    if (profile) refreshOrders();
    else clearOrders();
  }, [profile, refreshOrders, clearOrders]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: T.brand,
          tabBarInactiveTintColor: T.ink3,
          tabBarStyle: {
            backgroundColor: T.paper,
            borderTopColor: T.line,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'android' ? 8 : undefined,
          },
          tabBarLabelStyle: {
            fontFamily: FONT.sans,
            fontSize: 10.5,
            letterSpacing: 0.1,
          },
          tabBarBadgeStyle: {
            backgroundColor: T.brand,
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
          },
          headerStyle: { backgroundColor: T.paper },
          headerTintColor: T.ink,
          headerShown: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color }) => <TabIcon name="cafe" color={color} />,
          }}
        />
        <Tabs.Screen
          name="order"
          options={{
            title: 'My Orders',
            tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color} />,
            tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
          }}
        />
      </Tabs>
      <MiniCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
```

NOTE: `<Tabs.Screen name="cart" />` is deliberately removed. `app/(tabs)/cart.tsx` is deleted in Step 3. Expo Router will not register a screen for a missing file, so no 404 surfaces in the UI.

NOTE: `<CartSheet />` is **not** mounted here yet. It still mounts in `app/_layout.tsx` until Task 5.

- [ ] **Step 2: Remove `MiniCartBar` from `app/(tabs)/index.tsx`**

In `app/(tabs)/index.tsx`, delete the `MiniCartBar` import line and the `<MiniCartBar />` JSX mount. The exact edits:

Remove line:

```tsx
import { MiniCartBar } from '@/components/cart/MiniCartBar';
```

Remove line (near the bottom of the component's return):

```tsx
      <MiniCartBar />
```

Keep everything else identical. After the edit, the file still imports from `@/components/home/*`, `react-native`, etc.

- [ ] **Step 3: Remove `MiniCartBar` from `app/(tabs)/menu.tsx`**

In `app/(tabs)/menu.tsx`, delete the `MiniCartBar` import line and the `<MiniCartBar />` JSX mount (around line 228 in the pre-edit file):

Remove line:

```tsx
import { MiniCartBar } from '@/components/cart/MiniCartBar'
```

Remove line (inside the `return (...)` at end of the component):

```tsx
      <MiniCartBar />
```

Keep everything else identical.

- [ ] **Step 4: Delete the legacy cart tab screen and orphan EmptyCart**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  git rm 'app/(tabs)/cart.tsx' components/cart/EmptyCart.tsx
```

Expected output:

```
rm 'app/(tabs)/cart.tsx'
rm 'components/cart/EmptyCart.tsx'
```

- [ ] **Step 5: Verify no lingering imports of deleted files**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -rln "EmptyCart\|components/cart/EmptyCart\|app/(tabs)/cart" --include='*.ts' --include='*.tsx' . | \
  grep -v node_modules | grep -v docs/
```

Expected: zero matches (grep exits 1). If any match returns, fix it before continuing — most likely a stray import in a file this plan didn't anticipate.

- [ ] **Step 6: Verify MiniCartBar is no longer mounted per-screen**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && grep -rn "MiniCartBar" 'app/(tabs)/'
```

Expected: exactly one line — the mount inside `app/(tabs)/_layout.tsx`. No mounts in `index.tsx` or `menu.tsx`.

- [ ] **Step 7: Typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit 2>&1 | tail -n 20
```

Expected: no new errors. Pre-existing errors (if any) unchanged.

- [ ] **Step 8: Lint the touched files**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  npx eslint 'app/(tabs)/_layout.tsx' 'app/(tabs)/index.tsx' 'app/(tabs)/menu.tsx'
```

Expected: exit 0, no new warnings.

- [ ] **Step 9: Verify `BRAND` + `Ionicons` removed from tabs layout**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -n "Ionicons\|BRAND\|@expo/vector-icons\|@/lib/constants" 'app/(tabs)/_layout.tsx'
```

Expected: zero matches.

- [ ] **Step 10: Verify Phase 3d WIP byte-identical**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: 14 original paths + exactly these edits for Task 4:

```
 M app/(tabs)/_layout.tsx
 M app/(tabs)/index.tsx
 M app/(tabs)/menu.tsx
 D app/(tabs)/cart.tsx
 D components/cart/EmptyCart.tsx
```

- [ ] **Step 11: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app && \
  git add 'app/(tabs)/_layout.tsx' 'app/(tabs)/index.tsx' 'app/(tabs)/menu.tsx' && \
  git add -u 'app/(tabs)/cart.tsx' 'components/cart/EmptyCart.tsx' && \
  git commit -m "$(cat <<'EOF'
feat(tabs): rewrite tab bar to Phase 4 tokens + hoist MiniCartBar

- tab bar: <Icon> replaces Ionicons, T.paper bg, T.brand active, FONT.inter labels
- mount <MiniCartBar /> globally so pill shows on all 4 tabs
- remove dormant <Tabs.Screen name="cart">
- delete app/(tabs)/cart.tsx (legacy FlatList stub, href:null)
- delete components/cart/EmptyCart.tsx (orphan after cart.tsx removed)
- drop per-screen MiniCartBar mounts from index.tsx + menu.tsx

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Hoist `<CartSheet />` from root layout to tabs layout (stash-isolated)

**Purpose:** Move the `<CartSheet />` mount out of `app/_layout.tsx` (which has Phase 3d WIP) and into `app/(tabs)/_layout.tsx`. The root file is stash-isolated — we stash the Phase 3d WIP, edit on a clean main state, commit, then stash pop to restore the WIP. If pop conflicts, bail and surface.

**Files:**
- Modify: `app/_layout.tsx` (stash-isolated; Phase 3d WIP file)
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Stash-isolate the Phase 3d WIP in `app/_layout.tsx`**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git stash push -- app/_layout.tsx
```

Expected output: one line like `Saved working directory and index state WIP on main: <hash> <subject>`.

Verify the working tree is now at HEAD for that file:

```bash
cd ~/Github/mandys_bubble_tea_app && git diff app/_layout.tsx | wc -l
```

Expected: `0` (no diff).

Verify the stash has something in it:

```bash
cd ~/Github/mandys_bubble_tea_app && git stash list | head -1
```

Expected: one entry referencing `app/_layout.tsx`.

- [ ] **Step 2: Remove `<CartSheet />` import + mount from `app/_layout.tsx`**

Remove the import line:

```tsx
import { CartSheet } from '@/components/cart/CartSheet';
```

Remove the JSX line (around line 154 in the stashed-HEAD state, inside the `<AuthGate>`...`</AuthGate>` block, right after `<ItemDetailSheet />`):

```tsx
          <CartSheet />
```

Keep every other line in this file byte-identical. Do NOT re-format, do NOT reorder imports, do NOT touch the auth wiring.

- [ ] **Step 3: Add `<CartSheet />` mount to `app/(tabs)/_layout.tsx`**

Open `app/(tabs)/_layout.tsx` (just written in Task 4) and add a single import:

```tsx
import { CartSheet } from '@/components/cart/CartSheet';
```

And add `<CartSheet />` as a sibling of `<MiniCartBar />` inside the root `<View>`:

```tsx
      <MiniCartBar />
      <CartSheet />
    </View>
```

Order matters: `<MiniCartBar />` first, then `<CartSheet />`. Both are inside the `View style={styles.root}` and outside `<Tabs>`.

- [ ] **Step 4: Typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit 2>&1 | tail -n 20
```

Expected: no new errors.

- [ ] **Step 5: Lint touched files**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  npx eslint app/_layout.tsx 'app/(tabs)/_layout.tsx'
```

Expected: exit 0.

- [ ] **Step 6: Verify exactly 2 edited files at this commit (pre-pop)**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected (remaining 13 Phase 3d paths + 2 new edits — note `app/_layout.tsx` shows `M` from the stash-and-remove, not from WIP):

```
 M app/(tabs)/account.tsx
 M app/(tabs)/_layout.tsx
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

Total: 14 entries (13 WIP paths unchanged + `app/_layout.tsx` still `M` because we just edited it post-stash + `app/(tabs)/_layout.tsx` edited).

- [ ] **Step 7: Commit the hoist**

```bash
cd ~/Github/mandys_bubble_tea_app && \
  git add app/_layout.tsx 'app/(tabs)/_layout.tsx' && \
  git commit -m "$(cat <<'EOF'
feat(cart): hoist CartSheet mount from root to tabs layout

Keeps sheet modal logic within the tab shell. Checkout and pushed screens
no longer carry an unused CartSheet render. Part of Phase 4.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Pop the Phase 3d stash back**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git stash pop
```

**Happy path output**:

```
On branch main
Changes not staged for commit:
  ...
  modified:   app/_layout.tsx
  ...
Dropped refs/stash@{0} (<hash>)
```

**If conflict** (unlikely — the removed CartSheet lines are far from the auth wrapper region, but possible): the output will mention `CONFLICT (content)`. In that case:

1. `cd ~/Github/mandys_bubble_tea_app && git status` — inspect.
2. Open `app/_layout.tsx` and resolve conflict markers. The goal: keep the Phase 3d WIP (auth stack wrapper additions) AND the Task 5 deletion (no `<CartSheet />` import or mount).
3. `git add app/_layout.tsx` to mark resolved — do NOT commit. The stashed diff is now in working tree.
4. `git stash drop` to remove the now-applied stash entry.
5. Continue to Step 9.

- [ ] **Step 9: Verify Phase 3d WIP byte-identical to Task 0 baseline**

The saved SHA-256 hash from Task 0 applied to a file with the `<CartSheet />` import + mount present. After Task 5 the file no longer has those lines. So the hash WILL differ.

Instead verify: the Phase 3d WIP *diff against the new HEAD* is equivalent to the original *diff against the old HEAD*, minus the CartSheet lines.

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git diff app/_layout.tsx | head -80
```

Expected: shows only Phase 3d auth wrapper additions — e.g., AuthGate usage changes, legal gating, login route. Should NOT show any line with `CartSheet` (neither added nor removed — that hunk was committed out).

Then check that the Phase 3d WIP is still inside the file in its expected shape:

```bash
cd ~/Github/mandys_bubble_tea_app && grep -c "AuthGate\|login\|legal" app/_layout.tsx
```

Expected: a positive count matching the pre-Phase-4 grep count for the same tokens. Controller: compare against Task 0 by running `grep -c "AuthGate\|login\|legal" <stashed-HEAD-version-of-file>` via `git show HEAD^:app/_layout.tsx` (before Task 5 commit) if uncertain.

- [ ] **Step 10: Final git status sanity**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: exactly the 14 original WIP paths. Nothing else.

---

## Task 6: Final verification — tsc, lint, grep invariants, on-device manual check

**Purpose:** Prove every success criterion in the spec.

**Files:**
- Read only.

- [ ] **Step 1: Clean typecheck**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 2: Lint — no new warnings vs Task 0 baseline**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && npm run lint 2>&1 | tail -n 5
```

Expected: total warning count ≤ the number recorded in Task 0 Step 3. If higher, identify the new warning and fix (most likely cause: an unused import left behind).

- [ ] **Step 3: BRAND invariant — zero BRAND imports in Phase 4 scope**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -rn "from '@/lib/constants'" components/cart/ 'app/(tabs)/_layout.tsx' 2>/dev/null
```

Expected: zero matches. BRAND import count **before = 4**, **after = 0**.

- [ ] **Step 4: Ionicons invariant — zero Ionicons imports in Phase 4 scope**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -rn "from '@expo/vector-icons'" components/cart/ 'app/(tabs)/_layout.tsx' 2>/dev/null
```

Expected: zero matches.

- [ ] **Step 5: Deletion invariant — no orphan imports of deleted files**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  grep -rn "EmptyCart\|components/cart/EmptyCart" --include='*.ts' --include='*.tsx' . | \
  grep -v node_modules | grep -v docs/
```

Expected: zero matches.

- [ ] **Step 6: Mount invariant — exactly one `<MiniCartBar />` and one `<CartSheet />` in the codebase**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && \
  echo "--- MiniCartBar mounts ---" && \
  grep -rln "<MiniCartBar" --include='*.tsx' . | grep -v node_modules | grep -v docs/ && \
  echo "--- CartSheet mounts ---" && \
  grep -rln "<CartSheet" --include='*.tsx' . | grep -v node_modules | grep -v docs/
```

Expected: each section returns exactly one file — `app/(tabs)/_layout.tsx` for both. (The component definitions themselves are in `components/cart/*.tsx` and use `export function MiniCartBar` / `export function CartSheet` — the `<...` angle-bracket usage grep only finds JSX mount sites.)

- [ ] **Step 7: Phase 3d WIP byte invariant**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short | wc -l
```

Expected: `14`.

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected: the exact 14-path list from Task 0.

- [ ] **Step 8: On-device / simulator smoke (iOS)**

Manual verification checklist — run the Expo dev build on an iOS simulator or device. For EACH item below, confirm behaviour matches; if any fails, revisit the relevant task.

1. Launch app → Home tab → cart empty → **no pill visible**; tab bar shows 4 tabs with new icons (home filled-safe, cafe, receipt, user), label font is Inter 10.5, active = brick `T.brand`, inactive = muted `T.ink3`. Tab bar background is cream `T.paper`, hairline top border.
2. Navigate to Menu → tap one drink → customise → Add → **pill slides up** from 8px above tab bar, bag icon + count "1" + "A$X.XX" + white "View Cart" chip.
3. Add a second drink → pill count updates with a subtle pulse animation; bar scales briefly.
4. Switch to My Orders tab → **pill still visible in the same position**.
5. Switch to Account tab → **pill still visible** (Account is Phase 3d WIP; MiniCartBar is visual-only, doesn't touch account logic).
6. Tap pill → sheet rises with eyebrow "YOUR CART" (brick), Fraunces "2 items" title, Clear on the right.
7. Scroll sheet → items render with 44×44 cream thumb showing either image or CupArt, modifier lines in muted, price in brick mono, stepper pill (− white / qty mono / + brand).
8. Tap `+` on one row → qty goes to 2, pill total bumps, pulse animation fires.
9. Tap `−` on a qty-1 row → row removes; sheet stays open if items > 0; auto-closes when items = 0.
10. Add item again → tap pill → tap **Clear** → items gone → sheet auto-closes → pill disappears with fade+slide.
11. Add item again → tap pill → tap **Keep browsing** → sheet closes, pill still visible.
12. Add item → tap pill → tap **Checkout →** (ink-dark pill, cream text + arrow) → sheet closes, `/checkout` screen opens, **no pill on checkout screen**, no stray CartSheet.
13. Drag the sheet handle down → sheet dismisses normally.
14. Pull down from sheet header with some items → sheet closes; re-tap pill → sheet reopens with items intact.

- [ ] **Step 9: On-device smoke (Android)**

Run the same 14-step checklist on an Android device or emulator, paying extra attention to:

- Tab bar `paddingBottom: 8` looks correct (no gap between bar and gesture nav).
- Pill shadow renders via `elevation: 8` (visible lift; no blurry iOS shadow halo).
- Keep browsing / Checkout font renders — Inter 14/600 (Keep) and 14/700 (Checkout).

- [ ] **Step 10: Success criteria roll-up — write to run log**

Append to the session's working notes (not committed to repo):

```
Phase 4 complete:
- tsc: clean
- lint: baseline N unchanged (was N before)
- BRAND in cart+tabs-layout: 4 → 0
- Ionicons in cart+tabs-layout: 4 → 0
- MiniCartBar mounts: 2 (index+menu) → 1 (tabs layout)
- CartSheet mounts: 1 (root) → 1 (tabs layout)
- Deleted: app/(tabs)/cart.tsx, components/cart/EmptyCart.tsx
- Phase 3d WIP: byte-identical (14 uncommitted paths)
- iOS manual smoke: PASS
- Android manual smoke: PASS
```

No commit required — Task 6 is pure verification.

---

## Rollback note

If any task fails partway and the subagent cannot recover:

- Tasks 1-3: `git checkout components/cart/<file>.tsx` reverts that file's edits. No stash to recover.
- Task 4: `git reset --hard HEAD~1` if the commit is problematic; then redo from scratch. Phase 3d WIP is not touched in this task, so the reset is safe.
- Task 5: Most delicate. If `git stash pop` in Step 8 fails with a conflict that cannot be resolved in-task:
  1. `git checkout -- app/_layout.tsx` discards the attempted pop.
  2. `git stash pop` again — sometimes succeeds on retry if the working tree was in a weird state.
  3. If still failing: manually inspect `git stash show -p`, copy the Phase 3d diff, apply by hand, `git stash drop`.
  4. Surface to controller before continuing.
