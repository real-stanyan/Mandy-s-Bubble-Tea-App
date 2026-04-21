# Home Messages Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home-screen bell icon a real entry point to a `/messages` inbox that shows order activity (PLACED / READY / COMPLETED) and the active welcome discount, derived from existing client state. Make the unread red dot reflect "any order event today."

**Architecture:** Hybrid-derived inbox — no new tables, no new APIs. The web `/api/orders/history` endpoint gains one extra field (`updatedAt`); everything else is computed client-side from `useOrdersStore` + `useAuth().welcomeDiscount`. The bell `onPress` (currently a no-op) routes to a new full-screen `app/messages.tsx`. Red-dot logic lives in a single `useMessageEvents()` hook so HomeHeader and the screen agree.

**Tech Stack:** Next.js 14 (web API), Expo Router 4 (RN), React Native, Zustand (existing `orders` store), TypeScript. No new dependencies.

**Repos:** Tasks 1 lands in `mandys_bubble_tea` (web). Tasks 2–9 land in `mandys_bubble_tea_app` (RN).

**Validation pattern:** This codebase has no unit-test setup. Per-task validation is `npx tsc --noEmit` exits 0 + brief manual reasoning about the change. End-to-end manual verification happens in Task 9 on simulator/device.

---

### Task 1: Surface `updatedAt` on the orders history API (web)

**Repo:** `mandys_bubble_tea`

**Files:**
- Modify: `src/app/api/orders/history/route.ts:134-148`

- [ ] **Step 1: Add `updatedAt` to the mapped response object**

In `src/app/api/orders/history/route.ts`, locate the `return { ... }` inside the `.map(...)` (line ~134). Add `updatedAt` immediately after `createdAt`:

```ts
return {
  id: order.id,
  referenceId: order.referenceId ?? order.ticketName ?? null,
  createdAt: order.createdAt ?? null,
  updatedAt: order.updatedAt ?? null,
  state: order.state ?? null,
  fulfillmentState: pickup?.state ?? null,
  totalCents: order.totalMoney?.amount?.toString() ?? "0",
  itemSummary: rawLines
    .map((li) => `${li.quantity}× ${li.name ?? "Item"}`)
    .join(", "),
  lineCount: rawLines.length,
  firstItemName: firstLine?.name ?? "",
  firstItemImageUrl: firstLine?.imageUrl ?? null,
  lineItems,
};
```

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea
git add src/app/api/orders/history/route.ts
git commit -m "$(cat <<'EOF'
feat(orders-api): surface order.updatedAt in history response

Lets the RN client distinguish "your order is ready" timing from "your
order was placed" timing without adding a new event log. Backwards-
compatible: existing clients ignore the extra field.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Deploy**

Push to main so Vercel picks it up before Task 9's E2E test:

```bash
cd ~/Github/mandys_bubble_tea
git push origin main
```

Wait for Vercel deploy to go green (≈1–2 min). Verify with:

```bash
curl -s -H "Cookie: <auth>" https://mandybubbletea.com/api/orders/history | jq '.orders[0] | {id, createdAt, updatedAt}'
```

Expected: `updatedAt` is a non-null ISO string for any order that has been touched.

---

### Task 2: Add `updatedAt` to the RN client's `OrderHistoryItem` interface

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Modify: `store/orders.ts:22-34`

- [ ] **Step 1: Extend the interface**

In `store/orders.ts`, add `updatedAt: string | null` to `OrderHistoryItem` immediately after `createdAt`:

```ts
export interface OrderHistoryItem {
  id: string
  referenceId: string | null
  createdAt: string | null
  updatedAt: string | null
  state: string | null
  fulfillmentState: string | null
  totalCents: string
  itemSummary: string
  lineCount: number
  firstItemName: string
  firstItemImageUrl: string | null
  lineItems: OrderHistoryLine[]
}
```

No other change in this file — the store already passes through whatever the API returns.

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add store/orders.ts
git commit -m "$(cat <<'EOF'
feat(orders): track order.updatedAt on the client

Mirrors the new field surfaced by /api/orders/history. Used by the
upcoming messages inbox to time-stamp READY and COMPLETED events.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create `useMessageEvents` derivation hook

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Create: `hooks/use-message-events.ts`

- [ ] **Step 1: Write the full hook**

Create `hooks/use-message-events.ts`:

