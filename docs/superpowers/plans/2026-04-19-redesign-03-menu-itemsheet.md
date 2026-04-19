# Phase 3 — Menu + ItemSheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `app/(tabs)/menu.tsx`, `components/menu/ItemDetailSheet.tsx`, and `components/menu/ItemDetailContent.tsx` using Phase 1 design tokens + Phase 2's visual vocabulary so Menu and ItemSheet feel coherent with the redesigned Home tab.

**Architecture:** Pure re-skin — no new data flow, no new features. Replace hardcoded colors / fonts / `BRAND` imports / `Ionicons` with `T` / `TYPE` / `RADIUS` / `SHADOW` / `<Icon>`. Two supporting changes: add a `share` glyph to `Icon.tsx`, and add a new `components/brand/color.ts` module exporting a deterministic `hashColor()` for CupArt fallback fills. WIP auth/legal files (Phase 3d) remain byte-identical throughout.

**Tech Stack:** React Native 0.81 + Expo SDK 54, `@gorhom/bottom-sheet`, `expo-image`, `react-native-safe-area-context`, `react-native-reanimated`, `react-native-svg`. No tests — validation is `tsc --noEmit`, `npm run lint`, plus on-device smoke.

**Testing strategy:** This project has no unit test suite (confirmed — no `__tests__` outside `node_modules`). Every task validates via `npx tsc --noEmit`, `npm run lint` on touched files, and for UI tasks: on-device/simulator verification of the behaviors listed in spec §11. Do NOT introduce Jest or a new test runner in this phase.

**WIP preservation (CRITICAL):** Phase 3d (Supabase Auth) work-in-progress MUST remain byte-identical. These 8 modified + 6 untracked paths must survive every commit unchanged:

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

Every `git add` command in this plan names **specific files only**. **Never** run `git add -A`, `git add .`, `git commit -a`, or `git add <directory>/`. After each task, verify `git status --short` still lists exactly those 14 paths (and nothing else) as uncommitted.

**Reference spec:** `docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md`

---

## File Structure

Files created in this phase:

- `components/brand/color.ts` — new utility exporting `hashColor(id: string): string` used by Menu + ItemSheet CupArt fallbacks

Files modified in this phase:

- `components/brand/Icon.tsx` — add `'share'` to `IconName` union + `case 'share':` SVG
- `components/menu/SkeletonCard.tsx` — swap hardcoded `#fff`/`#f5f5f5`/`#e0e0e0`/`#F2E8DF`/`#e0d5ca` for `T` tokens; no structural change
- `components/menu/ItemDetailSheet.tsx` — drag handle, transparent `<Icon>` buttons, `T.line` divider, `backgroundStyle` with `T.paper` + `RADIUS.sheetTop`
- `components/menu/ItemDetailContent.tsx` — full re-skin: fixed 1:1 hero + `hashColor` fallback, Fraunces name, unified Size chip, token-based modifier chips, sticky CTA with live total, skeleton loading, retry-capable error; drop `BRAND` + `ActivityIndicator`
- `app/(tabs)/menu.tsx` — full re-skin: root `T.bg`, pill search bar with `<Icon>`, sidebar + tabs using tokens, section header card (eyebrow + title + banner + overlay), product row 76×76 with `<Icon>` buttons, muted error state; drop `BRAND` + `Ionicons`

No deletions, no moves. `BRAND` stays in `lib/constants.ts` (Phase 7 removes it).

---

## Task 0: Preflight — `hashColor` utility + `share` icon

**Purpose:** Create the two shared primitives the later tasks import. Doing these first means Task 3 and Task 4 can reference them without ordering races.

**Files:**
- Create: `components/brand/color.ts`
- Modify: `components/brand/Icon.tsx`

---

- [ ] **Step 1: Create `components/brand/color.ts`**

Write the complete file:

```ts
import { T } from '@/constants/theme';

const PALETTE = [T.peach, T.cream, T.star, T.brand, T.sage] as const;

// Deterministic color for fallback thumbnails. Same id → same color, always.
// djb2 string hash (`h = h * 33 ^ c`), then mod PALETTE.length.
// @verification
// hashColor('ABC123') === hashColor('ABC123') // deterministic
// PALETTE.includes(hashColor('anything')) // always in palette
export function hashColor(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 33) ^ id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
```

- [ ] **Step 2: Add `'share'` to `IconName` union in `components/brand/Icon.tsx`**

Current line 5-11:
```ts
export type IconName =
  | 'bag' | 'bell' | 'pin' | 'star'
  | 'arrow' | 'arrowL' | 'plus' | 'check'
  | 'search' | 'close'
  | 'home' | 'cafe' | 'receipt' | 'user'
  | 'qr' | 'clock'
  | 'chevR' | 'logout' | 'gift' | 'cup' | 'settings';
```

Change the last line to include `'share'`:
```ts
  | 'chevR' | 'logout' | 'gift' | 'cup' | 'settings' | 'share';
```

- [ ] **Step 3: Add `case 'share':` branch to `Icon.tsx` switch**

Insert a new case just before the closing `}` of the `switch (name)` statement (after `case 'settings':` at line ~230):

```tsx
    case 'share': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 L7 8 M12 3 L17 8 M12 3 V15"
            stroke={c}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M5 13 V19 Q5 21 7 21 H17 Q19 21 19 19 V13"
            stroke={c}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Verify lint on touched files**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx eslint components/brand/color.ts components/brand/Icon.tsx`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Verify WIP still intact**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: exactly the 14 WIP paths listed in the plan header, PLUS the two Phase 3 preflight entries:
```
?? components/brand/color.ts
 M components/brand/Icon.tsx
```
(14 + 2 = 16 entries total)

- [ ] **Step 7: Commit**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git add components/brand/color.ts components/brand/Icon.tsx
git commit -m "$(cat <<'EOF'
feat(phase3): add hashColor util + share icon

Preflight for Phase 3 Menu/ItemSheet re-skin. hashColor() deterministically
picks a palette color from an id string (djb2 mod 5) — used by CupArt
fallback thumbnails. share icon extends Icon.tsx with a standard system
share glyph for the ItemSheet header.

