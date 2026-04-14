# Menu Item Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击菜单 item 从底部弹出 bottom sheet（而不是跳转到新页），iOS / Android 表现一致。

**Architecture:** 用 `@gorhom/bottom-sheet` + Zustand store 管理打开的 itemId。把现有 `app/menu/[id].tsx` 里的 detail 逻辑抽到 `ItemDetailContent` 组件，sheet 与深链路由都复用它。`ItemCard.onPress` 改为打开 store，而不是 `router.push`。

**Tech Stack:** React Native (Expo 54) · expo-router 6 · `@gorhom/bottom-sheet` · reanimated 4 · gesture-handler 2 · Zustand 5

Spec: `docs/superpowers/specs/2026-04-14-menu-item-bottom-sheet.md`

---

## File Structure

**新增：**
- `store/itemSheet.ts` — Zustand store，`{ itemId, open(id), close() }`
- `components/menu/ItemDetailContent.tsx` — 纯展示组件，接收 `itemId`，内部 fetch & 渲染 size/modifier/Add to Cart；滚动容器通过 prop 注入
- `components/menu/ItemDetailSheet.tsx` — 挂在 root 的 BottomSheetModal，订阅 store

**修改：**
- `app/_layout.tsx` — 包 `GestureHandlerRootView` + `BottomSheetModalProvider`，渲染 `<ItemDetailSheet />`
- `components/menu/ItemCard.tsx` — 替换 `router.push` 为 `useItemSheetStore.getState().open(id)`
- `app/menu/[id].tsx` — 精简成 `<ItemDetailContent itemId={id} ScrollComponent={ScrollView} />`

---

### Task 1: 安装依赖

**Files:** `package.json`

- [ ] **Step 1: 安装 gorhom bottom sheet**

```bash
cd ~/Github/mandys_bubble_tea_app
npx expo install @gorhom/bottom-sheet
```

Expected: 添加到 dependencies，无 peer 警告（reanimated / gesture-handler 已装）。

- [ ] **Step 2: 验证能跑**

```bash
npm run lint
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @gorhom/bottom-sheet"
```

---

### Task 2: itemSheet store

**Files:**
- Create: `store/itemSheet.ts`

- [ ] **Step 1: 写 store**

```ts
import { create } from 'zustand'

interface ItemSheetState {
  itemId: string | null
  open: (id: string) => void
  close: () => void
}

export const useItemSheetStore = create<ItemSheetState>((set) => ({
  itemId: null,
  open: (id) => set({ itemId: id }),
  close: () => set({ itemId: null }),
}))
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add store/itemSheet.ts
git commit -m "feat: itemSheet store"
```

---

### Task 3: 抽出 ItemDetailContent 组件

将 `app/menu/[id].tsx` 现有逻辑（fetch / variations / modifiers / Add to Cart / describeSelection / styles）原样搬到一个可复用组件。

**Files:**
- Create: `components/menu/ItemDetailContent.tsx`

- [ ] **Step 1: 新建组件文件**