```ts
import { useMemo } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useOrdersStore, type OrderHistoryItem } from '@/store/orders'

export type OrderEventState = 'PLACED' | 'READY' | 'COMPLETED'

export type InboxEntry =
  | {
      kind: 'order'
      orderId: string
      referenceId: string | null
      timestamp: string
      state: OrderEventState
      totalCents: string
      firstItemName: string
      lineCount: number
    }
  | {
      kind: 'promo'
      promoId: 'welcome-discount'
      percentage: number
      drinksRemaining: number
    }

function deriveOrderState(o: OrderHistoryItem): OrderEventState | null {
  if (o.state === 'OPEN' && o.fulfillmentState === 'PREPARED') return 'READY'
  if (o.state === 'OPEN') return 'PLACED'
  if (o.state === 'COMPLETED') return 'COMPLETED'
  return null
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function useMessageEvents(): {
  entries: InboxEntry[]
  promo: Extract<InboxEntry, { kind: 'promo' }> | null
  orderEntries: Extract<InboxEntry, { kind: 'order' }>[]
  hasTodayEvent: boolean
} {
  const { welcomeDiscount } = useAuth()
  const orders = useOrdersStore((s) => s.orders)

  return useMemo(() => {
    const orderEntries: Extract<InboxEntry, { kind: 'order' }>[] = []

    for (const o of orders) {
      const state = deriveOrderState(o)
      if (!state) continue
      const timestamp = o.updatedAt ?? o.createdAt
      if (!timestamp) continue
      orderEntries.push({
        kind: 'order',
        orderId: o.id,
        referenceId: o.referenceId,
        timestamp,
        state,
        totalCents: o.totalCents,
        firstItemName: o.firstItemName,
        lineCount: o.lineCount,
      })
    }

    orderEntries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

    const promo: Extract<InboxEntry, { kind: 'promo' }> | null =
      welcomeDiscount.available
        ? {
            kind: 'promo',
            promoId: 'welcome-discount',
            percentage: welcomeDiscount.percentage,
            drinksRemaining: welcomeDiscount.drinksRemaining,
          }
        : null

    const entries: InboxEntry[] = promo ? [promo, ...orderEntries] : orderEntries
    const hasTodayEvent = orderEntries.some((e) => isToday(e.timestamp))

    return { entries, promo, orderEntries, hasTodayEvent }
  }, [orders, welcomeDiscount])
}
```

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add hooks/use-message-events.ts
git commit -m "$(cat <<'EOF'
feat(messages): derive inbox entries from orders + welcome discount

Pure client-side derivation. One entry per order, state-aware
(PLACED/READY/COMPLETED). Promo pinned at top when active and never
contributes to hasTodayEvent — see spec D4.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build `MessageRow` presentational component

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Create: `components/messages/MessageRow.tsx`

- [ ] **Step 1: Write the row component**

Create `components/messages/MessageRow.tsx`:

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Icon, type IconName } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { InboxEntry } from '@/hooks/use-message-events'

type OrderEntry = Extract<InboxEntry, { kind: 'order' }>

const STATE_DISPLAY: Record<
  OrderEntry['state'],
  { icon: IconName; iconColor: string; iconBg: string; title: string; bodySuffix: string }