Spec: docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md §9 §10
EOF
)"
```

---

## Task 1: SkeletonCard token swap

**Purpose:** Replace hardcoded colors in the loading skeleton with `T` tokens so it matches the new Menu palette without any structural change.

**Files:**
- Modify: `components/menu/SkeletonCard.tsx`

---

- [ ] **Step 1: Add token import to `SkeletonCard.tsx`**

Current line 1-2:
```ts
import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
```

Append one import line below them:
```ts
import { T } from '@/constants/theme'
```

- [ ] **Step 2: Replace color values in the `styles` object**

In the `StyleSheet.create({ ... })` block (lines ~99-191), swap these exact values.

Replace in `root`:
```ts
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
```
with:
```ts
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
```

Replace in `searchBar`:
```ts
  searchBar: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2E8DF',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
```
with (height 42 to match new real search bar, paper background, pill radius, border):
```ts
  searchBar: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
```

Replace in `searchPlaceholder`:
```ts
    backgroundColor: '#e0d5ca',
```
with:
```ts
    backgroundColor: T.line,
```

Replace in `sidebar`:
```ts
  sidebar: {
    flex: 1,
    backgroundColor: '#F2E8DF',
    paddingVertical: 8,
  },
```
with:
```ts
  sidebar: {
    flex: 1,
    backgroundColor: T.bg,
    paddingVertical: 8,
  },
```

Replace in `tabLine`:
```ts
    backgroundColor: '#e0d5ca',
```
with:
```ts
    backgroundColor: T.line,
```

Replace in `sectionTitle`:
```ts
    backgroundColor: '#e0e0e0',
```
with:
```ts
    backgroundColor: T.line,
```

Replace in `rowImage`:
```ts
    backgroundColor: '#e0e0e0',
```
with (also bump to 76×76 to match real row):
```ts
    backgroundColor: T.sage,
```

And bump size — change:
```ts
  rowImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: T.sage,
  },
```
to (matching the new 76×76 real thumbnail):
```ts
  rowImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: T.sage,
  },
```

Replace in `rowName`:
```ts
    backgroundColor: '#e0e0e0',
```
with:
```ts
    backgroundColor: T.line,
```

Replace in `rowPrice`:
```ts
    backgroundColor: '#e0e0e0',
```
with:
```ts
    backgroundColor: T.line,
```

Replace in `addBtn` — bump size to 38×38 and swap bg:
```ts
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
```
with:
```ts
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.line,
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Verify lint clean**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx eslint components/menu/SkeletonCard.tsx`
Expected: zero errors, zero warnings.

- [ ] **Step 5: Confirm no hardcoded menu-palette colors remain in SkeletonCard**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "#[0-9A-Fa-f]{3,6}|#fff" components/menu/SkeletonCard.tsx`
Expected: no matches (the file should only reference `T.*` after the swap). If `#fff` or similar appears, go back and swap it.

- [ ] **Step 6: Verify WIP still intact**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: 14 WIP paths + `M components/menu/SkeletonCard.tsx`. Nothing else.

- [ ] **Step 7: Commit**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git add components/menu/SkeletonCard.tsx
git commit -m "$(cat <<'EOF'
refactor(phase3): swap SkeletonCard palette to T tokens

Structural layout unchanged. Background, border, and placeholder fills
move from hardcoded grays / #F2E8DF / #e0d5ca to T.bg / T.paper / T.line /
T.sage so the skeleton matches the re-skinned Menu. Bump row thumbnail
to 76×76 and add button to 38×38 to align with the new real sizes.

