# App Performance Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 11 targeted perf fixes in the RN app — cut first-frame TTI, eliminate wasted re-renders, stop per-call side effects in hot paths, and replace heavy ScrollViews with virtualized lists.

**Architecture:** Keep the existing Expo Router + Zustand + Supabase architecture. No new libraries. Each task is a self-contained local patch — no cross-file refactors.

**Tech Stack:** Expo 54, React Native 0.81, React 19 + React Compiler, Expo Router 6, Zustand 5, expo-image, @supabase/supabase-js 2.

**Baseline verification (do once before Batch 1):** `cd /Users/stanyan/Github/mandys_bubble_tea_app && npx tsc --noEmit && npx eslint .` — record errors/warnings count so you can confirm no regressions after each task.

---

## Batch 1 — Parallel-safe (no file overlap)

### Task 1: Slim font loading

Currently `app/_layout.tsx` loads 11 font weights. Unused weights block the splash → paint. Drop weights with 0 usage outside the load list.

**Files:**
- Modify: `app/_layout.tsx:17-33`, `app/_layout.tsx:52-64`
- Verify: `components/menu/ItemDetailContent.tsx` (uses 1 unused-weight reference — fix if found), `app/(tabs)/menu.tsx` (same)

- [ ] **Step 1: Inventory weight usage**

Run and record counts:
```bash
cd /Users/stanyan/Github/mandys_bubble_tea_app
# In the repo, excluding _layout.tsx and docs/
```
Use Grep tool for each weight name across `app/`, `components/`, `hooks/`, `lib/`, `constants/`. The 5 weights referenced by `constants/theme.ts:TYPE` are required — keep them: `Fraunces_500Medium`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `JetBrainsMono_700Bold`. Only drop a weight if it is used ZERO times outside `app/_layout.tsx`.

- [ ] **Step 2: Migrate any outlier uses to a loaded weight**

If Grep finds `Fraunces_400Regular` / `Fraunces_600SemiBold` / `Fraunces_700Bold` / `Inter_700Bold` / `JetBrainsMono_400Regular` / `JetBrainsMono_500Medium` used in a source file, replace with the nearest kept weight (e.g., `Inter_700Bold` → `Inter_600SemiBold`; `Fraunces_700Bold` → `Fraunces_500Medium`). Visual delta is negligible.

- [ ] **Step 3: Remove unused imports and useFonts entries**

Edit `app/_layout.tsx` imports block (lines 17–33) and `useFonts(...)` call (lines 52–64) to include ONLY the 5 required weights (or more, if Step 1 proved others are used).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/_layout.tsx`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx # plus any edited files from Step 2
git commit -m "perf(fonts): drop unused font weights to speed first frame"
```

---

### Task 2: Lazy Square SDK init in checkout

`app/checkout.tsx:134-152` fires `initSquarePayments()` + `canUseApplePay()` + `canUseGooglePay()` on mount — even for unauthenticated users who will be redirected away. Gate init behind auth readiness.

**Files:**
- Modify: `app/checkout.tsx:134-152`

- [ ] **Step 1: Read surrounding context**

Read `app/checkout.tsx` lines 1–200 to identify the `profile`/`authLoading` variable names already in scope (the checkout page uses `useAuth`). Note the exact names.

- [ ] **Step 2: Gate SDK init on profile presence**

Replace the existing `useEffect` at lines 134–152 with:

```tsx
useEffect(() => {
  if (!profile) return
  try {
    initSquarePayments()
    canUseApplePay()
      .then((ok) => {
        setApplePayAvailable(ok)
        if (ok) setPayMethod('apple')
      })
      .catch(() => {})
    canUseGooglePay()
      .then((ok) => {
        setGooglePayAvailable(ok)
        if (ok) setPayMethod('google')
      })
      .catch(() => {})
  } catch (e) {
    console.warn('Square SDK init failed:', e)
  }
}, [profile])
```