> = {
  PLACED: {
    icon: 'clock',
    iconColor: '#92400e',
    iconBg: '#fde7c7',
    title: 'Order placed',
    bodySuffix: '',
  },
  READY: {
    icon: 'cafe',
    iconColor: '#14532d',
    iconBg: '#cdebd0',
    title: 'Your order is ready 🧋',
    bodySuffix: 'Pickup at Mandy\u2019s Bubble Tea',
  },
  COMPLETED: {
    icon: 'check',
    iconColor: '#2e5e2e',
    iconBg: '#d6e8d6',
    title: 'Order picked up',
    bodySuffix: 'Thanks!',
  },
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYMD =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (sameYMD) return time
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `Yesterday ${time}`
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function MessageRow({
  entry,
  onPress,
}: {
  entry: OrderEntry
  onPress: () => void
}) {
  const display = STATE_DISPLAY[entry.state]
  const refLabel = entry.referenceId ?? `#${entry.orderId.slice(-3)}`
  const bodyParts = [refLabel]
  if (entry.state === 'PLACED') bodyParts.push(formatCents(entry.totalCents))
  if (display.bodySuffix) bodyParts.push(display.bodySuffix)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: display.iconBg }]}>
        <Icon name={display.icon} color={display.iconColor} size={18} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {display.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {bodyParts.join(' · ')}
        </Text>
      </View>
      <Text style={styles.time}>{formatRelative(entry.timestamp)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.card,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    ...SHADOW.card,
  },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...TYPE.bodyStrong, fontSize: 15, color: T.ink },
  subtitle: { ...TYPE.body, fontSize: 13, color: T.ink3 },
  time: { ...TYPE.body, fontSize: 12, color: T.ink3 },
})
```

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add components/messages/MessageRow.tsx
git commit -m "$(cat <<'EOF'
feat(messages): MessageRow component (state-aware)

Single row for an order entry. Shape mirrors order-detail summary
rows for visual consistency.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build `PromoCard` for pinned welcome discount

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Create: `components/messages/PromoCard.tsx`

- [ ] **Step 1: Write the promo card**

Create `components/messages/PromoCard.tsx`:

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { InboxEntry } from '@/hooks/use-message-events'

type PromoEntry = Extract<InboxEntry, { kind: 'promo' }>

export function PromoCard({
  entry,
  onPress,
}: {
  entry: PromoEntry
  onPress: () => void
}) {
  const subtitle =
    entry.drinksRemaining > 1
      ? `Use on your next ${entry.drinksRemaining} drinks`
      : 'Tap to view your discount'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      <LinearGradient
        colors={[T.peach, '#FFE6C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Icon name="gift" color={T.brand} size={22} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{entry.percentage}% off your first order</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Icon name="arrow" color={T.brand} size={18} />
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  wrapPressed: { opacity: 0.85 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: RADIUS.card,
    gap: 12,
    ...SHADOW.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...TYPE.bodyStrong, fontSize: 15, color: T.ink },
  subtitle: { ...TYPE.body, fontSize: 13, color: T.ink2 },
})
```

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add components/messages/PromoCard.tsx
git commit -m "$(cat <<'EOF'
feat(messages): PromoCard pinned welcome-discount card

Peach→cream gradient matches PromotionsCard family. Tap target leads
to /promotions for the full redemption flow.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build the `/messages` screen

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Create: `app/messages.tsx`

- [ ] **Step 1: Write the screen**

Create `app/messages.tsx`:

```tsx
import { useCallback, useMemo, useState } from 'react'
import { ScrollView, Text, View, StyleSheet, RefreshControl } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useOrdersStore } from '@/store/orders'
import { useMessageEvents, type InboxEntry } from '@/hooks/use-message-events'
import { MessageRow } from '@/components/messages/MessageRow'
import { PromoCard } from '@/components/messages/PromoCard'
import { T, TYPE } from '@/constants/theme'

type OrderEntry = Extract<InboxEntry, { kind: 'order' }>

function bucketLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso)
  const now = new Date()
  const sameYMD =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameYMD) return 'Today'
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return 'Yesterday'
  }
  return 'Earlier'
}

export default function MessagesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string }>()
  const refreshOrders = useOrdersStore((s) => s.refresh)
  const [refreshing, setRefreshing] = useState(false)

  const { promo, orderEntries } = useMessageEvents()

  // Refresh on focus so a brand-new order/state shows up without a manual pull.
  useFocusEffect(
    useCallback(() => {
      refreshOrders()
    }, [refreshOrders]),
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshOrders()
    } finally {
      setRefreshing(false)
    }
  }, [refreshOrders])

  const grouped = useMemo(() => {
    const buckets: Record<'Today' | 'Yesterday' | 'Earlier', OrderEntry[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    }
    for (const e of orderEntries) {
      buckets[bucketLabel(e.timestamp)].push(e)
    }
    return (['Today', 'Yesterday', 'Earlier'] as const)
      .map((label) => ({ label, items: buckets[label] }))
      .filter((b) => b.items.length > 0)
  }, [orderEntries])

  const handleOrderPress = useCallback(
    (entry: OrderEntry) => {
      router.push({
        pathname: '/order-detail',
        params: {
          orderId: entry.orderId,
          referenceId: entry.referenceId ?? '',
          createdAt: entry.timestamp,
          state: entry.state === 'READY' ? 'OPEN' : entry.state,
          totalCents: entry.totalCents,
          itemSummary: '',
          lineCount: String(entry.lineCount),
          from: 'messages',
        },
      })
    },
    [router],
  )

  const handlePromoPress = useCallback(() => {
    router.push('/promotions')
  }, [router])

  const empty = !promo && grouped.length === 0
  // `from` is forwarded by HomeHeader so the Stack header label can swap
  // between "Home" and (if we add other entry points later) "<X>".
  void params.from

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.brand} />
      }
    >
      {promo ? <PromoCard entry={promo} onPress={handlePromoPress} /> : null}

      {grouped.map((bucket) => (
        <View key={bucket.label} style={styles.section}>
          <Text style={styles.sectionHead}>{bucket.label}</Text>
          {bucket.items.map((e) => (
            <MessageRow key={e.orderId} entry={e} onPress={() => handleOrderPress(e)} />
          ))}
        </View>
      ))}

      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>Place an order to get started.</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 8 },
  sectionHead: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginBottom: 8,
    marginTop: 8,
  },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 6 },
  emptyTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 18,
    color: T.ink,
  },
  emptyBody: { ...TYPE.body, fontSize: 13, color: T.ink3 },
})
```

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add app/messages.tsx
git commit -m "$(cat <<'EOF'
feat(messages): /messages screen with grouped inbox + promo card