Spec: docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md §9
EOF
)"
```

---

## Task 2: ItemDetailSheet container re-skin

**Purpose:** Swap the Ionicons share/close buttons for `<Icon>`, add a drag handle + `T.line` divider + `backgroundStyle` on the gorhom sheet. No behavior change.

**Files:**
- Modify: `components/menu/ItemDetailSheet.tsx`

---

- [ ] **Step 1: Rewrite `components/menu/ItemDetailSheet.tsx` end-to-end**

Replace the **entire** file contents with:

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Pressable, Share, StyleSheet } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useItemSheetStore } from '@/store/itemSheet'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS } from '@/constants/theme'
import { ItemDetailContent } from './ItemDetailContent'

export function ItemDetailSheet() {
  const itemId = useItemSheetStore((s) => s.itemId)
  const close = useItemSheetStore((s) => s.close)
  const ref = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['90%'], [])

  useEffect(() => {
    if (itemId) ref.current?.present()
    else ref.current?.dismiss()
  }, [itemId])

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) close()
    },
    [close],
  )

  const handleShare = useCallback(() => {
    if (!itemId) return
    const url = `https://mandybubbletea.com/menu/${itemId}`
    Share.share({ message: url, url })
  }, [itemId])

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

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={styles.sheetBg}
    >
      <View style={styles.dragHandle} />
      <View style={styles.header}>
        <Pressable
          onPress={handleShare}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Icon name="share" color={T.ink} size={20} />
        </Pressable>
        <Pressable
          onPress={close}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Icon name="close" color={T.ink} size={22} />
        </Pressable>
      </View>
      {itemId ? (
        <ItemDetailContent itemId={itemId} ScrollComponent={BottomSheetScrollView} />
      ) : null}
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: T.paper,
    borderTopLeftRadius: RADIUS.sheetTop,
    borderTopRightRadius: RADIUS.sheetTop,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.ink4,
    marginTop: 8,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBtnPressed: {
    opacity: 0.6,
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Verify lint clean**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx eslint components/menu/ItemDetailSheet.tsx`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Confirm `Ionicons` no longer referenced**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -n "Ionicons\|@expo/vector-icons" components/menu/ItemDetailSheet.tsx`
Expected: no matches.

- [ ] **Step 5: Verify `handleComponent={null}` is supported**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -n "\"@gorhom/bottom-sheet\"" package.json`
Expected: a version printed (e.g., `"@gorhom/bottom-sheet": "^4.x"` or `"^5.x"`). Both v4 and v5 accept `handleComponent={null}` — no change needed. If version <4.5, replace `handleComponent={null}` with a custom `handleComponent` that returns `null`:

```tsx
handleComponent={() => null}
```

(v4.5+ accepts `null` directly; function form is safe for all versions.)

- [ ] **Step 6: Verify WIP still intact**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: 14 WIP paths + `M components/menu/ItemDetailSheet.tsx`. Nothing else.

- [ ] **Step 7: Commit**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git add components/menu/ItemDetailSheet.tsx
git commit -m "$(cat <<'EOF'
feat(phase3): re-skin ItemDetailSheet header to token theme

Replaces rounded-gray Ionicon buttons with transparent Icon-based share/
close buttons, adds the 38×4 drag handle above the header, drops a T.line
divider below it, and sets the sheet backgroundStyle to T.paper with a
sheetTop corner radius. Behavior (snap 90%, enablePanDownToClose,
onChange close, handleShare) unchanged.

Spec: docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md §4
EOF
)"
```

---

## Task 3: ItemDetailContent full rewrite

**Purpose:** Replace the existing ItemDetailContent end-to-end with the Phase 3 layout — 1:1 hero, unified Size chip, token-styled modifier chips, sticky bottom CTA with live total, skeleton loading, retry-capable error. Keep all existing behavior: modifier exclusivity rules, onByDefault pre-selection, addItem payload, haptics, 1500ms "Added" window.

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

---

- [ ] **Step 1: Rewrite `components/menu/ItemDetailContent.tsx` end-to-end**

Replace the **entire** file contents with:

```tsx
import { useEffect, useRef, useState, ComponentType } from 'react'
import {
  View,
  Text,
  ScrollView,
  ScrollViewProps,
  Pressable,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { T, TYPE, RADIUS } from '@/constants/theme'
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'

const EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']

interface Props {
  itemId: string
  ScrollComponent?: ComponentType<ScrollViewProps> | ComponentType<any>
  onLoaded?: (item: CatalogItem) => void
}

export function ItemDetailContent({
  itemId,
  ScrollComponent = ScrollView,
  onLoaded,
}: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const insets = useSafeAreaInsets()
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => { onLoadedRef.current = onLoaded })
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, Set<string>>>({})
  const [added, setAdded] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setItem(null)
    setSelectedVariation(null)
    setSelectedByList({})
    ;(async () => {
      try {
        const data = await apiFetch<{ item: CatalogItem; modifierLists?: ModifierList[] }>(
          `/api/catalog/${itemId}`,
        )
        if (cancelled) return
        setItem(data.item)
        const mls = (data.modifierLists ?? []).map((ml) =>
          ml.name?.toUpperCase() === 'TOPPING'
            ? { ...ml, minSelected: 0, maxSelected: 3 }
            : ml,
        )
        setModifierLists(mls)
        if (data.item.itemData?.variations?.length) {
          setSelectedVariation(data.item.itemData.variations[0])
        }
        const initial: Record<string, Set<string>> = {}
        for (const ml of mls) {
          const defaults = ml.modifiers.filter((m) => m.onByDefault).map((m) => m.id)
          if (defaults.length > 0) initial[ml.id] = new Set(defaults)
        }
        setSelectedByList(initial)
        onLoadedRef.current?.(data.item)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, retryNonce])

  useEffect(
    () => () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    },
    [],
  )

  const getExclusivePartner = (list: ModifierList, modifierId: string): string | null => {
    const mod = list.modifiers.find((m) => m.id === modifierId)
    if (!mod || !EXCLUSIVE_TOPPINGS.includes(mod.name)) return null
    const partner = list.modifiers.find(
      (m) => m.id !== modifierId && EXCLUSIVE_TOPPINGS.includes(m.name),
    )
    return partner?.id ?? null
  }

  const isModifierDisabled = (list: ModifierList, modifierId: string): boolean => {
    const selected = selectedByList[list.id] ?? new Set()
    if (selected.has(modifierId)) return false
    if (list.maxSelected === 1) return false
    if (list.maxSelected != null && selected.size >= list.maxSelected) return true
    const partnerId = getExclusivePartner(list, modifierId)
    if (partnerId && selected.has(partnerId)) return true
    return false
  }

  const toggleModifier = (list: ModifierList, modifierId: string) => {
    if (isModifierDisabled(list, modifierId)) return
    setSelectedByList((prev) => {
      const current = new Set(prev[list.id] ?? [])
      const isSingleSelect = list.maxSelected === 1
      if (current.has(modifierId)) {
        current.delete(modifierId)
      } else {
        if (isSingleSelect) current.clear()
        const partnerId = getExclusivePartner(list, modifierId)
        if (partnerId) current.delete(partnerId)
        current.add(modifierId)
      }
      return { ...prev, [list.id]: current }
    })
  }

  const handleAddToCart = () => {
    if (!item || !selectedVariation) return
    const basePrice = Number(selectedVariation.itemVariationData?.priceMoney?.amount ?? 0)
    const chosenModifiers = modifierLists.flatMap((ml) => {
      const picks = selectedByList[ml.id] ?? new Set()
      return ml.modifiers
        .filter((m) => picks.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name,
          listName: ml.name,
          priceCents: Number(m.priceCents ?? 0),
        }))
    })
    const modifierTotal = chosenModifiers.reduce((sum, m) => sum + m.priceCents, 0)
    addItem({
      id: item.id,
      variationId: selectedVariation.id,
      name: item.itemData?.name ?? 'Unknown',
      price: basePrice + modifierTotal,
      imageUrl: item.imageUrl,
      variationName: selectedVariation.itemVariationData?.name,
      modifiers: chosenModifiers,
    })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setAdded(true)
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setAdded(false), 1500)
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error || !item) {
    return (
      <ErrorView
        message={error ?? 'Item not found'}
        onRetry={() => setRetryNonce((n) => n + 1)}
      />
    )
  }

  const variations = item.itemData?.variations ?? []
  const baseCents = Number(selectedVariation?.itemVariationData?.priceMoney?.amount ?? 0)
  const modifierCents = modifierLists.reduce((sum, ml) => {
    const picks = selectedByList[ml.id] ?? new Set()
    return (
      sum +
      ml.modifiers.filter((m) => picks.has(m.id)).reduce((s, m) => s + Number(m.priceCents ?? 0), 0)
    )
  }, 0)
  const totalCents = baseCents + modifierCents
  const addDisabled = !selectedVariation

  return (
    <View style={styles.container}>
      <ScrollComponent>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.hero}
            contentFit="cover"
            contentPosition="center"
          />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <CupArt fill={hashColor(itemId)} size={200} />
          </View>
        )}

        <View style={styles.content}>
          <Text style={[TYPE.screenTitleLg, { color: T.ink }]}>
            {item.itemData?.name}
          </Text>
          {item.itemData?.description ? (
            <Text style={[TYPE.body, { color: T.ink3, marginTop: 4 }]}>
              {item.itemData.description}
            </Text>
          ) : null}

          {/* Size section (unified — single or multi variation) */}
          <ModifierSection
            eyebrow="SIZE"
            title="Choose size"
            hint={variations.length > 1 ? 'Pick one' : 'Only option'}
          >
            {variations.map((v) => {
              const selected = v.id === selectedVariation?.id
              const priceAmt = v.itemVariationData?.priceMoney?.amount
              return (
                <Chip
                  key={v.id}
                  label={v.itemVariationData?.name ?? 'Regular'}
                  priceSuffix={priceAmt != null ? `+${formatPrice(priceAmt)}` : null}
                  selected={selected}
                  disabled={false}
                  onPress={() => setSelectedVariation(v)}
                />
              )
            })}
          </ModifierSection>

          {modifierLists.map((ml) => {
            const selected = selectedByList[ml.id] ?? new Set()
            return (
              <ModifierSection
                key={ml.id}
                eyebrow={eyebrowForList(ml.name)}
                title={titleForList(ml.name)}
                hint={describeSelection(ml)}
              >
                {ml.modifiers.map((mod) => {
                  const isSelected = selected.has(mod.id)
                  const isDisabled = isModifierDisabled(ml, mod.id)
                  return (
                    <Chip
                      key={mod.id}
                      label={mod.name}
                      priceSuffix={
                        mod.priceCents != null && mod.priceCents > 0
                          ? `+${formatPrice(mod.priceCents)}`
                          : null
                      }
                      selected={isSelected}
                      disabled={!isSelected && isDisabled}
                      onPress={() => toggleModifier(ml, mod.id)}
                    />
                  )
                })}
              </ModifierSection>
            )
          })}
        </View>
      </ScrollComponent>

      <View style={[styles.ctaBar, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          onPress={handleAddToCart}
          disabled={addDisabled}
          style={({ pressed }) => [
            styles.cta,
            added && styles.ctaAdded,
            addDisabled && styles.ctaDisabled,
            pressed && !addDisabled && { opacity: 0.85 },
          ]}
        >
          {added ? (
            <View style={styles.ctaAddedRow}>
              <Icon name="check" color="#fff" size={18} />
              <Text style={styles.ctaAddedText}>Added</Text>
            </View>
          ) : (
            <>
              <Text style={styles.ctaLeft}>Add to cart</Text>
              {!addDisabled ? (
                <Text style={styles.ctaRight}>{formatPrice(totalCents)}</Text>
              ) : null}
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function ModifierSection({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ gap: 2 }}>
          <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{eyebrow}</Text>
          <Text style={[TYPE.cardTitle, { color: T.ink }]}>{title}</Text>
        </View>
        <Text style={styles.sectionHint}>{hint}</Text>
      </View>
      <View style={styles.chipRow}>{children}</View>
    </View>
  )
}

function Chip({
  label,
  priceSuffix,
  selected,
  disabled,
  onPress,
}: {
  label: string
  priceSuffix: string | null
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  const chipStyle = [
    styles.chip,
    selected
      ? styles.chipSelected
      : disabled
        ? styles.chipDisabled
        : styles.chipUnselected,
  ]
  const labelStyle = selected
    ? styles.chipLabelSelected
    : disabled
      ? styles.chipLabelDisabled
      : styles.chipLabel
  const priceStyle = selected
    ? styles.chipPriceSelected
    : disabled
      ? styles.chipPriceDisabled
      : styles.chipPrice
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [chipStyle, pressed && !disabled && { opacity: 0.6 }]}
    >
      <Text style={labelStyle}>{label}</Text>
      {priceSuffix ? <Text style={priceStyle}>{priceSuffix}</Text> : null}
    </Pressable>
  )
}

function LoadingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: T.paper }}>
      <View style={[styles.hero, { backgroundColor: T.sage }]} />
      <View style={{ padding: 20, gap: 10 }}>
        <View style={{ height: 28, width: '70%', borderRadius: 8, backgroundColor: T.line }} />
        <View style={{ height: 14, width: '100%', borderRadius: 7, backgroundColor: T.line }} />
        <View style={{ height: 14, width: '60%', borderRadius: 7, backgroundColor: T.line }} />
        <View style={{ marginTop: 24, gap: 10 }}>
          <View style={{ height: 10, width: 80, borderRadius: 5, backgroundColor: T.line }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
          </View>
        </View>
      </View>
    </View>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCenter}>
      <Icon name="cafe" color={T.ink3} size={32} />
      <Text style={[TYPE.cardTitle, { color: T.ink, textAlign: 'center', marginTop: 12 }]}>
        Couldn&apos;t load this drink.
      </Text>
      <Text
        style={[TYPE.body, { color: T.ink3, textAlign: 'center', marginTop: 6 }]}
      >
        {message || 'Try again.'}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  )
}

function eyebrowForList(name: string): string {
  const upper = (name ?? '').toUpperCase()
  if (upper.includes('SUGAR')) return 'SUGAR'
  if (upper.includes('ICE')) return 'ICE'
  if (upper === 'TOPPING' || upper.includes('TOPPING')) return 'TOPPINGS'
  if (upper.includes('SIZE')) return 'SIZE'
  return upper
}

function titleForList(name: string): string {
  const upper = (name ?? '').toUpperCase()
  if (upper.includes('SUGAR')) return 'Sugar level'
  if (upper.includes('ICE')) return 'Ice level'
  if (upper === 'TOPPING' || upper.includes('TOPPING')) return 'Add toppings'
  if (upper.includes('SIZE')) return 'Choose size'
  return name
}

function describeSelection(ml: ModifierList): string {
  const { minSelected, maxSelected } = ml
  if (minSelected === 0 && maxSelected === 1) return 'Pick one (optional)'
  if (minSelected === 1 && maxSelected === 1) return 'Pick one'
  if (maxSelected == null && minSelected === 0) return 'Pick any'
  if (maxSelected == null && minSelected > 0) return `Pick at least ${minSelected}`
  if (minSelected === 0) return `Pick up to ${maxSelected}`
  return `Pick ${minSelected}–${maxSelected}`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  hero: { width: '100%', aspectRatio: 1, backgroundColor: T.sage },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },

  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipUnselected: { backgroundColor: T.paper, borderColor: T.line },
  chipSelected: { backgroundColor: T.brand, borderColor: T.brand },
  chipDisabled: { backgroundColor: T.bg, borderColor: T.line, opacity: 0.5 },
  chipLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink },
  chipLabelSelected: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  chipLabelDisabled: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink4 },
  chipPrice: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.ink3, marginLeft: 4 },
  chipPriceSelected: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 4,
  },
  chipPriceDisabled: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.ink4,
    marginLeft: 4,
  },

  ctaBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: T.paper,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: T.brand,
  },
  ctaAdded: { backgroundColor: T.greenDark, justifyContent: 'center' },
  ctaDisabled: { backgroundColor: T.ink4 },
  ctaLeft: { fontFamily: 'Fraunces_500Medium', fontSize: 16, color: '#fff' },
  ctaRight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaAddedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaAddedText: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },

  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: T.paper,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: T.brand,
    backgroundColor: 'transparent',
  },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.brand },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Verify lint clean**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx eslint components/menu/ItemDetailContent.tsx`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Confirm `BRAND` + `ActivityIndicator` removed**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "BRAND|ActivityIndicator|@expo/vector-icons" components/menu/ItemDetailContent.tsx`
Expected: no matches.

- [ ] **Step 5: Confirm `TouchableOpacity` replaced with `Pressable`**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -n "TouchableOpacity" components/menu/ItemDetailContent.tsx`
Expected: no matches. (Spec uses `Pressable` for consistency with Phase 2 touch feedback.)

- [ ] **Step 6: Verify WIP still intact**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: 14 WIP paths + `M components/menu/ItemDetailContent.tsx`. Nothing else.

- [ ] **Step 7: Commit**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git add components/menu/ItemDetailContent.tsx
git commit -m "$(cat <<'EOF'
feat(phase3): re-skin ItemDetailContent to Phase 3 design

Full re-skin, no feature change:
- Fixed 1:1 hero (drops dynamic imageAspectRatio state + onLoad handler);
  CupArt + hashColor() fallback when no imageUrl.
- Fraunces screenTitleLg name, Inter body description.
- Unified Size section — single-variation shows one selected chip with
  "Only option" hint; multi-variation uses the regular chip row.
- Modifier sections gain eyebrow + title + hint header (TYPE.eyebrow +
  TYPE.cardTitle) derived from list name (SIZE/SUGAR/ICE/TOPPINGS/other).
- Chips move to 999-radius pill with explicit states: unselected (T.paper
  + T.line), selected (T.brand fill), disabled (T.bg + opacity 0.5).
  Removes the leading ✓ glyph — selection is communicated by fill alone.
- Sticky bottom CTA shows "Add to cart" + live totalCents; becomes green
  "Added" for 1500ms after tap; disabled when no selectedVariation.
  Safe-area bottom padding via useSafeAreaInsets.
- Loading replaces ActivityIndicator with a static skeleton (hero square
  + 3 bars + 3 chip placeholders).
- Error state gets Icon, copy, "Try again" pill that bumps retryNonce to
  re-run the fetch effect.

Modifier exclusivity (Cheese Cream / Brulee), TOPPING maxSelected=3 cap,
onByDefault pre-selection, addItem payload construction, haptics success
pulse, and the 1500ms added timer + cleanup are preserved verbatim.

Spec: docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md §5–8
EOF
)"
```

---

## Task 4: Menu screen full rewrite

**Purpose:** Re-skin `app/(tabs)/menu.tsx` end-to-end. Drop `BRAND` + `Ionicons`. Switch root bg to `T.bg`, upgrade search bar to 42h pill with `<Icon>`, thicken sidebar active bar + bump labels to 12/15, wrap section header in a paper card with eyebrow + title + banner + dark overlay, bump product row thumb to 76×76 + swap `+` button to `<Icon>`-based 38×38 with CupArt fallback, replace the loud red error with muted copy.

**Files:**
- Modify: `app/(tabs)/menu.tsx`

---

- [ ] **Step 1: Rewrite `app/(tabs)/menu.tsx` end-to-end**

Replace the **entire** file contents with:

```tsx
import { memo, useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useMenu } from '@/hooks/use-menu'
import { SkeletonSection } from '@/components/menu/SkeletonCard'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { useItemSheetStore } from '@/store/itemSheet'
import { MiniCartBar } from '@/components/cart/MiniCartBar'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem, CatalogCategory } from '@/types/square'

