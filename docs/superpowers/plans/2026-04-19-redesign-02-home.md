# Redesign Phase 2 — Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Home screen to the Phase 2 design using only Phase 1 tokens (`T`, `TYPE`, `FONT`, `SHADOW`, `RADIUS`) — zero new `BRAND` imports on Home.

**Architecture:** Ten focused components under `components/home/` + a `helpers.ts` of pure utilities, composed by a rewritten `app/(tabs)/index.tsx` that renders `<HomeHeader />` → `<HomeLoyaltyHero />` → `<YourUsual />` → `<DailySpecial />` → `<CategoriesStrip />` → `<HotPicks />` → `<StoreCard />` inside a single `<ScrollView>` with `<MiniCartBar />` overlaid. Widgets self-gate on empty states (signed-out / no orders / no discount). No backend changes; data comes from `useAuth()`, `useCartStore()`, `useOrdersStore()`, `useMenu()`.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19 / expo-router / TypeScript / react-native-svg / expo-linear-gradient / zustand.

Spec: `docs/superpowers/specs/2026-04-19-redesign-02-home.md`

---

## File Structure

**New:**
- `components/home/helpers.ts` — pure utilities (`computeYourUsual`, `getStoreStatus`, `normalizeSlug`, `timeGreeting`)
- `components/home/SectionHead.tsx` — shared section header (label + optional eyebrow, count, action)
- `components/home/HomeHeader.tsx` — greeting + name + bell + bag + Southport status pill
- `components/home/HomeLoyaltyHero.tsx` — brand-gradient hero with 9-cup progress (inline `CupProgressRow` sub-component)
- `components/home/YourUsual.tsx` — single most-ordered card with 1-tap re-add
- `components/home/DailySpecial.tsx` — peach welcome-discount card
- `components/home/CategoriesStrip.tsx` — horizontal strip of 7 hardcoded category tiles
- `components/home/StoreCard.tsx` — sage map thumbnail + Directions

**Modified:**
- `components/home/HeroCarousel.tsx` — token-only re-skin + `HotPicks` named alias export
- `app/(tabs)/index.tsx` — full rewrite

**Deleted:**
- `app/dev/theme-showcase.tsx`

**Unreferenced, left on disk:**
- `components/home/WelcomeDiscountBanner.tsx`
- `assets/images/hero-banner.webp`
- `assets/images/hero-banner-signed-out.webp`

---

## Conventions

- All file paths are absolute from repo root `/Users/stanyan/Github/mandys_bubble_tea_app/`.
- `tsc --noEmit` is the primary gate. The project has no jest / vitest — helpers ship with `// @verification` comments documenting expected outputs rather than runtime tests, and every task ends with a `npx tsc --noEmit` green run.
- All commits on `main` (no worktree for this phase per user preference; Phase 3d auth WIP stays untouched).
- Imports use `@/` alias.
- Never import from `@/lib/constants` for `BRAND` in new files; use `T` tokens.
- `cartCount = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0))`.

---

## Task 0: Preflight — delete dev showcase, verify gradient dep

**Files:**
- Delete: `app/dev/theme-showcase.tsx`

- [ ] **Step 1: Confirm `expo-linear-gradient` in `package.json`**

Run: `grep expo-linear-gradient package.json`
Expected: line containing `"expo-linear-gradient": "~15.0.8"` (or similar). If missing, run `npx expo install expo-linear-gradient` and commit the `package.json` / `package-lock.json` delta as a separate atomic commit before proceeding.

- [ ] **Step 2: Confirm no references to the dev route remain**

Run: `grep -r "theme-showcase\|dev/theme" app components --include="*.tsx" --include="*.ts"`
Expected: only the route file itself, no imports / `router.push` calls elsewhere.

- [ ] **Step 3: Delete the dev route**

Run: `rm app/dev/theme-showcase.tsx && rmdir app/dev 2>/dev/null || true`
Expected: directory gone if it was empty, otherwise directory stays (other files unrelated to this spec).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (`expo lint` may print the usual Expo hints but zero new errors/warnings).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(home): retire /dev/theme-showcase route (phase 1 exit)"
```

---

## Task 1: `components/home/helpers.ts` — pure utilities

**Files:**
- Create: `components/home/helpers.ts`

- [ ] **Step 1: Create the file with all four helpers**

```tsx
// components/home/helpers.ts
import type { OrderHistoryItem, OrderHistoryLine, OrderHistoryLineModifier } from '@/store/orders';

export type YourUsualItem = {
  key: string;
  itemId: string;
  variationId: string;
  name: string;
  variationName?: string;
  modifiers: Array<{ id: string; name: string; listName: string; priceCents: number }>;
  size?: string;
  subtitle: string;
  priceCents: number;
  imageUrl?: string;
  count: number;
};