```tsx
import { useEffect, useState, ComponentType } from 'react'
import {
  View,
  Text,
  ScrollView,
  ScrollViewProps,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { BRAND } from '@/lib/constants'
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'

const EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']

interface Props {
  itemId: string
  ScrollComponent?: ComponentType<ScrollViewProps>
  onLoaded?: (item: CatalogItem) => void
}

export function ItemDetailContent({
  itemId,
  ScrollComponent = ScrollView,
  onLoaded,
}: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, Set<string>>>({})
  const [added, setAdded] = useState(false)

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
        onLoaded?.(data.item)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, onLoaded])

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
    setTimeout(() => setAdded(false), 1500)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Item not found'}</Text>
      </View>
    )
  }

  const variations = item.itemData?.variations ?? []

  return (
    <View style={styles.container}>
      <ScrollComponent>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, styles.placeholderImage]}>
            <Text style={{ fontSize: 64 }}>🧋</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.name}>{item.itemData?.name}</Text>
          {item.itemData?.description ? (
            <Text style={styles.description}>{item.itemData.description}</Text>
          ) : null}

          {variations.length > 1 ? (
            <View style={styles.modifierSection}>
              <Text style={styles.sectionTitle}>Size</Text>
              <View style={styles.pillRow}>
                {variations.map((v) => {
                  const active = v.id === selectedVariation?.id
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedVariation(v)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {v.itemVariationData?.name ?? 'Regular'}
                      </Text>
                      {v.itemVariationData?.priceMoney?.amount != null ? (
                        <Text style={[styles.pillPrice, active && styles.pillTextActive]}>
                          {formatPrice(v.itemVariationData.priceMoney.amount)}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ) : null}

          {modifierLists.map((ml) => {
            const selected = selectedByList[ml.id] ?? new Set()
            return (
              <View key={ml.id} style={styles.modifierSection}>
                <View style={styles.modifierHeader}>
                  <Text style={styles.sectionTitle}>{ml.name}</Text>
                  <Text style={styles.selectionHint}>{describeSelection(ml)}</Text>
                </View>
                <View style={styles.pillRow}>
                  {ml.modifiers.map((mod) => {
                    const isSelected = selected.has(mod.id)
                    const isDisabled = isModifierDisabled(ml, mod.id)
                    return (
                      <TouchableOpacity
                        key={mod.id}
                        style={[
                          styles.pill,
                          isSelected && styles.pillActive,
                          !isSelected && isDisabled && styles.pillDisabled,
                        ]}
                        onPress={() => toggleModifier(ml, mod.id)}
                        disabled={isDisabled}
                        activeOpacity={isDisabled ? 1 : 0.6}
                      >
                        <Text style={[styles.checkmark, !isSelected && styles.checkmarkHidden]}>
                          ✓
                        </Text>
                        <Text
                          style={[
                            styles.pillText,
                            isSelected && styles.pillTextActive,
                            !isSelected && isDisabled && styles.pillTextDisabled,
                          ]}
                        >
                          {mod.name}
                        </Text>
                        {mod.priceCents != null && mod.priceCents > 0 ? (
                          <Text
                            style={[
                              styles.pillPrice,
                              isSelected && styles.pillTextActive,
                              !isSelected && isDisabled && styles.pillTextDisabled,
                            ]}
                          >
                            +{formatPrice(mod.priceCents)}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )
          })}

          {selectedVariation?.itemVariationData?.priceMoney?.amount != null ? (
            <Text style={styles.price}>
              {formatPrice(selectedVariation.itemVariationData.priceMoney.amount)}
            </Text>
          ) : null}
        </View>
      </ScrollComponent>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.addButton, added && styles.addedButton]}
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>{added ? 'Added!' : 'Add to Cart'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
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
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: 'red', fontSize: 16 },
  heroImage: { width: '100%', height: 300 },
  placeholderImage: { backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  name: { fontSize: 24, fontWeight: '700' },
  description: { fontSize: 15, color: '#666', lineHeight: 22 },
  modifierSection: { marginTop: 8 },
  modifierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  selectionHint: { fontSize: 12, color: '#999' },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pillActive: { borderColor: BRAND.color, backgroundColor: BRAND.color },
  pillDisabled: { borderColor: '#eee', backgroundColor: '#fafafa' },
  pillText: { fontSize: 14, color: '#333' },
  pillPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  pillTextDisabled: { color: '#ccc' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', width: 12, textAlign: 'center' },
  checkmarkHidden: { color: 'transparent' },
  price: { fontSize: 22, fontWeight: '700', color: BRAND.color },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  addButton: {
    backgroundColor: BRAND.color,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addedButton: { backgroundColor: '#2e7d32' },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat: ItemDetailContent shared component"
```

---

### Task 4: 重写 `app/menu/[id].tsx` 复用 ItemDetailContent

**Files:**
- Modify: `app/menu/[id].tsx`（整个文件重写）

- [ ] **Step 1: 替换文件内容**