Use the actual variable name discovered in Step 1 if it differs from `profile`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add app/checkout.tsx
git commit -m "perf(checkout): defer Square SDK init until user is authenticated"
```

---

### Task 3: HeroCarousel autoplay pause on blur

`components/home/HeroCarousel.tsx:56-65` uses `setInterval` that never pauses — burns JS work and Reanimated frames on every screen where the Home tab is backgrounded. Pause when tab is unfocused.

**Files:**
- Modify: `components/home/HeroCarousel.tsx:56-65`

- [ ] **Step 1: Add useIsFocused import**

Add to the imports block:
```tsx
import { useIsFocused } from '@react-navigation/native';
```

- [ ] **Step 2: Gate the interval on focus**

Replace the autoplay effect at lines 56–65 with:

```tsx
const isFocused = useIsFocused();

useEffect(() => {
  if (!isFocused) return;
  const id = setInterval(() => {
    setIndex((prev) => {
      const next = (prev + 1) % SLIDES.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      return next;
    });
  }, AUTOPLAY_MS);
  return () => clearInterval(id);
}, [isFocused]);
```

Place the `useIsFocused()` hook call near the top of the component alongside the other hooks.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add components/home/HeroCarousel.tsx
git commit -m "perf(home): pause hero carousel autoplay when tab is blurred"
```

---

### Task 4: useMenu module-level cache + single-flight

`hooks/use-menu.ts` refetches `/api/catalog` on every hook mount — Menu tab, HeroCarousel, ItemDetailContent all fire fresh requests. Mirror the pattern from `hooks/use-catalog-image-map.ts`.

**Files:**
- Modify: `hooks/use-menu.ts` (full rewrite)

- [ ] **Step 1: Read the reference pattern**

Read `hooks/use-catalog-image-map.ts` — already uses module-level cache + `inFlight` single-flight. The new `useMenu` should follow the same shape but returns `{ items, categories, loading, error, refresh }`.

- [ ] **Step 2: Rewrite use-menu.ts**

Replace the full contents of `hooks/use-menu.ts` with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CatalogItem, CatalogCategory } from '@/types/square'

interface MenuSnapshot {
  items: CatalogItem[]
  categories: CatalogCategory[]
}