// @verification
// Given two orders each with one "Brown Sugar Milk Tea | L | 50% sugar | less ice",
// returns that item with count=2. Ties broken by latest order (first in the array
// — orders store is newest-first per store/orders.ts).
export function computeYourUsual(orders: OrderHistoryItem[]): YourUsualItem | null {
  const groups = new Map<string, { item: YourUsualItem; latestIndex: number }>();
  for (let idx = 0; idx < orders.length; idx++) {
    const order = orders[idx];
    if (order.state === 'CANCELED') continue;
    for (const line of order.lineItems ?? []) {
      if (!line.variationId) continue;
      const key = buildLineKey(line);
      const existing = groups.get(key);
      if (existing) {
        existing.item.count += line.quantity || 1;
        if (idx < existing.latestIndex) existing.latestIndex = idx;
      } else {
        groups.set(key, { item: toUsual(line, key), latestIndex: idx });
      }
    }
  }
  if (!groups.size) return null;
  let winner: { item: YourUsualItem; latestIndex: number } | null = null;
  for (const entry of groups.values()) {
    if (!winner) { winner = entry; continue; }
    if (entry.item.count > winner.item.count) { winner = entry; continue; }
    if (entry.item.count === winner.item.count && entry.latestIndex < winner.latestIndex) {
      winner = entry;
    }
  }
  return winner?.item ?? null;
}

function buildLineKey(line: OrderHistoryLine): string {
  const modIds = (line.modifiers ?? [])
    .map((m) => m.id || `${m.listName}:${m.name}`)
    .sort()
    .join(',');
  return `${line.variationId}::${modIds}`;
}

function toUsual(line: OrderHistoryLine, key: string): YourUsualItem {
  const modifiers = (line.modifiers ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    listName: m.listName,
    priceCents: Number(m.priceCents) || 0,
  }));
  const size = modifiers.find((m) => normalizeListName(m.listName) === 'size')?.name;
  const subtitle = buildSubtitle(modifiers, size);
  const base = Number(line.basePriceCents) || 0;
  const mods = modifiers.reduce((sum, m) => sum + m.priceCents, 0);
  return {
    key,
    itemId: line.itemId,
    variationId: line.variationId,
    name: line.name,
    variationName: line.variationName || undefined,
    modifiers,
    size,
    subtitle,
    priceCents: base + mods,
    imageUrl: line.imageUrl || undefined,
    count: line.quantity || 1,
  };
}

function normalizeListName(listName: string): string {
  return (listName || '').toLowerCase();
}