const HIGHLIGHT_OFFSET = 40

const CATEGORY_BANNERS: Record<string, ReturnType<typeof require>> = {
  milky: require('@/assets/images/categories/milky.webp'),
  fruity: require('@/assets/images/categories/fruity.webp'),
  specialmix: require('@/assets/images/categories/special-mix.webp'),
  freshbrew: require('@/assets/images/categories/fresh-brew.webp'),
  fruityblacktea: require('@/assets/images/categories/fruity-black-tea.webp'),
  frozen: require('@/assets/images/categories/frozen.webp'),
  cheesecream: require('@/assets/images/categories/cheese-cream.webp'),
}

function categoryBanner(name: string) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  return CATEGORY_BANNERS[key]
}

export default function MenuScreen() {
  const { items, categories, loading, error } = useMenu()
  const scrollRef = useRef<ScrollView>(null)
  const sectionOffsets = useRef<Record<string, number>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollingToRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((it) =>
      (it.itemData?.name ?? '').toLowerCase().includes(q),
    )
  }, [items, query])

  const sections = useMemo(() => {
    if (categories.length === 0 || items.length === 0) return []
    return categories
      .map((cat) => ({
        category: cat,
        items: items.filter((item) =>
          item.itemData?.categories?.some((c) => c.id === cat.id),
        ),
      }))
      .filter((s) => s.items.length > 0)
  }, [items, categories])

  const firstId = sections[0]?.category.id ?? null
  const currentActive = activeId ?? firstId

  const handleTabPress = useCallback((id: string) => {
    Keyboard.dismiss()
    const y = sectionOffsets.current[id]
    if (y == null) return
    scrollingToRef.current = id
    setActiveId(id)
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })
  }, [])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollingToRef.current) return
      const y = e.nativeEvent.contentOffset.y + HIGHLIGHT_OFFSET
      const entries = Object.entries(sectionOffsets.current).sort(
        (a, b) => a[1] - b[1],
      )
      let current = entries[0]?.[0] ?? null
      for (const [id, offset] of entries) {
        if (y >= offset) current = id
        else break
      }
      if (current && current !== activeId) setActiveId(current)
    },
    [activeId],
  )

  const handleMomentumEnd = useCallback(() => {
    scrollingToRef.current = null
  }, [])

  if (loading && items.length === 0) {
    return <SkeletonSection />
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Menu unavailable. Try again later.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <Icon name="search" color={T.ink3} size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drinks"
          placeholderTextColor={T.ink3}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} style={styles.searchClearBtn}>
            <Icon name="close" color={T.ink3} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searching ? (
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {searchResults.length === 0 ? (
            <Text style={styles.empty}>No drinks match &quot;{query.trim()}&quot;</Text>
          ) : (
            <View style={styles.searchResults}>
              {searchResults.map((item) => (
                <ProductRow key={item.id} item={item} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.container}>
          <View style={styles.sidebarWrap}>
            <ScrollView
              style={styles.sidebar}
              contentContainerStyle={styles.sidebarContent}
              showsVerticalScrollIndicator={false}
            >
              {sections.map(({ category }) => {
                const active = category.id === currentActive
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => handleTabPress(category.id)}
                    activeOpacity={0.7}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    {active ? <View style={styles.tabBar} /> : null}
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                      numberOfLines={2}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <View style={styles.mainWrap}>
            <ScrollView
              ref={scrollRef}
              style={styles.main}
              contentContainerStyle={styles.mainContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              keyboardDismissMode="on-drag"
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumEnd}
              onScrollEndDrag={handleMomentumEnd}
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {sections.map((section, i) => (
                <CategorySection
                  key={section.category.id}
                  index={i}
                  category={section.category}
                  items={section.items}
                  onLayoutY={(y) => {
                    sectionOffsets.current[section.category.id] = y
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      )}
      <MiniCartBar />
    </View>
  )
}

const CategorySection = memo(function CategorySection({
  index,
  category,
  items,
  onLayoutY,
}: {
  index: number
  category: CatalogCategory
  items: CatalogItem[]
  onLayoutY: (y: number) => void
}) {
  const banner = categoryBanner(category.name)
  const indexLabel = String(index + 1).padStart(2, '0')
  return (
    <View onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}>
      <View style={styles.sectionHeader}>
        <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{`CATEGORY ${indexLabel}`}</Text>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {category.name}
        </Text>
        {banner ? (
          <View style={styles.bannerWrap}>
            <Image
              source={banner}
              style={styles.sectionBanner}
              contentFit="cover"
              contentPosition="center"
            />
            <View style={styles.bannerOverlay} pointerEvents="none" />
          </View>
        ) : null}
      </View>
      {items.map((item) => (
        <ProductRow key={item.id} item={item} />
      ))}
    </View>
  )
})

const ProductRow = memo(function ProductRow({ item }: { item: CatalogItem }) {
  const addItem = useCartStore((s) => s.addItem)
  const name = item.itemData?.name ?? 'Unknown'
  const firstVariation = item.itemData?.variations?.[0]
  const price = firstVariation?.itemVariationData?.priceMoney?.amount
  const variationName = firstVariation?.itemVariationData?.name
  const showVariationSubtitle =
    variationName && variationName.toLowerCase() !== 'regular'

  const btnScale = useSharedValue(1)
  const checkOpacity = useSharedValue(0)

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }))
  const plusStyle = useAnimatedStyle(() => ({
    opacity: 1 - checkOpacity.value,
  }))
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: 0.6 + checkOpacity.value * 0.4 }],
  }))

  const handleAdd = () => {
    if (!firstVariation) return
    Haptics.selectionAsync()
    cancelAnimation(btnScale)
    cancelAnimation(checkOpacity)
    btnScale.value = 1
    checkOpacity.value = 0
    btnScale.value = withSequence(
      withTiming(0.9, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
    )
    checkOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 260 }),
    )
    addItem({
      id: item.id,
      variationId: firstVariation.id,
      name,
      price: Number(price ?? 0),
      imageUrl: item.imageUrl,
      variationName: firstVariation.itemVariationData?.name,
      modifiers: [],
    })
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => useItemSheetStore.getState().open(item.id)}
      activeOpacity={0.6}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.rowImage}
          contentFit="cover"
          contentPosition="center"
        />
      ) : (
        <View style={[styles.rowImage, styles.placeholder]}>
          <CupArt fill={hashColor(item.id)} size={60} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>
          {name}
        </Text>
        {showVariationSubtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {variationName}
          </Text>
        ) : null}
        {price != null ? (
          <Text style={styles.rowPrice}>{formatPrice(price)}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.()
          handleAdd()
        }}
        hitSlop={8}
      >
        <Animated.View style={[styles.addBtn, btnStyle]}>
          <Animated.View style={[styles.addBtnGlyph, plusStyle]}>
            <Icon name="plus" color="#fff" size={18} />
          </Animated.View>
          <Animated.View style={[styles.addBtnGlyph, checkStyle]} pointerEvents="none">
            <Icon name="check" color="#fff" size={18} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.ink,
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    marginTop: 40,
  },
  searchResults: {
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    textAlign: 'center',
  },
  sidebarWrap: {
    flex: 1,
    backgroundColor: T.bg,
  },
  sidebar: {
    flex: 1,
  },
  sidebarContent: {
    paddingVertical: 8,
  },
  tab: {
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: T.paper,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    backgroundColor: T.brand,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    color: T.ink3,
  },
  tabTextActive: {
    fontFamily: 'Inter_700Bold',
    color: T.brand,
  },
  mainWrap: {
    flex: 3.2,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 48,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    padding: 14,
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.card,
  },
  sectionTitle: {
    ...TYPE.screenTitleSm,
    color: T.ink,
    marginTop: 2,
    marginBottom: 10,
  },
  bannerWrap: {
    width: '100%',
    height: 96,
    borderRadius: RADIUS.tile,
    overflow: 'hidden',
    backgroundColor: T.sage,
  },
  sectionBanner: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42,30,20,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  rowImage: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.tile,
    backgroundColor: T.sage,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  rowName: {
    ...TYPE.cardTitle,
    color: T.ink,
  },
  rowSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  rowPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBtnGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Verify lint clean on the menu file**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx eslint "app/(tabs)/menu.tsx"`
Expected: zero errors, zero warnings. (Note the quotes around the path — the parens need shell escaping.)

- [ ] **Step 4: Confirm `BRAND` + `Ionicons` removed**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "BRAND|Ionicons|@expo/vector-icons" "app/(tabs)/menu.tsx"`
Expected: no matches.