Sections by Today/Yesterday/Earlier; promo (when active) pinned at
top. Refresh on focus so a freshly-flipped READY order shows up
without pull-to-refresh.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Register the `messages` Stack screen

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Modify: `app/_layout.tsx` (around the existing `<Stack.Screen name="order-detail" />` block, ~line 89-95)

- [ ] **Step 1: Inspect existing Stack screens**

Run: `cd ~/Github/mandys_bubble_tea_app && grep -n "Stack.Screen" app/_layout.tsx`
Expected: shows existing Stack.Screen blocks for `(tabs)`, `order-detail`, `checkout`, `order-confirmation`, `promotions`, `login`, `menu`.

- [ ] **Step 2: Add the messages Stack.Screen**

The existing order-detail block (around line 89) is:

```tsx
<Stack.Screen
  name="order-detail"
  options={({ route }) => {
    const from = (route.params as { from?: string } | undefined)?.from
    const label = from === 'orders' ? 'My Orders' : 'Account'
    // ... rest of options
  }}
/>
```

Immediately after that block, add:

```tsx
<Stack.Screen
  name="messages"
  options={({ route }) => {
    const from = (route.params as { from?: string } | undefined)?.from
    const label = from === 'home' ? 'Home' : 'Back'
    return {
      title: 'Messages',
      headerBackTitle: label,
      headerShown: true,
    }
  }}
/>
```

If the existing order-detail options object includes additional keys you want to inherit (e.g. `headerStyle`, `headerTintColor`), copy them into the new block too. The `name`, `options(route).from`-based label, and `title` shown above are the minimum.

- [ ] **Step 3: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(routing): register /messages Stack.Screen

Mirrors the order-detail pattern (from-aware back label).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire the bell + conditional red dot in `HomeHeader`

**Repo:** `mandys_bubble_tea_app`

**Files:**
- Modify: `components/home/HomeHeader.tsx:42-69` (bell Pressable + red dot)

- [ ] **Step 1: Add router import + replace the bell `onPress` and red dot**

In `components/home/HomeHeader.tsx`, add to existing imports:

```tsx
import { useRouter } from 'expo-router'
import { useMessageEvents } from '@/hooks/use-message-events'
```

Inside `HomeHeader()`, just below the existing `useCartSheetStore` line:

```tsx
const router = useRouter()
const { hasTodayEvent } = useMessageEvents()
```

Replace the bell `Pressable` block (currently `lines 42-69`) with:

```tsx
<Pressable
  hitSlop={6}
  onPress={() => router.push({ pathname: '/messages', params: { from: 'home' } })}
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
  {hasTodayEvent ? (
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
  ) : null}
</Pressable>
```

The cart `Pressable` immediately below it is unchanged.

- [ ] **Step 2: Type-check**