function buildSubtitle(mods: YourUsualItem['modifiers'], size?: string): string {
  const parts: string[] = [];
  if (size) parts.push(size);
  const sugar = mods.find((m) => normalizeListName(m.listName).includes('sugar'))?.name;
  if (sugar) parts.push(sugar);
  const ice = mods.find((m) => normalizeListName(m.listName).includes('ice'))?.name;
  if (ice) parts.push(ice);
  const toppings = mods
    .filter((m) => normalizeListName(m.listName).includes('topping'))
    .map((m) => m.name);
  if (toppings.length) parts.push(toppings.join(', '));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------

export type StoreStatus = { open: boolean; nextLabel: string };

// Store runs 09:00–21:00 Australia/Brisbane (UTC+10, no DST) every day per
// AGENTS.md / .claude/CLAUDE.md. YAGNI: no holiday exceptions.
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

// @verification
// getStoreStatus(new Date('2026-04-19T03:00:00Z')) // 13:00 Brisbane → open, "until 9pm"
// getStoreStatus(new Date('2026-04-19T13:00:00Z')) // 23:00 Brisbane → closed, "9am tomorrow"
// getStoreStatus(new Date('2026-04-18T22:00:00Z')) // 08:00 Brisbane Sat → closed, "9am"
export function getStoreStatus(now: Date = new Date()): StoreStatus {
  const brisbaneMs = now.getTime() + (10 * 60 - now.getTimezoneOffset() + now.getTimezoneOffset()) * 60 * 1000;
  // Express current moment as Brisbane hour — convert via UTC + 10h offset.
  const brisbane = new Date(now.getTime() + (10 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  const hour = brisbane.getUTCHours();
  const isOpen = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  if (isOpen) {
    return { open: true, nextLabel: `until ${formatHour(CLOSE_HOUR)}` };
  }
  const beforeOpen = hour < OPEN_HOUR;
  return {
    open: false,
    nextLabel: beforeOpen ? `${formatHour(OPEN_HOUR)}` : `${formatHour(OPEN_HOUR)} tomorrow`,
  };
}

function formatHour(h24: number): string {
  const suffix = h24 < 12 || h24 === 24 ? 'am' : 'pm';
  const mod = h24 % 12;
  const label = mod === 0 ? 12 : mod;
  return `${label}${suffix}`;
}

// ---------------------------------------------------------------------

// @verification
// normalizeSlug('Fruity Black Tea') === 'fruity-black-tea'
// normalizeSlug('Cheese Cream') === 'cheese-cream'
// normalizeSlug('MILKY') === 'milky'
export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------

// @verification
// timeGreeting(new Date('2026-04-19T00:00:00Z')) // 10:00 Brisbane → 'Good morning'
// timeGreeting(new Date('2026-04-19T05:00:00Z')) // 15:00 Brisbane → 'Good afternoon'
// timeGreeting(new Date('2026-04-19T10:00:00Z')) // 20:00 Brisbane → 'Good evening'
export function timeGreeting(now: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const brisbane = new Date(now.getTime() + (10 * 60 + now.getTimezoneOffset()) * 60 * 1000);
  const hour = brisbane.getUTCHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
```

Note the Brisbane-offset math is intentionally duplicated (DRY-violation acceptance) between `getStoreStatus` and `timeGreeting` — they're both one-liners using the same public API, and extracting a fourth helper for two callers is premature.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Manually verify helper outputs**

Open a fresh node REPL and paste compiled output, or add a temporary `app/dev/helpers-probe.tsx` that logs `computeYourUsual(mock)`, `getStoreStatus(new Date())`, `normalizeSlug('Fruity Black Tea')`, `timeGreeting(new Date())` and visit it in the dev client to confirm outputs match the `// @verification` comments. Revert the probe before committing.

- [ ] **Step 4: Commit**

```bash
git add components/home/helpers.ts
git commit -m "feat(home): add computeYourUsual / getStoreStatus / normalizeSlug / timeGreeting helpers"
```

---

## Task 2: `components/home/SectionHead.tsx`

**Files:**
- Create: `components/home/SectionHead.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/SectionHead.tsx
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE } from '@/constants/theme';

export type SectionHeadProps = {
  label: string;
  eyebrow?: string;
  count?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHead({ label, eyebrow, count, actionLabel, onAction }: SectionHeadProps) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
      {eyebrow ? (
        <Text style={[TYPE.eyebrow, { color: T.brand, marginBottom: 4 }]}>{eyebrow}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[TYPE.screenTitleSm, { color: T.ink }]}>{label}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[TYPE.bodyStrong, { color: T.brand }]}>{actionLabel}</Text>
            <Icon name="chevR" color={T.brand} size={14} />
          </Pressable>
        ) : count ? (
          <Text style={[TYPE.body, { color: T.ink3 }]}>{count}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/SectionHead.tsx
git commit -m "feat(home): add SectionHead shared header component"
```

---

## Task 3: `components/home/HomeHeader.tsx`

**Files:**
- Create: `components/home/HomeHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/HomeHeader.tsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCartStore } from '@/store/cart';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE } from '@/constants/theme';
import { timeGreeting, getStoreStatus } from './helpers';

export function HomeHeader() {
  const router = useRouter();
  const { profile } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  const greeting = timeGreeting();
  const firstName = profile?.first_name?.trim() || (profile ? 'Mandy' : 'Welcome');
  const nameSuffix = profile ? '.' : '.';
  const salutation = profile ? `${greeting},` : 'Hi there,';

  const status = getStoreStatus();

  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text style={[TYPE.body, { color: T.ink3 }]}>{salutation}</Text>
          <Text
            style={{
              fontFamily: 'Fraunces_500Medium',
              fontSize: 30,
              lineHeight: 33,
              letterSpacing: -0.8,
              color: T.ink,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {firstName}{nameSuffix}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            hitSlop={6}
            onPress={() => { /* notifications out of scope */ }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="bell" color={T.ink} size={20} />
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: T.peach,
                borderWidth: 1.5,
                borderColor: T.paper,
              }}
            />
          </Pressable>

          <Pressable
            hitSlop={6}
            onPress={() => router.push('/(tabs)/cart')}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="bag" color={T.ink} size={20} />
            {cartCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  paddingHorizontal: 4,
                  backgroundColor: T.peach,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: T.ink }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View
        style={{
          alignSelf: 'flex-start',
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
          paddingLeft: 8,
          paddingRight: 10,
          borderRadius: 999,
          backgroundColor: 'rgba(162,173,145,0.25)',
        }}
      >
        <Icon name="pin" color={T.brand} size={10} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.ink2 }}>
          Southport · 34 Davenport St
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.ink3 }}>·</Text>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 11.5,
            color: status.open ? T.greenDark : T.ink3,
          }}
        >
          {status.open ? `Open ${status.nextLabel}` : `Opens ${status.nextLabel}`}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/HomeHeader.tsx
git commit -m "feat(home): add HomeHeader greeting + bell/bag + Southport status pill"
```

---

## Task 4: `components/home/HomeLoyaltyHero.tsx` (includes inline `CupProgressRow`)

**Files:**
- Create: `components/home/HomeLoyaltyHero.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/HomeLoyaltyHero.tsx
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HomeLoyaltyHero() {
  const router = useRouter();
  const { profile, loyalty, starsPerReward } = useAuth();

  if (!profile) return null;

  const balance = loyalty?.balance ?? 0;
  const goal = starsPerReward ?? 9;
  const toGo = Math.max(0, goal - balance);
  const reached = balance >= goal;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <AnimatedPressable
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 160 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 160 }); }}
        onPress={() => router.push('/promotions')}
        style={[animatedStyle, { borderRadius: RADIUS.card, ...SHADOW.miniCart, shadowColor: T.brandDark }]}
      >
        <LinearGradient
          colors={[T.brand, T.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: RADIUS.card, padding: 22, overflow: 'hidden' }}
        >
          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: T.peach }} />
                <Text style={[TYPE.eyebrow, { color: 'rgba(255,255,255,0.7)' }]}>
                  MANDY&apos;S REWARDS
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 36,
                    lineHeight: 36,
                    letterSpacing: -0.8,
                    color: '#fff',
                  }}
                >
                  {balance}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 24,
                    color: 'rgba(255,255,255,0.45)',
                    marginLeft: 6,
                  }}
                >
                  {` / ${goal} stars`}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Icon name="star" color={T.peach} size={12} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#fff' }}>
                Member
              </Text>
            </View>
          </View>

          {/* Cups */}
          <CupProgressRow value={balance} total={goal} />

          {/* Bottom row */}
          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)', flex: 1, paddingRight: 12 }]}>
              {reached ? (
                '🎉 Free drink ready to redeem'
              ) : (
                <>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fff' }}>{toGo}</Text>
                  {` stars until a free drink`}
                </>
              )}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: reached ? T.peach : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12.5,
                  color: reached ? T.brandDark : '#fff',
                }}
              >
                {reached ? 'Redeem' : 'View'}
              </Text>
              <Icon name="arrow" color={reached ? T.brandDark : '#fff'} size={12} />
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
}

// Inline sub-component — not reused; Account's LoyaltyCard variant lives in Phase 6.
function CupProgressRow({ value, total }: { value: number; total: number }) {
  const cups = Array.from({ length: total }, (_, i) => i < value);
  return (
    <View
      style={{
        marginTop: 22,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}
    >
      {cups.map((filled, i) => (
        <View
          key={i}
          style={{
            width: 22,
            height: 28,
            transform: filled ? [] : [{ translateY: 2 }],
            opacity: filled ? 1 : 0.35,
          }}
        >
          <Svg width={22} height={28} viewBox="0 0 22 28">
            {/* lid */}
            <Rect
              x={2}
              y={5}
              width={18}
              height={2.6}
              rx={1}
              fill={filled ? T.peach : 'none'}
              stroke="#fff"
              strokeWidth={1.2}
            />
            {/* body (trapezoid) */}
            <Path
              d="M3.4 8 L18.6 8 L17 24 Q17 26 15 26 L7 26 Q5 26 5 24 Z"
              fill={filled ? T.peach : 'none'}
              stroke="#fff"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/HomeLoyaltyHero.tsx
git commit -m "feat(home): add HomeLoyaltyHero brand-gradient card with 9-cup progress"
```

---

## Task 5: `components/home/YourUsual.tsx`

**Files:**
- Create: `components/home/YourUsual.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/YourUsual.tsx
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useOrdersStore } from '@/store/orders';
import { useCartStore } from '@/store/cart';
import { Icon } from '@/components/brand/Icon';
import { CupArt } from '@/components/brand/CupArt';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { SectionHead } from './SectionHead';
import { computeYourUsual } from './helpers';

export function YourUsual() {
  const orders = useOrdersStore((s) => s.orders);
  const addItem = useCartStore((s) => s.addItem);
  const usual = useMemo(() => computeYourUsual(orders), [orders]);
  const [adding, setAdding] = useState(false);

  if (!usual) return null;

  const onAdd = () => {
    addItem({
      id: usual.itemId,
      variationId: usual.variationId,
      name: usual.name,
      price: usual.priceCents,
      imageUrl: usual.imageUrl,
      variationName: usual.variationName,
      modifiers: usual.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        listName: m.listName,
        priceCents: m.priceCents,
      })),
    });
    setAdding(true);
    setTimeout(() => setAdding(false), 900);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead label="Your usual" count={`ordered ${usual.count}×`} />
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            backgroundColor: T.card,
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: T.line,
            ...SHADOW.card,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: T.sage,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {usual.imageUrl ? (
              <Image
                source={{ uri: usual.imageUrl }}
                style={{ width: 72, height: 72 }}
                contentFit="cover"
              />
            ) : (
              <CupArt fill={T.brand} stroke={T.ink} size={48} />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: 'Fraunces_500Medium',
                fontSize: 18,
                lineHeight: 21,
                letterSpacing: -0.3,
                color: T.ink,
              }}
              numberOfLines={1}
            >
              {usual.name}
            </Text>
            {usual.subtitle ? (
              <Text
                style={[TYPE.body, { color: T.ink3, marginTop: 2 }]}
                numberOfLines={1}
              >
                {usual.subtitle}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 13,
                color: T.ink2,
                marginTop: 4,
              }}
            >
              {`A$${(usual.priceCents / 100).toFixed(2)}`}
            </Text>
          </View>

          <Pressable
            onPress={onAdd}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: adding ? 0.92 : pressed ? 0.95 : 1 }],
              shadowColor: 'rgba(141,85,36,0.5)',
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 14,
              elevation: 3,
            })}
          >
            {adding ? (
              <Icon name="check" color="#fff" size={16} />
            ) : (
              <Icon name="plus" color="#fff" size={18} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/YourUsual.tsx
git commit -m "feat(home): add YourUsual card with one-tap re-add"
```

---

## Task 6: `components/home/DailySpecial.tsx`

**Files:**
- Create: `components/home/DailySpecial.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/DailySpecial.tsx
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth/AuthProvider';
import { CupArt } from '@/components/brand/CupArt';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS } from '@/constants/theme';

export function DailySpecial() {
  const router = useRouter();
  const { profile, welcomeDiscount } = useAuth();

  if (!profile) return null;
  if (!welcomeDiscount?.available) return null;

  const drinksRemaining = welcomeDiscount.drinksRemaining ?? 2;
  const pct = welcomeDiscount.percentage ?? 30;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <Pressable
        onPress={() => router.push('/(tabs)/menu')}
        style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
      >
        <LinearGradient
          colors={[T.peach, '#FFCFA3', T.cream]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: 'rgba(141,85,36,0.12)',
            padding: 22,
            minHeight: 180,
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, paddingRight: 6, justifyContent: 'space-between' }}>
            <View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 4,
                  backgroundColor: T.ink,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_700Bold',
                    fontSize: 10,
                    letterSpacing: 1.3,
                    color: T.cream,
                  }}
                >
                  NEW MEMBER OFFER
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: 'Fraunces_500Medium',
                  fontSize: 24,
                  lineHeight: 26,
                  letterSpacing: -0.5,
                  color: T.ink,
                }}
              >
                {`First ${drinksRemaining} `}
                <Text style={{ fontFamily: 'Fraunces_500Medium', fontStyle: 'italic' }}>milk teas</Text>
                {`\n— ${pct}% off`}
              </Text>
              <Text
                style={[TYPE.body, { marginTop: 8, color: T.ink2, lineHeight: 18, maxWidth: 180 }]}
              >
                Welcome gift for new members. Auto-applied at checkout.
              </Text>
            </View>

            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: T.ink,
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: T.cream }}>
                Start ordering
              </Text>
              <Icon name="arrow" color={T.cream} size={12} />
            </View>
          </View>

          <View
            style={{
              width: 130,
              alignItems: 'flex-end',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: -30,
                top: -20,
                width: 150,
                height: 150,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: 'rgba(42,30,20,0.18)',
                borderStyle: 'dashed',
              }}
            />
            <View
              style={{
                transform: [{ rotate: '-4deg' }, { translateY: 6 }],
                shadowColor: 'rgba(107,62,21,1)',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <CupArt fill="#FFC875" stroke={T.ink} size={100} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/DailySpecial.tsx
git commit -m "feat(home): add DailySpecial peach welcome-discount card"
```

---

## Task 7: `components/home/CategoriesStrip.tsx`

**Files:**
- Create: `components/home/CategoriesStrip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/CategoriesStrip.tsx
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMenu } from '@/hooks/use-menu';
import { T, TYPE, RADIUS } from '@/constants/theme';
import { SectionHead } from './SectionHead';
import { normalizeSlug } from './helpers';

type HomeCategory = {
  slug: string;
  label: string;
  color: string;
  swatch: string;
};

const HOME_CATEGORIES: readonly HomeCategory[] = [
  { slug: 'milky',            label: 'Milky',            color: '#F5E1C5', swatch: '#D9A066' },
  { slug: 'fruity',           label: 'Fruity',           color: '#FCE1C9', swatch: '#F27D45' },
  { slug: 'fruity-black-tea', label: 'Fruity Black Tea', color: '#EFDACB', swatch: '#8C5635' },
  { slug: 'fresh-brew',       label: 'Fresh Brew',       color: '#E8DAC6', swatch: '#6B3E15' },
  { slug: 'frozen',           label: 'Frozen',           color: '#D8E4E8', swatch: '#6EA3B0' },
  { slug: 'cheese-cream',     label: 'Cheese Cream',     color: '#FFF1D6', swatch: '#E8B44E' },
  { slug: 'special-mix',      label: 'Special Mix',      color: '#E6DDEB', swatch: '#8B6AA8' },
] as const;

export function CategoriesStrip() {
  const router = useRouter();
  const { items, categories } = useMenu();

  const countsBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      const slug = normalizeSlug(cat.name);
      const n = items.filter((item) =>
        (item.itemData?.categories ?? []).some((c) => c.id === cat.id),
      ).length;
      map.set(slug, (map.get(slug) ?? 0) + n);
    }
    return map;
  }, [items, categories]);

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead
        label="Browse the menu"
        actionLabel="See all"
        onAction={() => router.push('/(tabs)/menu')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={140}
        contentContainerStyle={{ paddingLeft: 20, paddingRight: 14, gap: 10 }}
      >
        {HOME_CATEGORIES.map((c) => {
          const count = countsBySlug.get(c.slug);
          return (
            <Pressable
              key={c.slug}
              onPress={() => router.push('/(tabs)/menu')}
              style={({ pressed }) => ({
                width: 130,
                height: 84,
                borderRadius: RADIUS.tile + 4,
                backgroundColor: c.color,
                padding: 12,
                overflow: 'hidden',
                position: 'relative',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View
                style={{
                  position: 'absolute',
                  right: -10,
                  bottom: -10,
                  width: 50,
                  height: 50,
                  borderRadius: 999,
                  backgroundColor: c.swatch,
                  opacity: 0.85,
                }}
              />
              <Text
                style={{
                  fontFamily: 'Fraunces_500Medium',
                  fontSize: 15,
                  lineHeight: 17,
                  letterSpacing: -0.2,
                  color: T.ink,
                }}
              >
                {c.label}
              </Text>
              <Text
                style={[
                  TYPE.eyebrow,
                  {
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    color: T.ink3,
                    fontSize: 10.5,
                    letterSpacing: 1,
                  },
                ]}
              >
                {count == null ? '—' : `${count} drinks`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/CategoriesStrip.tsx
git commit -m "feat(home): add CategoriesStrip horizontal tile row"
```

---

## Task 8: Re-skin `HeroCarousel` → add `HotPicks` alias

**Files:**
- Modify: `components/home/HeroCarousel.tsx` (full file replacement except imports)

- [ ] **Step 1: Replace the file contents**

```tsx
// components/home/HeroCarousel.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useItemSheetStore } from '@/store/itemSheet';
import { useMenu } from '@/hooks/use-menu';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { SectionHead } from './SectionHead';

const SLIDES = [
  { image: require('@/assets/images/carousel/top_1.webp'), name: 'Brown Sugar Milk Tea', tagline: 'Creamy classic' },
  { image: require('@/assets/images/carousel/top_2.webp'), name: 'Mango Slushy',          tagline: 'Summer favourite' },
  { image: require('@/assets/images/carousel/top_3.webp'), name: 'Oreo Brulee Milk Tea',  tagline: 'Torched on top' },
  { image: require('@/assets/images/carousel/top_4.webp'), name: 'Lychee Black Tea',      tagline: 'Fresh & floral' },
  { image: require('@/assets/images/carousel/top_5.webp'), name: 'Red Dragon Fruit Slushy', tagline: 'Vibrant & cool' },
  { image: require('@/assets/images/carousel/top_6.webp'), name: 'Taro Milk Tea',         tagline: 'Silky smooth' },
];

const AUTOPLAY_MS = 5000;
const CARD_GAP = 12;
const CARD_RATIO = 1.15;

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function HeroCarousel() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.78);
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const sidePadding = Math.round((width - cardWidth) / 2);
  const snapInterval = cardWidth + CARD_GAP;

  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const { items } = useMenu();

  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const n = item.itemData?.name;
      if (n) map.set(normalize(n), item.id);
    }
    return map;
  }, [items]);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
  };

  const handlePress = (name: string) => {
    const id = nameToId.get(normalize(name));
    if (id) useItemSheetStore.getState().open(id);
  };

  return (
    <View style={styles.wrap}>
      <SectionHead label="This week's favourites" eyebrow="HOT PICKS" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({
          length: snapInterval,
          offset: snapInterval * i,
          index: i,
        })}
        renderItem={({ item, index: i }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(item.name)}
            style={[styles.card, { width: cardWidth, height: cardHeight }]}
          >
            <Image
              source={item.image}
              style={[styles.cardImage, { width: cardWidth, height: cardHeight }]}
              contentFit="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              locations={[0.4, 1]}
              style={styles.cardGradient}
            />
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{`#${i + 1}`}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTag}>{item.tagline}</Text>
              <Text style={[TYPE.cardTitle, styles.cardName]} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// Alias: Phase 2 composes Home in terms of `<HotPicks />`; file rename is
// deferred to the Phase 7 cleanup.
export { HeroCarousel as HotPicks };

const styles = StyleSheet.create({
  wrap: { marginTop: 4, paddingBottom: 20 },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: T.sage,
    ...SHADOW.miniCart,
    shadowColor: T.brandDark,
  },
  cardImage: { position: 'absolute', top: 0, left: 0 },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.paper,
  },
  rankBadgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10.5,
    color: T.brand,
    letterSpacing: 0.5,
  },
  cardBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    gap: 6,
  },
  cardTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  cardName: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.ink4,
  },
  dotActive: {
    width: 22,
    backgroundColor: T.brand,
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/HeroCarousel.tsx
git commit -m "feat(home): re-skin HeroCarousel with T tokens + HotPicks alias export"
```

---

## Task 9: `components/home/StoreCard.tsx`

**Files:**
- Create: `components/home/StoreCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/home/StoreCard.tsx
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { getStoreStatus } from './helpers';

const MAP_QUERY = '34 Davenport St Southport QLD 4215';

function openDirections() {
  const encoded = encodeURIComponent(MAP_QUERY);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${encoded}`,
    android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });
  if (url) Linking.openURL(url).catch(() => { /* swallow */ });
}

export function StoreCard() {
  const status = getStoreStatus();

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          backgroundColor: T.paper,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: T.line,
          ...SHADOW.card,
        }}
      >
        {/* Sage map thumbnail with grid + pin */}
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: T.sage,
            position: 'relative',
          }}
        >
          {/* 4 horizontal grid lines at 18px intervals */}
          {[18, 36, 54, 72].map((y) => (
            <View
              key={`h${y}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: y,
                height: 1,
                backgroundColor: T.paper,
                opacity: 0.5,
              }}
            />
          ))}
          {/* 4 vertical grid lines at 18px intervals */}
          {[18, 36, 54, 72].map((x) => (
            <View
              key={`v${x}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: x,
                width: 1,
                backgroundColor: T.paper,
                opacity: 0.5,
              }}
            />
          ))}
          {/* Pin: circle + rotated/translated to pseudo-teardrop */}
          <View
            style={{
              position: 'absolute',
              left: 38 - 7,
              top: 38 - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: T.brand,
              borderWidth: 2,
              borderColor: '#fff',
              transform: [{ translateY: -2 }, { rotate: '-45deg' }],
            }}
          />
        </View>

        {/* Middle */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: status.open ? T.green : T.ink4,
              }}
            />
            <Text
              style={[
                TYPE.eyebrow,
                { fontSize: 11, color: status.open ? T.greenDark : T.ink3 },
              ]}
            >
              {status.open ? 'OPEN NOW' : 'CLOSED'}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Fraunces_500Medium',
              fontSize: 16,
              letterSpacing: -0.3,
              color: T.ink,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            Southport Store
          </Text>
          <Text
            style={[TYPE.body, { color: T.ink3, marginTop: 2, fontSize: 12, lineHeight: 17 }]}
            numberOfLines={2}
          >
            34 Davenport St · Gold Coast · Southport
          </Text>
        </View>

        {/* Directions */}
        <Pressable
          onPress={openDirections}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: T.ink4,
            backgroundColor: 'transparent',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.ink }}>
            Directions
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/StoreCard.tsx
git commit -m "feat(home): add StoreCard with sage grid + Directions"
```

---

## Task 10: Rewrite `app/(tabs)/index.tsx`

**Files:**
- Modify: `app/(tabs)/index.tsx` (full replacement)

- [ ] **Step 1: Replace the file contents**

```tsx
// app/(tabs)/index.tsx
import { ScrollView, View } from 'react-native';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeLoyaltyHero } from '@/components/home/HomeLoyaltyHero';
import { YourUsual } from '@/components/home/YourUsual';
import { DailySpecial } from '@/components/home/DailySpecial';
import { CategoriesStrip } from '@/components/home/CategoriesStrip';
import { HotPicks } from '@/components/home/HeroCarousel';
import { StoreCard } from '@/components/home/StoreCard';
import { MiniCartBar } from '@/components/cart/MiniCartBar';
import { T } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        style={{ backgroundColor: T.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        <HomeLoyaltyHero />
        <YourUsual />
        <DailySpecial />
        <CategoriesStrip />
        <HotPicks />
        <StoreCard />
      </ScrollView>
      <MiniCartBar />
    </View>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors, zero new warnings over Phase 1 baseline.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(home): rewrite Home screen composing phase 2 widgets"
```

---

## Task 11: Validation sweep

No code changes, only checks and a final summary commit.

- [ ] **Step 1: Verify dev route gone and WelcomeDiscountBanner unused**

Run:
```bash
[ ! -e app/dev/theme-showcase.tsx ] && echo OK-deleted || echo FAIL-exists
grep -rn "WelcomeDiscountBanner" app components --include="*.tsx" --include="*.ts"
grep -rn "BRAND" app/\(tabs\)/index.tsx components/home/
```
Expected: first line prints `OK-deleted`; `WelcomeDiscountBanner` appears only in its own file (`components/home/WelcomeDiscountBanner.tsx`); `BRAND` imports in `app/(tabs)/index.tsx` and `components/home/*.tsx` yield zero matches.

- [ ] **Step 2: Full type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Verify Phase 3d WIP byte-identical**

Run: `git status`
Expected: the same 8 modified + 6 untracked auth/legal files that were present at Phase 1 exit (see DEV_HANDOFF.md §"Phase 1 Foundation 完成") — none of them have new changes introduced by Phase 2.

- [ ] **Step 4: On-device smoke (iOS dev client, then Android)**

Start Metro if not running: `npx expo start --dev-client`. Scan from the dev client and verify:

  - Signed-out:
    - HomeHeader shows "Hi there, Welcome.", Southport pill correct.
    - HomeLoyaltyHero, YourUsual, DailySpecial hidden.
    - CategoriesStrip, HotPicks (autoplay + dot indicator), StoreCard visible.
    - Header bag tap → cart tab.
    - Header bell tap → no navigation, peach dot remains.
    - StoreCard Directions tap → OS maps opens.
    - CategoriesStrip tile tap → menu tab.
    - HotPicks card tap → item sheet opens (existing behavior preserved).
  - Signed-in with 0 orders, no welcome discount:
    - HomeLoyaltyHero visible (balance 0 → 9 cup tiles outlined, "9 stars until a free drink", "View" chip).
    - YourUsual hidden.
    - DailySpecial hidden.
  - Signed-in with 3+ orders, welcome discount available:
    - YourUsual shows highest-frequency item with "ordered N×" count.
    - `+` tap → MiniCartBar updates cart count; button flips to check for ~900ms.
    - DailySpecial shows "First {drinksRemaining} milk teas — {pct}% off", CTA → menu tab.
  - Signed-in with `balance ≥ 9`:
    - HomeLoyaltyHero shows "🎉 Free drink ready to redeem" + peach "Redeem" chip.
    - Tap → `/promotions`.
  - Visual parity vs. `reference/src/HomeScreen.jsx` on iPhone 14 Pro + a Pixel 6-class Android — layouts within ~2dp tolerance.

Record any layout discrepancies and capture with `cmux browser screenshot` if running web, or screen-record on device.

- [ ] **Step 5: (Conditional) Apply SafeArea adjustment if on-device test shows overlap**

If HomeHeader overlaps the iOS status bar on notch devices, edit `app/(tabs)/index.tsx` to add safe-area top padding:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// ...
const insets = useSafeAreaInsets();
return (
  <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
    {/* rest unchanged */}
  </View>
);
```

Re-run `npx tsc --noEmit` and re-test on device. Commit only if the change is needed:

```bash
git add app/(tabs)/index.tsx
git commit -m "fix(home): respect iOS safe area top inset"
```

- [ ] **Step 6: Final summary commit (empty — marker only)**

Skip this step. No summary commit is created; Phase 2 ends when Task 11 validation passes on both platforms.

---

## Out of scope for this phase (reference)

- `components/account/LoyaltyCard.tsx` — Phase 6.
- `app/(tabs)/menu.tsx`, `cart.tsx`, `order.tsx`, `account.tsx` — Phases 3/4/5/6.
- `components/auth/*`, `app/login.tsx`, `components/legal/*`, `lib/legal.ts`, `app/_layout.tsx` — Phase 3d auth WIP preserved byte-identical.
- `BRAND` const removal / migration elsewhere — Phase 7 cleanup.
- Deleting `hero-banner*.webp` assets — Phase 7 cleanup.
- Notifications, category deep-link, geolocation "km away", confetti — deferred or dropped per brainstorm.
- Welcome-discount backend behavior — only the surface changes here.

---

## Self-review (controller eyes-only)

- **Spec coverage:** Task 0 kills `/dev/theme-showcase` (spec §11/12). Task 1 = helpers (§9). Task 2 = SectionHead (§1). Task 3 = HomeHeader (§2). Task 4 = HomeLoyaltyHero incl. CupProgressRow (§3). Task 5 = YourUsual (§4). Task 6 = DailySpecial (§5). Task 7 = CategoriesStrip (§6). Task 8 = HotPicks re-skin (§7). Task 9 = StoreCard (§8). Task 10 = index rewrite (§10). Task 11 = validation (§validation).
- **Placeholder scan:** Every step has either exact code or exact commands + expected output.
- **Type consistency:** `computeYourUsual` returns `YourUsualItem | null`; `YourUsual` consumes `usual.itemId`/`variationId`/`priceCents`/`modifiers[]` (matches shape). `getStoreStatus()` returns `{ open, nextLabel }`; both `HomeHeader` (§3) and `StoreCard` (§9) consume it correctly. `HotPicks` alias re-exports `HeroCarousel`; Home imports named `HotPicks` from `@/components/home/HeroCarousel`.
- **Naming note:** Cart hook is `useCartStore` (not `useCart`) — plan uses the correct name throughout.
- **HotPicks tap behavior:** plan preserves the existing `useItemSheetStore.getState().open(id)` (not `router.push('/menu/[id]')`) — spec's router-push line was wrong; plan is the source of truth here.