- [ ] **Step 5: Confirm no orphan hardcoded colors**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "#[0-9A-Fa-f]{3,6}|'#fff'" "app/(tabs)/menu.tsx"`
Expected: only `'rgba(42,30,20,0.06)'` (the banner overlay tint — an intentional computed value, not a named color). Any `#1a1a1a` / `#8a8076` / `#fff` / `#F2E8DF` / `#f5f5f5` should NOT appear. If any do, go swap them for `T.*` tokens.

- [ ] **Step 6: Verify WIP still intact**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: 14 WIP paths + `M app/(tabs)/menu.tsx`. Nothing else.

- [ ] **Step 7: Commit**

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
git add "app/(tabs)/menu.tsx"
git commit -m "$(cat <<'EOF'
feat(phase3): re-skin Menu screen to Phase 3 design

Full re-skin, no feature change:
- Root background T.bg; container inherits (no override).
- Search bar: 42h pill (T.paper + T.line + 999 radius), Icon-based search
  and close glyphs, placeholder + input text in Inter/T tokens.
- Sidebar: minHeight 64 per tab, active bg T.paper, active vertical bar
  4w × full-height in T.brand. Labels Inter_500 / Inter_700 bold when
  active, 12/15 with T.ink3 → T.brand color transition.
- Main column flex 3.2 (was 3) to rebalance 25/75 → ~24/76 split.
- Section header wrapped in a T.paper card with SHADOW.card + RADIUS.card,
  JetBrainsMono "CATEGORY 01"-style eyebrow, Fraunces title, 96h banner
  with rgba(42,30,20,0.06) darken overlay. Old sectionHeader styles
  replaced; padding moved off wrapper onto the card itself.