interface MenuData extends MenuSnapshot {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

let cache: MenuSnapshot | null = null
let inFlight: Promise<MenuSnapshot> | null = null
const subscribers = new Set<(s: MenuSnapshot) => void>()

function deriveCategories(
  items: CatalogItem[],
  provided?: CatalogCategory[],
): CatalogCategory[] {
  if (provided?.length) return provided
  const catMap = new Map<string, string>()
  for (const item of items) {
    for (const cat of item.itemData?.categories ?? []) {
      if (cat.id && cat.name && !catMap.has(cat.id)) catMap.set(cat.id, cat.name)
    }
  }
  return Array.from(catMap, ([id, name]) => ({ id, name }))
}

async function fetchSnapshot(): Promise<MenuSnapshot> {
  const data = await apiFetch<{ items: CatalogItem[]; categories?: CatalogCategory[] }>(
    '/api/catalog',
  )
  const items = data.items ?? []
  return { items, categories: deriveCategories(items, data.categories) }
}

function load(force = false): Promise<MenuSnapshot> {
  if (!force && cache) return Promise.resolve(cache)
  if (inFlight) return inFlight
  inFlight = fetchSnapshot()
    .then((snap) => {
      cache = snap
      subscribers.forEach((fn) => fn(snap))
      return snap
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useMenu(): MenuData {
  const [snap, setSnap] = useState<MenuSnapshot>(
    () => cache ?? { items: [], categories: [] },
  )
  const [loading, setLoading] = useState(() => !cache)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const sub = (s: MenuSnapshot) => {
      if (mounted.current) setSnap(s)
    }
    subscribers.add(sub)
    if (!cache) {
      setLoading(true)
      load()
        .then(() => mounted.current && setLoading(false))
        .catch((e: unknown) => {
          if (!mounted.current) return
          setError(e instanceof Error ? e.message : 'Failed to load menu')
          setLoading(false)
        })
    }
    return () => {
      mounted.current = false
      subscribers.delete(sub)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menu')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  return { items: snap.items, categories: snap.categories, loading, error, refresh }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass. Consumers (`app/(tabs)/menu.tsx`, `components/home/HeroCarousel.tsx`, others) all destructure the same shape — no call-site changes required.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-menu.ts
git commit -m "perf(menu): module-level cache + single-flight for /api/catalog"
```

---

### Task 5: OrderHistory thumbnail → expo-image

`components/account/OrderHistory.tsx:2` still imports RN `Image` while the rest of the redesigned app uses `expo-image` (disk cache, memory cache, faster decode).

**Files:**
- Modify: `components/account/OrderHistory.tsx:2`, and the `<Image>` usage around line 164

- [ ] **Step 1: Swap import**

Open `components/account/OrderHistory.tsx`. In the import at line 2, remove `Image` from the `react-native` import and add a new line:

```tsx
import { Image } from 'expo-image'
```

- [ ] **Step 2: Update the thumbnail <Image>**

Find `<Image source={{ uri: thumb }} style={styles.thumb} />` (around line 164). Replace with:

```tsx
<Image
  source={{ uri: thumb }}
  style={styles.thumb}
  contentFit="cover"
  contentPosition="center"
  transition={120}
/>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add components/account/OrderHistory.tsx
git commit -m "perf(orders): use expo-image for order thumbnails"
```

---

### Task 6: ItemDetailContent — stop allocating empty Set per render

`components/menu/ItemDetailContent.tsx:272` evaluates `selectedByList[ml.id] ?? new Set()` inside every `map` iteration on every render. Hoist a single shared empty Set.

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx:272`

- [ ] **Step 1: Add module-level constant**

Near the top of the file, below the `EXCLUSIVE_TOPPINGS` line (around line 23), add:

```tsx
const EMPTY_SELECTION: ReadonlySet<string> = new Set()
```

- [ ] **Step 2: Use it in the modifierLists map**

In the modifierLists render loop, replace:

```tsx
const selected = selectedByList[ml.id] ?? new Set()
```

with:

```tsx
const selected = selectedByList[ml.id] ?? EMPTY_SELECTION
```

Since `selected.has(...)` is the only usage downstream, `ReadonlySet` is safe.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass. If TS complains about `ReadonlySet` on a site that mutates `selected`, downgrade the constant to `Set<string>` (the value is never mutated at runtime; readonly is just a type-level hint).

- [ ] **Step 4: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "perf(item-sheet): hoist empty selection Set to module scope"
```

---

## Batch 2 — Sequential (larger refactors / touch shared infra)

### Task 7: Menu page → SectionList virtualization

`app/(tabs)/menu.tsx` renders every item inside a flat ScrollView (`sections.map` → items.map → ProductRow). With 7 categories × ~10 items each, ~70 ProductRow components mount up-front, each with Reanimated shared values. Convert to `SectionList`.

**Files:**
- Modify: `app/(tabs)/menu.tsx` (significant rewrite of the non-searching render path)

- [ ] **Step 1: Read and confirm the behavior contract**

Re-read `app/(tabs)/menu.tsx`. The existing contract to preserve:
1. Left sidebar shows category tabs; tapping one scrolls the right pane to that section.
2. Scrolling the right pane updates the active sidebar tab.
3. Search mode (when `searching === true`) is a flat list — keep unchanged.
4. `CategorySection` renders a banner header + items; `ProductRow` renders each item.

- [ ] **Step 2: Introduce SectionList**

In the non-searching branch (`) : (`), replace the right pane's `<ScrollView ref={scrollRef} …>…{sections.map(...)}</ScrollView>` with a `SectionList`:

```tsx
import { SectionList, type SectionListData } from 'react-native'
// ...

type Section = SectionListData<CatalogItem, { category: CatalogCategory; index: number }>

const sectionListData: Section[] = sections.map((s, i) => ({
  category: s.category,
  index: i,
  data: s.items,
}))

const sectionListRef = useRef<SectionList<CatalogItem, { category: CatalogCategory; index: number }>>(null)
```

Replace the existing `<ScrollView ...>` in the non-searching branch with:

```tsx
<SectionList
  ref={sectionListRef}
  style={styles.main}
  contentContainerStyle={styles.mainContent}
  sections={sectionListData}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ProductRow item={item} />}
  renderSectionHeader={({ section }) => (
    <SectionHeader category={section.category} index={section.index} />
  )}
  stickySectionHeadersEnabled={false}
  showsVerticalScrollIndicator={false}
  scrollEventThrottle={16}
  keyboardDismissMode="on-drag"
  initialNumToRender={12}
  maxToRenderPerBatch={8}
  windowSize={5}
  removeClippedSubviews
  onScroll={handleScroll}
  onMomentumScrollEnd={handleMomentumEnd}
  onScrollEndDrag={handleMomentumEnd}
  onScrollBeginDrag={Keyboard.dismiss}
  onViewableItemsChanged={onViewableChanged}
  viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
/>
```

- [ ] **Step 3: Extract SectionHeader**

Split the current `CategorySection` into two pieces: a pure `SectionHeader` (the banner + title markup above the `items.map` line) and let the `SectionList` render each `ProductRow` itself:

```tsx
const SectionHeader = memo(function SectionHeader({
  category,
  index,
}: {
  category: CatalogCategory
  index: number
}) {
  const banner = categoryBanner(category.name)
  const indexLabel = String(index + 1).padStart(2, '0')
  return (
    <View style={styles.sectionHeader}>
      <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{`CATEGORY ${indexLabel}`}</Text>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {category.name}
      </Text>
      {banner ? (
        <View style={styles.bannerWrap}>
          <Image source={banner} style={styles.sectionBanner} contentFit="cover" contentPosition="center" />
          <View style={styles.bannerOverlay} pointerEvents="none" />
        </View>
      ) : null}
    </View>
  )
})
```

Delete the old `CategorySection` component once the SectionList replaces it.

- [ ] **Step 4: Replace scroll-to-section logic**

The old `handleTabPress` used `sectionOffsets.current[id]` + `scrollTo(y)`. Replace with `scrollToLocation`:

```tsx
const handleTabPress = useCallback(
  (id: string) => {
    Keyboard.dismiss()
    const sectionIndex = sections.findIndex((s) => s.category.id === id)
    if (sectionIndex < 0) return
    scrollingToRef.current = id
    setActiveId(id)
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    })
  },
  [sections],
)
```

Remove `sectionOffsets` and related `onLayoutY` plumbing — `SectionList` tracks positions internally.

- [ ] **Step 5: Replace active-tab tracking with onViewableItemsChanged**

Replace `handleScroll` / `handleMomentumEnd` contentOffset math with:

```tsx
const onViewableChanged = useRef<
  NonNullable<React.ComponentProps<typeof SectionList>['onViewableItemsChanged']>
>(({ viewableItems }) => {
  if (scrollingToRef.current) return
  const first = viewableItems[0]
  const section = first?.section as { category?: CatalogCategory } | undefined
  const id = section?.category?.id
  if (id && id !== activeId) setActiveId(id)
}).current
```

Because `onViewableItemsChanged` requires a stable function reference, keep it inside `useRef` (as above) OR wrap in `useCallback` with `[activeId]` — but then also set a stable ref alternative to avoid a SectionList dev warning. The `useRef` form is simpler.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/\(tabs\)/menu.tsx`
Expected: pass. If the SectionList generic types complain, simplify `Section` to `SectionListData<CatalogItem>` and pull `category` / `index` off section via `section: any` inside `renderSectionHeader`.

- [ ] **Step 7: Manual smoke test (ask user)**

Print: "Please test on the dev build: open the Menu tab → tap each sidebar category → confirm the right pane scrolls to that section, and that scrolling the pane highlights the correct sidebar tab. Also confirm search still works. Reply `ok` or describe any regression."

- [ ] **Step 8: Commit**

```bash
git add app/\(tabs\)/menu.tsx
git commit -m "perf(menu): virtualize menu items with SectionList"
```

---

### Task 8: Fix AuthProvider loading race

Documented in handoff: `components/auth/AuthProvider.tsx` has a race where `loading` can stick `true` when `fetchMe` and `onAuthStateChange` interleave with the useEffect keyed on `session?.user?.id`. The `AuthGate` workaround at `components/auth/AuthGate.tsx:32` papers over symptoms. Fix the root cause.

**Files:**
- Modify: `components/auth/AuthProvider.tsx:171-182`
- Modify: `components/auth/AuthGate.tsx:32` (revert workaround to original shape)

- [ ] **Step 1: Scope the race precisely**

Reread `components/auth/AuthProvider.tsx:139-182`. The race: `onAuthStateChange` sets `loading=true` on SIGNED_IN, then the keyed useEffect *also* sets `loading=true` before awaiting `fetchMe`. If `fetchMe` resolves fast and the effect cleanup runs mid-flight (during a StrictMode-like double invocation or a rapid token refresh), the second `setLoading(false)` can be skipped.

- [ ] **Step 2: Guard the keyed effect with a local flag**

Replace the effect at lines 171–182 with:

```tsx
useEffect(() => {
  let cancelled = false
  setLoading(true)
  fetchMe()
    .catch(() => {})
    .finally(() => {
      if (!cancelled) setLoading(false)
    })
  return () => {
    cancelled = true
  }
}, [session?.user?.id, fetchMe])
```

`cancelled` ensures we never flip `loading` from an unmounted/stale effect.

- [ ] **Step 3: Also guard completeSignup's trailing fetchMe**

In `completeSignup` (lines 210–225), the trailing `await fetchMe()` hydrates state — but it doesn't flip `loading`, and the caller's `router.replace('/(tabs)')` fires as soon as this promise resolves. No change needed, but verify the code path:

```tsx
setProfile(json.profile)
await fetchMe()
return json.profile
```

Leave as-is.

- [ ] **Step 4: Revert AuthGate splash condition**

With the root race fixed, `AuthGate.tsx:32` can go back to the clean form:

```tsx
{loading && needsAuth && (
```

Keep `!onLogin` if the login page still needs to manage its own busy state without overlay — re-read `app/login.tsx` to confirm. If login has its own busy UI, the condition becomes:

```tsx
{loading && needsAuth && !onLogin && (
```

Choose the minimal condition that (a) shows splash on cold-start when auth is hydrating, (b) never shows when session+profile are both present, (c) never shows over the login page. Remove the redundant comment references in `AuthGate.tsx` that described the old workaround.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Manual smoke test (ask user)**

Print: "Please test Supabase Auth on dev build: (a) cold launch signed-in → tabs render without splash stuck, (b) sign out → login renders, (c) Google/Apple login → tabs render after OTP, no stuck splash, (d) completeSignup flow for new user → tabs render. Reply `ok` or describe any regression."

- [ ] **Step 7: Commit**

```bash
git add components/auth/AuthProvider.tsx components/auth/AuthGate.tsx
git commit -m "fix(auth): guard loading flag against race on session-keyed effect"
```

---

### Task 9: apiFetch — cache Supabase access token

`lib/api.ts:6` awaits `supabase.auth.getSession()` on every call. That's a JS bridge round-trip to AsyncStorage-backed session each time. Cache the latest token in memory, refresh it from Supabase's `onAuthStateChange`.

**Files:**
- Modify: `lib/api.ts` (full rewrite, ~30 lines)

- [ ] **Step 1: Rewrite lib/api.ts**

Replace the file with:

```tsx
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

let cachedToken: string | null = null
let hydratePromise: Promise<void> | null = null

function hydrateOnce(): Promise<void> {
  if (hydratePromise) return hydratePromise
  hydratePromise = supabase.auth.getSession().then(({ data }) => {
    cachedToken = data.session?.access_token ?? null
  })
  return hydratePromise
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null
})

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (cachedToken === null && !hydratePromise) {
    await hydrateOnce()
  } else if (hydratePromise) {
    await hydratePromise
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (cachedToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${cachedToken}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}
```

Key properties:
- First call hydrates from Supabase (single-flight via `hydratePromise`).
- `onAuthStateChange` keeps `cachedToken` current — TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT all fire this callback.
- No ongoing `getSession()` round-trips in the hot path.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass. All callers use the same `apiFetch<T>(path, options?)` signature.

- [ ] **Step 3: Manual smoke test (ask user)**

Print: "Please verify on dev build: (a) after fresh login, catalog/orders/loyalty load OK, (b) after sign-out, protected endpoints 401 cleanly (no stale token), (c) 24h later (token refresh window), API still works. Reply `ok` or describe any regression."

- [ ] **Step 4: Commit**

```bash
git add lib/api.ts
git commit -m "perf(api): cache Supabase access token in memory"
```

---

## Batch 3 — Polish

### Task 10: Account screen — memoize children + cap active-order poll work

`app/(tabs)/account.tsx` renders 8 children under a single ScrollView and polls `refreshOrders()` every 10s when an active order exists. Two micro-fixes:

**Files:**
- Modify: `app/(tabs)/account.tsx` — no structural change, just guardrails

- [ ] **Step 1: Check that child cards are already memoized**

Open each of: `AccountHeader`, `WelcomeDiscountCard`, `LoyaltyCard`, `MemberQrCard`, `PromotionsCard`, `OrderHistory`, `ActivityHistory`, `SettingsList`. Confirm each is wrapped in `memo(...)` OR exported as a pure function. If any is not wrapped (e.g., direct `export function Foo`), wrap the export in `memo`.

- [ ] **Step 2: Pause the 10s poll when the tab is blurred**

`useFocusEffect` already handles unmount-on-blur — the `return () => clearInterval(id)` cleanup runs on blur. So the interval is already focus-gated. No change needed. Document the check in the PR description.

- [ ] **Step 3: Stabilize EMPTY_LOYALTY reference**

The `EMPTY_LOYALTY` const is already at module scope (line 32) — confirm no per-render allocation. No change.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit if any memo wraps were added**

```bash
git add components/account/*.tsx # whichever got wrapped
git commit -m "perf(account): memoize account subcards"
```

If no changes were needed, skip the commit and proceed.

---

### Task 11: React Compiler sanity check

`app.json` has `experiments.reactCompiler: true` but `package.json` does not list `react-compiler-runtime`. Verify the compiler is actually running; if not, either add the runtime or drop the flag.

**Files:**
- Verify: `app.json`, `package.json`, `babel.config.js` (may not exist yet)

- [ ] **Step 1: Check for babel config**

Run: `ls /Users/stanyan/Github/mandys_bubble_tea_app/babel.config.js /Users/stanyan/Github/mandys_bubble_tea_app/babel.config.*`
If none exists, Expo's default preset is in effect. Expo 54 + `experiments.reactCompiler: true` auto-injects the babel plugin via `babel-preset-expo` only if `react-compiler-runtime` is installed.

- [ ] **Step 2: Check runtime dependency**

Run: `cd /Users/stanyan/Github/mandys_bubble_tea_app && npm ls react-compiler-runtime 2>&1 | head -5`
If "empty" or "missing", compiler is NOT active — `experiments.reactCompiler: true` is a no-op.

- [ ] **Step 3: Decide install vs drop**

If user wants compiler on → run `npx expo install react-compiler-runtime` (use `npx expo install` not `npm install` so Expo resolves a compatible version).
If user wants to keep bundle lean → remove `experiments.reactCompiler: true` from `app.json`.

**Default: install the runtime.** React Compiler gives free memoization across the app and pays for itself vs the ~10KB runtime. Verify runtime is added to `package.json` dependencies.

- [ ] **Step 4: Verify the plugin actually runs**

Run the dev server: `npx expo start --dev-client` in the background. Look for a log line mentioning `react-compiler` / `babel-plugin-react-compiler` during bundle. If absent, Metro cache may be stale — run `npx expo start --dev-client -c` to clear cache and retry.

- [ ] **Step 5: Commit**

```bash
git add app.json package.json package-lock.json
git commit -m "chore(compiler): ensure react-compiler-runtime is installed for the RC flag"
```

If the decision was to drop the flag instead, commit the `app.json` removal only:

```bash
git add app.json
git commit -m "chore: drop unused react-compiler flag"
```

---

## Post-batch final verification

After all three batches:

- [ ] **Final typecheck + lint**: `npx tsc --noEmit && npx eslint .`
      Expected: no regressions vs baseline recorded at the start. Any new issue must be addressed before reporting done.

- [ ] **Bundle size sanity**: `npx expo export --platform ios` into a temp folder, compare `dist/*.hbc` size before/after if possible (optional — skip if user doesn't want to wait).

- [ ] **Handoff update**: write a one-paragraph summary of what changed for `~/system/DEV_HANDOFF.md` at session end.

---

## Notes for the executing agents

- **DRY**: Tasks 1, 2, 3, 5, 6 are narrow, local edits — handle them inline without spawning further subagents.
- **YAGNI**: Don't refactor anything outside the task boundary. If you notice unrelated issues, note them in the final summary — don't "also fix while I'm here".
- **TDD not applicable**: There are no unit tests in this repo. Smoke testing falls to the user on the dev build (explicitly called out in Tasks 7, 8, 9).
- **Commit after every task**, not at the end. Small commits make bisecting regressions trivial.
- **Assume the user is not reading between tasks** — write commit messages that stand alone.