Run: `cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/Github/mandys_bubble_tea_app
git add components/home/HomeHeader.tsx
git commit -m "$(cat <<'EOF'
feat(home): wire bell to /messages + conditional red dot

Bell was a no-op with a hard-coded peach dot. Now routes to the
inbox and the dot is driven by useMessageEvents().hasTodayEvent.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Manual end-to-end verification

**Repo:** `mandys_bubble_tea_app` (no commit; verification only)

This task validates the whole feature. Complete it on a real device or simulator that's signed in as a user with both order history and (if available) an active welcome discount.

- [ ] **Step 1: Start Metro and reload the app**

```bash
cd ~/Github/mandys_bubble_tea_app
npm start
```

Open dev build (or shake-to-reload on simulator). Confirm no red screen.

- [ ] **Step 2: Verify red dot reflects today's events**

- If you have placed or had any order transition (PLACED/READY/COMPLETED) today: bell should show peach dot.
- If today has no order events: bell should show **no** dot.

If wrong: print `useMessageEvents()` output in HomeHeader temporarily to debug:
```ts
console.log('[messages]', JSON.stringify({ hasTodayEvent, count: orderEntries?.length }))
```

- [ ] **Step 3: Tap bell → verify navigation**

Tap the bell. Expected:
- Navigates to `/messages` screen
- Stack header shows "Messages" title with back arrow labelled "Home"
- If welcome discount is active: PromoCard pinned at top
- Otherwise: starts directly with sections

- [ ] **Step 4: Verify section grouping**

Scroll the screen. Expected:
- Sections appear as `Today` / `Yesterday` / `Earlier` only when each has rows
- Within each section, newest first
- Each row: state-appropriate icon + title + reference number; right-aligned time

- [ ] **Step 5: Verify row tap → order-detail**

Tap any order row. Expected:
- Navigates to `/order-detail` with the correct OL number visible (no `#000` fallback — same bug class that was fixed for push tap in `use-push-notifications.ts`; this verifies the messages-screen params plumb correctly too)
- Back button returns to `/messages`

- [ ] **Step 6: Verify promo tap → /promotions**

If a PromoCard is shown, tap it. Expected: navigates to `/promotions`.

- [ ] **Step 7: Verify empty state**

If you can sign in as a user with no orders and no welcome discount: bell tap → empty state "No activity yet. Place an order to get started." If not feasible to test, skip.

- [ ] **Step 8: Verify pull-to-refresh**

Pull down on the inbox. Expected: spinner appears, orders re-fetch, screen updates with any new state.

- [ ] **Step 9: Verify END-TO-END with a real ready event**

Real-device only. Reuse the cold-start tap procedure:
1. Place an order in the app (small, real or test cart).
2. Confirm bell shows red dot now (PLACED today).
3. Open `/messages` → see "Order placed" today with correct OL number.
4. Kill the app.
5. From terminal: `cd ~/Github/mandys_bubble_tea && set -a; source .env.local; set +a; node scripts/trigger-order-ready.mjs <orderId>` (or use Square Dashboard → Mark Ready).
6. Receive push.
7. Re-open the app (don't tap push) → bell still shows red dot → open messages → top row should now read "Your order is ready 🧋" with the same OL number (one card per order, state advanced).
8. Tap the row → land on `/order-detail` with correct OL number.

If any of the above fails, do **not** mark complete. Diagnose and amend the appropriate task before re-verifying.

- [ ] **Step 10: Final cleanup**

Remove any temporary `console.log` lines added during Step 2.

---

## Summary of Files Touched

| Path | Repo | Action |
|---|---|---|
| `src/app/api/orders/history/route.ts` | mandys_bubble_tea | modify (1 line) |
| `store/orders.ts` | mandys_bubble_tea_app | modify (1 line) |
| `hooks/use-message-events.ts` | mandys_bubble_tea_app | create |
| `components/messages/MessageRow.tsx` | mandys_bubble_tea_app | create |
| `components/messages/PromoCard.tsx` | mandys_bubble_tea_app | create |
| `app/messages.tsx` | mandys_bubble_tea_app | create |
| `app/_layout.tsx` | mandys_bubble_tea_app | modify (add Stack.Screen) |
| `components/home/HomeHeader.tsx` | mandys_bubble_tea_app | modify (~25 lines) |

## After All Tasks

Once Task 9 is fully green, update `~/system/DEV_QUEUE.md` "Recently Completed" with a one-liner and consider whether the existing `feedback_no_auto_inject_queue` rotation rules trigger.