- Product rows: 76×76 thumbnail (was 72), RADIUS.tile, CupArt +
  hashColor() fallback replaces the 🧋 emoji placeholder. Optional
  variation subtitle (skipped for "Regular"). Price uses Inter_600
  semibold at T.ink2 (no longer brand-red). Add button 38×38 (was 32),
  icon-based plus/check cross-fade (same animation timings).
- Empty search state copy "No drinks match \"<q>\"" in T.ink3.
- Error state: muted "Menu unavailable. Try again later." on T.bg
  background — drops the loud red color.

Drops lib/constants BRAND import and @expo/vector-icons from this file.

Spec: docs/superpowers/specs/2026-04-19-redesign-03-menu-itemsheet.md §1–3
EOF
)"
```

---

## Task 5: Validation sweep

**Purpose:** Confirm the phase is complete, clean, and WIP-safe. No new code — this task is strictly verification. If any step fails, fix it in the relevant prior task (re-open it) before marking the phase done.

**Files:** (verification only, no modifications)

---

- [ ] **Step 1: Full type check**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full lint**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npm run lint`
Expected: any warnings/errors present MUST be in files NOT touched by Phase 3 (i.e., `app/login.tsx`, `app/checkout.tsx`, `app/order-*.tsx`, `components/cart/CartItem.tsx`, or similar Phase 3d / earlier-phase files). Zero errors in the 5 Phase 3 files:
- `components/brand/color.ts`
- `components/brand/Icon.tsx`
- `components/menu/SkeletonCard.tsx`
- `components/menu/ItemDetailSheet.tsx`
- `components/menu/ItemDetailContent.tsx`
- `app/(tabs)/menu.tsx`