```tsx
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect } from 'react'
import { ItemDetailContent } from '@/components/menu/ItemDetailContent'

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()

  return (
    <ItemDetailContent
      itemId={id}
      onLoaded={(item) => {
        navigation.setOptions({ title: item.itemData?.name ?? '' })
      }}
    />
  )
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: 冒烟测试（深链 fallback 仍工作）**

启动 dev server 并访问一个 item URL：

```bash
npm run start
```

Expected: `/menu/<itemId>` 路由仍然能加载（作为 Stack 页面，带返回箭头）。

- [ ] **Step 4: Commit**

```bash
git add app/menu/\[id\].tsx
git commit -m "refactor: menu/[id] route uses ItemDetailContent"
```

---

### Task 5: ItemDetailSheet 组件

**Files:**
- Create: `components/menu/ItemDetailSheet.tsx`

- [ ] **Step 1: 写 sheet 组件**

```tsx
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useItemSheetStore } from '@/store/itemSheet'
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
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleShare} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={22} color="#11181C" />
        </TouchableOpacity>
        <TouchableOpacity onPress={close} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color="#11181C" />
        </TouchableOpacity>
      </View>
      {itemId ? (
        <ItemDetailContent itemId={itemId} ScrollComponent={BottomSheetScrollView} />
      ) : null}
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
})
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/menu/ItemDetailSheet.tsx
git commit -m "feat: ItemDetailSheet"
```

---

### Task 6: 挂到 root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: 更新 root layout**

```tsx
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { ItemDetailSheet } from '@/components/menu/ItemDetailSheet';

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider value={LightTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Menu' }} />
            <Stack.Screen name="menu/[id]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen
              name="checkout"
              options={{ headerShown: true, title: 'Checkout', headerBackTitle: 'Cart' }}
            />
            <Stack.Screen
              name="order-detail"
              options={{ headerShown: true, title: 'Order Detail', headerBackTitle: 'Account' }}
            />
            <Stack.Screen
              name="order-confirmation"
              options={{
                headerShown: true,
                title: 'Order Confirmed',
                headerBackVisible: false,
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    hitSlop={12}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <Ionicons name="home-outline" size={24} color="#11181C" />
                  </TouchableOpacity>
                ),
              }}
            />
          </Stack>
          <ItemDetailSheet />
          <StatusBar style="dark" />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: mount ItemDetailSheet at root"
```

---

### Task 7: ItemCard 改为打开 sheet

**Files:**
- Modify: `components/menu/ItemCard.tsx`

- [ ] **Step 1: 替换 onPress 逻辑**

在文件顶部替换 import：

```tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { formatPrice } from '@/lib/utils'
import { BRAND } from '@/lib/constants'
import { useCartStore } from '@/store/cart'
import { useItemSheetStore } from '@/store/itemSheet'
import type { CatalogItem } from '@/types/square'
```

删掉 `const router = useRouter()`。把 `onPress` 改为：

```tsx
onPress={() => useItemSheetStore.getState().open(item.id)}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/menu/ItemCard.tsx
git commit -m "feat: ItemCard opens bottom sheet instead of navigating"
```

---

### Task 8: 真机/模拟器验证

- [ ] **Step 1: 启 dev server**

```bash
npm run start
```

- [ ] **Step 2: iOS 模拟器验证**

  - 打开 Menu tab → 点任一 item → sheet 从底部弹出，顶部圆角、背后变暗
  - 下拉关闭 → sheet 消失，itemId 置空
  - 再点 → 重新打开（不同 item 加载新内容）
  - 点右上 X → 关闭
  - 点左上 Share → 系统分享面板弹出，含 URL
  - 选 size/modifier → Add to Cart → "Added!" 闪一下 → 购物车数量 +1
  - 深链：浏览器输入 `exp+mandysbubbletea://menu/<id>`（或真机 Expo dev URL）→ 作为 Stack 页面打开，带返回箭头

- [ ] **Step 3: Android 模拟器/真机验证**

重复 Step 2 同样流程。确认：
  - sheet 同样从底部弹出
  - 背后 backdrop 可点击关闭
  - 手势下滑可关闭
  - 无 `reanimated` / `gesture-handler` warning

- [ ] **Step 4: 若 OK，更新 DEV queue**

在 `~/system/DEV_QUEUE.md` 的 Mandy's Bubble Tea App 项目下记录：

```
- [x] **Menu Item Bottom Sheet** — 点击 item 从底部弹出 sheet（替代新页跳转），iOS/Android 一致，Share + 深链保留
```

- [ ] **Step 5: Commit（若 queue 有更新）**

```bash
cd ~/system && git add DEV_QUEUE.md && git commit -m "update: mandy app menu bottom sheet done"
```

---

## Self-Review

- **Spec coverage：** 依赖（T1）✓ store（T2）✓ 组件抽取（T3）✓ 路由 fallback（T4）✓ sheet + Share + X（T5）✓ root provider（T6）✓ ItemCard 改接（T7）✓ iOS/Android 验收（T8）✓
- **Placeholder：** 无 TBD / "similar to"；所有代码齐全
- **Type 一致性：** `useItemSheetStore` 签名在 T2 / T5 / T7 一致；`ItemDetailContent` props（itemId / ScrollComponent / onLoaded）在 T3 定义，T4 / T5 消费一致