If a pre-existing warning appears in any of these, clear it inline (if it's easy) or go back to the originating task and fix it.

- [ ] **Step 3: `BRAND` removed from all Phase 3 menu files**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "BRAND" "app/(tabs)/menu.tsx" components/menu/ItemDetailSheet.tsx components/menu/ItemDetailContent.tsx components/menu/SkeletonCard.tsx`
Expected: no matches.

- [ ] **Step 4: Ionicons removed from all Phase 3 menu files**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && grep -nE "Ionicons|@expo/vector-icons" "app/(tabs)/menu.tsx" components/menu/ItemDetailSheet.tsx components/menu/ItemDetailContent.tsx components/menu/SkeletonCard.tsx`
Expected: no matches.

- [ ] **Step 5: Phase 3d WIP preservation — byte-identical check**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git status --short`
Expected: EXACTLY these 14 lines and nothing else:

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

(Note: `components/legal/` expands to one `??` line for the directory as a whole.)

If any other files appear (e.g., a stray edit in a Phase 3 file that wasn't committed, a node_modules change, a lock-file bump), investigate and resolve before continuing. Do NOT `git add` or `git commit` those unless they're a genuine Phase 3 artefact.

- [ ] **Step 6: Verify WIP files are byte-identical vs the phase start**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git diff --stat -- app/\(tabs\)/account.tsx app/_layout.tsx components/auth/AuthProvider.tsx ios/Podfile.lock ios/mandysbubbleteaapp.xcodeproj/project.pbxproj ios/mandysbubbleteaapp/Info.plist ios/mandysbubbleteaapp/PrivacyInfo.xcprivacy ios/mandysbubbleteaapp/mandysbubbleteaapp.entitlements`
Expected: the diff line counts match what they were at the start of Phase 3 (i.e., unchanged since handoff from Phase 3d). If any line counts changed, `git diff <path>` and investigate — restore the file to its pre-Phase-3 state via `git checkout HEAD~N -- <path>` only after confirming the change was accidental.

- [ ] **Step 7: Commit count sanity check**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && git log --oneline main..HEAD 2>/dev/null | head -20`

Expected: at least 5 new commits from Phase 3 (Task 0 through Task 4). Each commit subject should start with `feat(phase3):` or `refactor(phase3):`. Typical log (newest first):

```
<sha> feat(phase3): re-skin Menu screen to Phase 3 design
<sha> feat(phase3): re-skin ItemDetailContent to Phase 3 design
<sha> feat(phase3): re-skin ItemDetailSheet header to token theme
<sha> refactor(phase3): swap SkeletonCard palette to T tokens
<sha> feat(phase3): add hashColor util + share icon
```

(Fewer is fine if you combined tasks intentionally; more is fine if you had follow-up fix commits. What matters is the log reflects the work.)

- [ ] **Step 8: On-device smoke — Menu**

Start the Metro dev server:

```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
npx expo start --clear
```

Open the app on an iOS simulator (or physical device) + an Android emulator. Navigate to the Menu tab. Verify each row from spec §11 "On-device smoke (Menu)":

- **Root bg** is warm cream `T.bg` (`#F2E8DF`), not white.
- **Search bar** is a 42h pill, `T.paper` background, `T.line` border. The search glyph (leading) is `<Icon name="search">`, not Ionicons.
- **Typing** a query hides the sidebar + category cards; the list becomes full-width filtered results. Typing a nonsense string shows `No drinks match "xyz"` in muted copy, no red.
- **Clear-button** (the close `X` inside the input) clears the query and restores sidebar + categories.
- **Sidebar tab tap** scrolls to that category + animates the active bar to it; active tab bg is `T.paper`, bar is `T.brand` (brick red), 4px wide.
- **Scroll through categories**: active sidebar tab auto-switches as the current category header crosses the top (tracking unchanged — just validate no regression).
- **Category header card**: `CATEGORY 01` eyebrow in mono, Fraunces title, banner image visible, slight dark overlay so bright banners don't glare.
- **Product row**: 76×76 thumbnail (bigger than before). If a product has no image, CupArt fallback shows with a color from the palette — tap the same item twice (close + reopen), color should be the same.
- **Row `+` tap**: button pulses, icon cross-fades plus → check → plus, MiniCartBar count increments. Haptic fires.
- **Row body tap**: ItemSheet opens.

- [ ] **Step 9: On-device smoke — ItemSheet**

With the sheet open on any product:

- **Drag handle**: small `T.ink4` pill, top-centered above the share/close row.
- **Share + close**: transparent square buttons, `<Icon>` glyphs. Dividing line below the header in `T.line`.
- **Sheet bg**: `T.paper` with rounded top corners (`RADIUS.sheetTop`).
- **Hero**: always a perfect square — no layout shift / aspect wobble on image load. For an item with no image, CupArt fallback (`hashColor(itemId)`) fills the square.
- **Name**: Fraunces 28 display type, not bold/sans.
- **Size section**: unified. For a single-variation item (e.g. regular drink), one chip selected, hint reads "Only option". For a multi-variation item (if any), chips work like a single-select — only one selected at a time.
- **Sugar / Ice / Toppings**: each section has eyebrow (SUGAR/ICE/TOPPINGS) + title ("Sugar level" / "Ice level" / "Add toppings") + hint describing constraints. Chips are 999-radius pills, unselected with `T.paper` + `T.line` border, selected with `T.brand` fill + white label. Prices render as `+A$0.60` inside the chip.
- **Topping cap**: pick 3 toppings — 4th should be visually disabled (`T.bg` bg, faded opacity).
- **Cheese Cream / Brulee**: picking one disables the other.
- **onByDefault**: if any modifiers default-on in Square, they're selected on open.
- **Sticky CTA**: left `Add to cart` in Fraunces, right `A$X.XX` live total updating as you toggle modifiers / switch variations. On iOS, the bar rides above the home indicator (safe-area bottom inset applied).
- **Tap CTA**: brick red → green "Added" with check icon for 1.5s, then reverts. Cart count went up by 1.
- **Close the sheet** (drag down or tap close). No errors in the Metro console.

- [ ] **Step 10: Loading + Error smoke**

Loading:
- Airplane mode on, tap a product row. Hero should become a solid `T.sage` square, title/description placeholders (T.line bars), chip-row placeholders. No spinner.

Error:
- Still airplane mode. Same sheet now shows the error view after timeout: `cafe` icon, `Couldn't load this drink.` title, the caught error message, "Try again" pill button with `T.brand` border.
- Re-enable network. Tap "Try again". Fetch runs, content loads.

- [ ] **Step 11: Phase handoff — log summary**

Update `~/system/DEV_QUEUE.md` Mandy's Bubble Tea section: add a completed entry beneath the last Phase 2 entry:

```
- [x] **Phase 3 Menu + ItemSheet 再设计** — 5 commits, 5 文件改动 + 1 新文件，sidebar/section card/ 76×76 行 / 1:1 hero / unified Size chip / sticky CTA / skeleton + retry, BRAND 和 Ionicons 从 4 个 menu 文件清退, Phase 3d WIP 保持 byte-identical
```

(Do NOT commit this — it's a personal tracking file outside the repo.)

- [ ] **Step 12: Final task-list clean up**

In your TodoWrite / task list, mark the last remaining Phase 3 task as `completed`. No new commit needed for this step.

---

## Risks addressed

| Risk | Where handled |
|---|---|
| Fraunces falls back to serif on some Android devices | `useFonts` in `_layout.tsx` already loads Fraunces_500Medium (Phase 1). On-device smoke explicitly checks the name renders in Fraunces. |
| `@gorhom/bottom-sheet` version compat for `handleComponent={null}` / `backgroundStyle` | Task 2 Step 5 checks `package.json` version; if <4.5, swap to `handleComponent={() => null}`. |
| Phase 3d WIP drift | Every task's commit names specific files only. Task 5 Steps 5–6 re-verify byte-identical state post-phase. |
| `share` glyph visually differs from old Ionicons share | Acceptable — spec accepts drift; rest of app uses `<Icon>` uniformly. |
| `hashColor` palette collision with brand tokens | Deterministic mod 5 pick; palette is [peach, cream, star, brand, sage] — all part of the existing redesign palette, so any pick looks intentional. |

## Out of scope reminders

- No quantity stepper in ItemSheet
- No preview snap point for ItemSheet
- No favorites / heart
- No Home/StoreCard edits (Phase 2 done)
- No Cart/Checkout edits (Phase 4)
- No `BRAND` removal from non-menu files (Phase 7)
- No category banner image changes
