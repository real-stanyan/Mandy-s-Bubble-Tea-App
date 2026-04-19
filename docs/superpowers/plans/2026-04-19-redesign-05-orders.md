# Phase 5 — My Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the `My Orders` tab screen to the new visual system with a full-bleed active-order card (3-step StatusTimeline / sage-gradient READY variant), past-order rows with CupArt thumbs and inline Reorder link, and an `All / Active / Past` filter strip. Existing data layer (`useOrderHistory` → `useOrdersStore`) and focus polling behavior unchanged.

**Architecture:** Additive — six new files under `components/orders/` + one-line edit to `constants/theme.ts` + one-line edit to `app/(tabs)/_layout.tsx` + a mechanical import swap in `components/account/OrderHistory.tsx` + full rewrite of `app/(tabs)/order.tsx`. No new data stores, no new hooks. Reorder helper relocated from `OrderHistory.tsx` to `components/orders/reorder.ts` so both consumers (Account tab + Orders tab) share one source of truth.

**Tech Stack:** React Native 0.81 + Expo SDK 54, `expo-router` (Tabs + `useFocusEffect`), `@react-navigation/bottom-tabs`, `react-native-svg` (via Phase 1 `<Icon>` / `<CupArt>`), Phase 1 tokens (`T`, `FONT`, `TYPE`, `SHADOW` in `constants/theme.ts`). No tests — validation via `npx tsc --noEmit`, `npm run lint`, grep invariants, and on-device smoke.

**Testing strategy:** This repo has no unit test suite. Every task validates via `npx tsc --noEmit`, `npm run lint` (no new warnings), grep invariants for BRAND/Ionicons, and on-device / simulator confirmation of the behaviors in spec §"Success criteria". Do NOT introduce Jest or a new test runner in this phase.

**WIP preservation (CRITICAL):** Phase 3d (Supabase Auth) work-in-progress MUST remain byte-identical through every commit. These 8 modified + 5 untracked paths must survive unchanged:

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

Phase 5 does NOT touch `app/_layout.tsx` or any Phase 3d WIP path. Every `git add` in this plan names specific files only. **Never** run `git add -A`, `git add .`, `git commit -a`, or `git add <directory>/`. After each task, verify `git status --short` still lists exactly those 13 paths (plus the files under active edit this task) as uncommitted.

**Reference spec:** `docs/superpowers/specs/2026-04-19-redesign-05-orders.md`

**Design reference file** (read-only context for visual fidelity):
- `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/OrdersScreen.jsx`

---

## File Structure

Files created in this phase:

- `components/orders/time.ts` — relative-time formatter `placedRelative(createdAt, now?)` used by active + past rows
- `components/orders/reorder.ts` — extracted `reorder(…)` helper (previously local to `OrderHistory.tsx`); single source of truth for "clear cart → loop-add line items → push /checkout"
- `components/orders/StatusTimeline.tsx` — 3-step horizontal timeline (`Received / Preparing / Ready`), status prop drives which circles are filled
- `components/orders/OrdersFilterPills.tsx` — three-way `All / Active (N) / Past` filter row
- `components/orders/PastOrderRow.tsx` — compact single-row past-order card with CupArt thumb + reference # + items summary + price + inline `Reorder →`
- `components/orders/ActiveOrderCard.tsx` — full-bleed active-order card with two visual modes (PREPARING paper card + timeline / READY sage-gradient full card)

Files modified in this phase:

- `constants/theme.ts` — add `SHADOW.readyCard` preset
- `components/account/OrderHistory.tsx` — delete local `addItemLine`, import + call `reorder(…)` from `components/orders/reorder.ts`
- `app/(tabs)/_layout.tsx` — add `headerShown: false` to `<Tabs.Screen name="order" />` options (inline header takes over)
- `app/(tabs)/order.tsx` — full rewrite (141 → ~220 lines): inline `OrderScreenHeader` + `<OrdersFilterPills>` + `<ActiveOrderCard>` map + `<PastOrderRow>` map + empty/loading/unauth branches re-skinned to `T.*` + `<Icon>`

No files deleted in Phase 5. `BRAND` in `lib/constants.ts` stays untouched. `components/account/OrderHistory.tsx` keeps its visual shell — only the reorder helper import swaps.

---

## Task 0: Preflight — baselines + WIP sanity

**Purpose:** Record the starting state so later tasks have hard pass/fail criteria. Confirms the working tree matches the Phase 3d WIP manifest, captures the lint warning baseline, and records current BRAND/Ionicons grep counts.

**Files:** Read only, no writes.

- [ ] **Step 1: Confirm the Phase 3d WIP file list**

Run:

```bash
cd ~/Github/mandys_bubble_tea_app && git status --short
```

Expected output — these 13 paths (order may vary, no extras):

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

If the list differs: STOP. Surface the drift to the human operator and do not continue.

- [ ] **Step 2: Capture current branch + head SHA**

Run:

```bash
git rev-parse --abbrev-ref HEAD && git rev-parse HEAD
```

Expected: `main` + a SHA. Record the SHA. Every Phase 5 commit must land on `main` and be a descendant of this SHA. If the branch is not `main`, STOP.

- [ ] **Step 3: Record lint baseline**

Run:

```bash
npm run lint 2>&1 | tail -30
```

Count and record the number of warnings (the summary line at the end says `N problems (0 errors, N warnings)`). Record this number — final Task 9 must not exceed it.

- [ ] **Step 4: Record `tsc` baseline**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0 with no output. If not, STOP — the tree is not clean before Phase 5 starts.

- [ ] **Step 5: Record BRAND / Ionicons / OrderHistory baseline**

Run:

```bash
grep -rn 'from "@/lib/constants"\|from '\''@/lib/constants'\''' app components | grep -v node_modules | wc -l
grep -rn '@expo/vector-icons' app components | grep -v node_modules | wc -l
grep -rn 'OrderHistory' app components | grep -v node_modules
```

Record the two counts and the list of OrderHistory callers. Phase 5 will:
- Delete exactly **2** BRAND imports (one each in `order.tsx` and `OrderHistory.tsx` after the reorder extraction — actually OrderHistory keeps its BRAND usage because it's the Account tab visual, so only `order.tsx` loses its BRAND import. Recount after.)
- Delete exactly **1** Ionicons import (the one in `order.tsx`).
- Keep `OrderHistory` referenced by `app/(tabs)/account.tsx` only — the Orders tab reference will disappear.

**Expected OrderHistory callers at baseline:**

```
app/(tabs)/account.tsx:…
app/(tabs)/order.tsx:…
components/account/OrderHistory.tsx:…
```

**Expected at Phase 5 end:**

```
app/(tabs)/account.tsx:…
components/account/OrderHistory.tsx:…
```

- [ ] **Step 6: Verify Phase 1 tokens + Icon are available**

Run:

```bash
grep -n "export const SHADOW\|readyCard" constants/theme.ts
grep -n "name: IconName" components/brand/Icon.tsx
grep -n "export function hashColor" components/brand/color.ts
```

Expected:
- `constants/theme.ts` has `export const SHADOW = {` block with `card`, `miniCart`, `primaryCta`, `successBubble` — NO `readyCard` yet.
- `components/brand/Icon.tsx` exports `IconName` with at least `check`, `clock`, `arrow`, `qr`, `receipt` in the list.
- `components/brand/color.ts` exports `hashColor(id: string): string`.

If any of these don't exist, STOP — Phase 1 did not land.

- [ ] **Step 7: Read the reference screen once**

Open `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/OrdersScreen.jsx` in your editor and skim lines 53-273 (StatusTimeline, ActiveOrderCard, PastOrderRow, OrdersScreen body). Do not copy CSS verbatim — the spec §"Target state" is authoritative. The reference file is for disambiguation only.

- [ ] **Step 8: Record completion of Task 0**

No commit. Report back to the controller with the baseline numbers: BRAND count, Ionicons count, lint warning count, OrderHistory callers, branch SHA. Then stop.

---

## Task 1: Add `SHADOW.readyCard` preset to theme

**Purpose:** The ready-state active order card uses a sage-green drop shadow (`#3C644C`, opacity 0.45, radius 26, offsetY 14) distinct from the existing four presets. Add it to `constants/theme.ts` so downstream code references a token, not inline values.

**Files:**
- Modify: `constants/theme.ts` (append one block inside the existing `SHADOW` const)

- [ ] **Step 1: Open `constants/theme.ts` and locate the `SHADOW` const**

The existing shape is:

```ts
export const SHADOW = {
  card: { shadowColor: '#2A1E14', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  miniCart: { shadowColor: '#6B3E15', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 20, elevation: 8 },
  primaryCta: { shadowColor: '#2A1E14', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 10 },
  successBubble: { shadowColor: '#3C644C', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.55, shadowRadius: 30, elevation: 12 },
} as const;
```

- [ ] **Step 2: Add `readyCard` entry**

Insert a `readyCard` key between `miniCart` and `primaryCta` (alphabetical would be `readyCard` after `primaryCta`, but grouping by "uses sage green shadow" puts it next to `successBubble`; use this order for diff clarity: after `successBubble`):

```ts
  readyCard: {
    shadowColor: '#3C644C',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 10,
  },
```

Final `SHADOW` block:

```ts
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
  readyCard: {
    shadowColor: '#3C644C',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 10,
  },
} as const;
```

- [ ] **Step 3: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warning count ≤ Task 0 baseline.

- [ ] **Step 4: Commit**

```bash
git add constants/theme.ts
git commit -m "$(cat <<'EOF'
feat(theme): add SHADOW.readyCard preset for Phase 5 ready-card variant

Sage-green drop shadow (#3C644C, opacity 0.45, radius 26, offsetY 14)
used by ActiveOrderCard when order status is READY.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Verify WIP untouched**

```bash
git status --short
```

Expected: same 13 Phase 3d WIP paths as Task 0, no extras.

---

## Task 2: `components/orders/time.ts` — relative-time formatter

**Purpose:** Pure helper `placedRelative(createdAt, now?)` — no React, no RN imports. Used by active card (`Placed X`) and past row (middle-column time). Same locale (`en-AU`) as the legacy `formatDateTime` in `OrderHistory.tsx`.

**Files:**
- Create: `components/orders/time.ts`

- [ ] **Step 1: Write `time.ts`**

Full file contents:

```ts
const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtWeekday(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'short' })
}

function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// `placedRelative` returns a human-readable time string for an order's
// createdAt. Rules mirror the reference mocks:
//   - < 60s        → 'just now'
//   - < 60min      → 'N min ago'
//   - today        → 'Today, h:mm am/pm'
//   - yesterday    → 'Yesterday, h:mm am/pm'
//   - < 7 days     → 'Mon, h:mm am/pm'  (short weekday + time)
//   - older        → 'Sat 12 Oct · h:mm am/pm'
//   - null input   → ''
export function placedRelative(
  createdAt: string | null,
  now: Date = new Date(),
): string {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''

  const diff = now.getTime() - d.getTime()
  if (diff < MS_MIN) return 'just now'
  if (diff < MS_HOUR) {
    const mins = Math.max(1, Math.floor(diff / MS_MIN))
    return `${mins} min ago`
  }

  if (isSameCalendarDay(d, now)) {
    return `Today, ${fmtTime(d)}`
  }

  const yesterday = new Date(now.getTime() - MS_DAY)
  if (isSameCalendarDay(d, yesterday)) {
    return `Yesterday, ${fmtTime(d)}`
  }

  if (diff < 7 * MS_DAY) {
    return `${fmtWeekday(d)}, ${fmtTime(d)}`
  }

  return `${fmtWeekday(d)} ${fmtDayMonth(d)} · ${fmtTime(d)}`
}
```

- [ ] **Step 2: Verify `tsc`**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Sanity-check via node REPL (optional, recommended)**

Because there's no test runner, one-shot check the boundary conditions manually:

```bash
node -e "
const { placedRelative } = require('./components/orders/time.ts');
const now = new Date('2026-04-19T14:00:00+10:00');
console.log(placedRelative('2026-04-19T13:59:30+10:00', now));  // 'just now'
console.log(placedRelative('2026-04-19T13:55:00+10:00', now));  // '5 min ago'
console.log(placedRelative('2026-04-19T10:15:00+10:00', now));  // 'Today, 10:15 am'
console.log(placedRelative('2026-04-18T16:32:00+10:00', now));  // 'Yesterday, 4:32 pm'
console.log(placedRelative('2026-04-14T12:10:00+10:00', now));  // 'Tue, 12:10 pm'
console.log(placedRelative('2025-10-12T14:10:00+10:00', now));  // 'Sun 12 Oct · 2:10 pm'
console.log(placedRelative(null, now));                         // ''
"
```

This requires `ts-node` or you can skip — the function is covered by `tsc` and on-device smoke during Task 8. If skipping, move on.

- [ ] **Step 4: Commit**

```bash
git add components/orders/time.ts
git commit -m "$(cat <<'EOF'
feat(orders): add placedRelative time formatter

Pure helper for active card + past row relative-time labels.
en-AU locale, boundary rules per Phase 5 spec.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `components/orders/reorder.ts` — extract shared reorder helper

**Purpose:** The "clear cart → loop-add line items → push /checkout" flow today lives at module scope in `components/account/OrderHistory.tsx`. Phase 5's `PastOrderRow` needs the same behavior. Extract once, delete the local definition, swap Account's call site.

**Files:**
- Create: `components/orders/reorder.ts`
- Modify: `components/account/OrderHistory.tsx`

- [ ] **Step 1: Read the existing `OrderHistory.tsx` helper**

Open `components/account/OrderHistory.tsx`. Locate:

1. The import of `useCartStore` (line ~6).
2. The local `handleReorder` inside `OrderHistory()` (lines ~134-148).
3. The module-level `addItemLine(add, line)` (lines ~257-282).

These are the pieces moving.

- [ ] **Step 2: Write `components/orders/reorder.ts`**

Full file contents:

```ts
import type { OrderHistoryItem, OrderHistoryLine } from '@/store/orders'

// Signature carved from the existing useCartStore addItem. Kept local to
// this module so consumers don't have to import CartStore's internal
// types just to call reorder().
interface AddItemInput {
  id: string
  variationId: string
  name: string
  variationName?: string
  price: number
  imageUrl?: string
  modifiers: {
    id: string
    name: string
    listName: string
    priceCents: number
  }[]
}

type AddItem = (item: AddItemInput) => void
type ClearCart = () => void

function addItemLine(add: AddItem, line: OrderHistoryLine): void {
  const modPrice = line.modifiers.reduce(
    (sum, m) => sum + Number(m.priceCents || '0'),
    0,
  )
  const unitPrice = Number(line.basePriceCents || '0') + modPrice
  const item: AddItemInput = {
    id: line.itemId,
    variationId: line.variationId,
    name: line.name,
    variationName: line.variationName || undefined,
    price: unitPrice,
    imageUrl: line.imageUrl ?? undefined,
    modifiers: line.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      listName: m.listName,
      priceCents: Number(m.priceCents || '0'),
    })),
  }
  const qty = Math.max(1, line.quantity)
  for (let i = 0; i < qty; i++) add(item)
}

// Replays every line item from `order` into the cart and invokes the
// caller's navigation hook. Returns:
//   'ok'      → cart was replaced, caller should route to /checkout
//   'empty'   → none of the line items had a variationId (items pulled
//               from the catalog) — caller should show an alert
export function reorder(
  clearCart: ClearCart,
  addItem: AddItem,
  order: OrderHistoryItem,
): 'ok' | 'empty' {
  const usable = order.lineItems.filter((l) => l.variationId)
  if (usable.length === 0) return 'empty'
  clearCart()
  for (const line of usable) addItemLine(addItem, line)
  return 'ok'
}
```

- [ ] **Step 3: Update `components/account/OrderHistory.tsx` — add import**

Locate the existing imports (top of file). Add:

```ts
import { reorder } from '@/components/orders/reorder'
```

- [ ] **Step 4: Update `handleReorder` inside `OrderHistory()` to call the shared helper**

Find the existing callback (around lines 134-148):

```ts
  const handleReorder = useCallback(
    (order: OrderHistoryItem) => {
      const usable = order.lineItems.filter((l) => l.variationId)
      if (usable.length === 0) {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      replaceCart()
      for (const line of usable) {
        addItemLine(addItem, line)
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )
```

Replace with:

```ts
  const handleReorder = useCallback(
    (order: OrderHistoryItem) => {
      const result = reorder(replaceCart, addItem, order)
      if (result === 'empty') {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )
```

- [ ] **Step 5: Delete the module-level `addItemLine` in `OrderHistory.tsx`**

Remove the whole function (roughly lines 257-282):

```ts
function addItemLine(
  add: ReturnType<typeof useCartStore.getState>['addItem'],
  line: OrderHistoryLine,
) {
  // ...
  for (let i = 0; i < qty; i++) add(item)
}
```

Also remove any import of `OrderHistoryLine` from `@/hooks/use-order-history` that becomes unused — grep confirms:

```bash
grep -n 'OrderHistoryLine' components/account/OrderHistory.tsx
```

If the only remaining reference is in the imports block, delete it from the import list; otherwise keep it.

- [ ] **Step 6: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warning count ≤ Task 0 baseline.

- [ ] **Step 7: Sanity-check Account tab still compiles with the swap**

```bash
grep -n 'reorder\|addItemLine' components/account/OrderHistory.tsx
```

Expected: exactly one `reorder` import + one `reorder(` call inside `handleReorder`; NO `addItemLine` references.

- [ ] **Step 8: Commit**

```bash
git add components/orders/reorder.ts components/account/OrderHistory.tsx
git commit -m "$(cat <<'EOF'
refactor(orders): extract reorder helper to components/orders/reorder.ts

OrderHistory.tsx previously owned the addItemLine helper plus a ~15-line
handleReorder flow; Phase 5's PastOrderRow needs the same behavior.
Extract into components/orders/reorder.ts so both consumers share one
source of truth. No behavior change — same clear-cart → loop-add →
navigate pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Verify WIP untouched**

```bash
git status --short
```

Expected: same 13 Phase 3d WIP paths as Task 0.

---

## Task 4: `components/orders/StatusTimeline.tsx` — 3-step horizontal timeline

**Purpose:** Visual-only component. Renders 3 circles + 2 connecting bars for `Received / Preparing / Ready`. Consumers pass `status: 'OPEN' | 'PREPARING' | 'READY'`.

**Files:**
- Create: `components/orders/StatusTimeline.tsx`

- [ ] **Step 1: Write `StatusTimeline.tsx`**

Full file contents:

```tsx
import { View, Text, StyleSheet } from 'react-native'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'

export type TimelineStatus = 'OPEN' | 'PREPARING' | 'READY'

interface Step {
  key: TimelineStatus
  label: string
}

const STEPS: Step[] = [
  { key: 'OPEN', label: 'Received' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
]

function statusIndex(status: TimelineStatus): number {
  return STEPS.findIndex((s) => s.key === status)
}

interface Props {
  status: TimelineStatus
}

export function StatusTimeline({ status }: Props) {
  const idx = statusIndex(status)

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const done = idx >= i
        const nextDone = idx >= i + 1
        return (
          <View key={step.key} style={styles.stepGroup}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: done ? T.brand : 'transparent',
                    borderColor: done ? T.brand : T.ink4,
                  },
                ]}
              >
                {done ? <Icon name="check" color="#fff" size={12} /> : null}
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: done ? T.ink : T.ink3,
                    fontWeight: done ? '700' : '500',
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? (
              <View
                style={[
                  styles.bar,
                  { backgroundColor: nextDone ? T.brand : T.ink4 },
                ]}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  stepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepCol: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONT.sans,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginTop: -14,
    marginHorizontal: 2,
  },
})
```

Key notes:
- Last step has no trailing bar (`i < STEPS.length - 1` guard).
- `flex: 1` on `stepGroup` spreads steps evenly; labels sit centered under each circle.
- `marginTop: -14` on the bar aligns it with the vertical center of the circles (circle height / 2 minus half the bar height ≈ 11 - 2/2 - label-height adjustment).
- Inactive steps use `T.ink4` (the 28%-ink token) for both border and bar.

- [ ] **Step 2: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warnings ≤ baseline.

- [ ] **Step 3: Confirm no forbidden imports**

```bash
grep -n '@expo/vector-icons\|@/lib/constants' components/orders/StatusTimeline.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/orders/StatusTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(orders): add StatusTimeline component

3-step horizontal timeline (Received → Preparing → Ready). Filled
circles + brand-color connecting bars drive from the `status` prop.
Used by ActiveOrderCard in Phase 5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `components/orders/OrdersFilterPills.tsx` — All/Active/Past strip

**Purpose:** Three-way filter selector. Presentational only — receives `value` + `onChange` + `activeCount`; parent owns filter state.

**Files:**
- Create: `components/orders/OrdersFilterPills.tsx`

- [ ] **Step 1: Write `OrdersFilterPills.tsx`**

Full file contents:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { T, FONT } from '@/constants/theme'

export type OrdersFilter = 'all' | 'active' | 'past'

interface Pill {
  key: OrdersFilter
  label: string
}

function pills(activeCount: number): Pill[] {
  return [
    { key: 'all', label: 'All' },
    { key: 'active', label: `Active (${activeCount})` },
    { key: 'past', label: 'Past' },
  ]
}

interface Props {
  value: OrdersFilter
  activeCount: number
  onChange: (filter: OrdersFilter) => void
}

export function OrdersFilterPills({ value, activeCount, onChange }: Props) {
  return (
    <View style={styles.row}>
      {pills(activeCount).map((p) => {
        const selected = value === p.key
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={({ pressed }) => [
              styles.pill,
              selected ? styles.pillActive : styles.pillInactive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? T.cream : T.ink2 },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  pillInactive: {
    backgroundColor: 'transparent',
    borderColor: T.line,
  },
  label: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    fontWeight: '600',
  },
})
```

Key notes:
- No icons, no badges beyond the `(N)` suffix.
- `activeCount` is the only dynamic piece in labels. If `activeCount === 0`, the Active pill still shows `Active (0)` — matches reference.
- `Pressable` opacity 0.7 on press for tactile feedback. No scale animation.

- [ ] **Step 2: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warnings ≤ baseline.

- [ ] **Step 3: Confirm no forbidden imports**

```bash
grep -n '@expo/vector-icons\|@/lib/constants' components/orders/OrdersFilterPills.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/orders/OrdersFilterPills.tsx
git commit -m "$(cat <<'EOF'
feat(orders): add OrdersFilterPills component

Three-way All / Active (N) / Past filter pill row. Presentational —
parent owns filter state and active count.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `components/orders/PastOrderRow.tsx` — compact past-order card

**Purpose:** Single-row card for the Past Orders section. 44×44 CupArt thumb + reference # + relative time + items summary + price + inline `Reorder →` button. Whole row is tappable (opens detail); inline reorder button stops propagation.

**Files:**
- Create: `components/orders/PastOrderRow.tsx`

- [ ] **Step 1: Write `PastOrderRow.tsx`**

Full file contents:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CupArt } from '@/components/brand/CupArt'
import { Icon } from '@/components/brand/Icon'
import { hashColor } from '@/components/brand/color'
import { T, FONT } from '@/constants/theme'
import { placedRelative } from '@/components/orders/time'
import type { OrderHistoryItem } from '@/store/orders'

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return `#${order.referenceId}`
  return `#${order.id.slice(-6).toUpperCase()}`
}

function itemsSummary(order: OrderHistoryItem): string {
  if (order.lineItems.length === 0) return order.itemSummary || 'Order'
  return order.lineItems
    .map((l) => `${l.quantity}× ${l.name}`)
    .join(', ')
}

interface Props {
  order: OrderHistoryItem
  onOpen: (order: OrderHistoryItem) => void
  onReorder: (order: OrderHistoryItem) => void
}

export function PastOrderRow({ order, onOpen, onReorder }: Props) {
  const thumbColor = hashColor(order.firstItemName || order.id)

  return (
    <Pressable
      onPress={() => onOpen(order)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumb}>
        <CupArt fill={thumbColor} stroke={T.ink} size={28} />
      </View>

      <View style={styles.middle}>
        <View style={styles.metaRow}>
          <Text style={styles.ref}>{referenceLabel(order)}</Text>
          <Text style={styles.time}>{placedRelative(order.createdAt)}</Text>
        </View>
        <Text style={styles.items} numberOfLines={1}>
          {itemsSummary(order)}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.price}>{formatCents(order.totalCents)}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation()
            onReorder(order)
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.reorderBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.reorderText}>Reorder</Text>
          <Icon name="arrow" color={T.brand} size={10} />
        </Pressable>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1ebe4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ref: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: T.ink3,
    letterSpacing: 0.3,
  },
  time: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink3,
  },
  items: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 18,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reorderText: {
    fontFamily: FONT.sans,
    fontSize: 11,
    fontWeight: '700',
    color: T.brand,
  },
})
```

Key notes:
- `hashColor(order.firstItemName || order.id)` — use item name if present, else order id as fallback seed. Deterministic across re-renders.
- `referenceLabel` uses `referenceId` when present, else last-6 of Square's internal id uppercased — ensures non-empty rendering even for edge-case orders.
- `itemsSummary` falls back to `order.itemSummary` string when `lineItems` is empty (old orders fetched before `lineItems` API existed).
- `Pressable.onPress` on inner reorder `Pressable` uses `e.stopPropagation()` so the row's outer `onPress` doesn't also fire. React Native's Pressable does forward `stopPropagation` on its synthetic event.

- [ ] **Step 2: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warnings ≤ baseline.

- [ ] **Step 3: Confirm no forbidden imports**

```bash
grep -n '@expo/vector-icons\|@/lib/constants' components/orders/PastOrderRow.tsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/orders/PastOrderRow.tsx
git commit -m "$(cat <<'EOF'
feat(orders): add PastOrderRow component

Compact single-row card for Past Orders section: 44x44 CupArt thumb +
reference # + relative time + items summary + price + inline Reorder.
Row tap opens detail; Reorder button stops propagation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `components/orders/ActiveOrderCard.tsx` — full-bleed active card

**Purpose:** Renders an in-progress order. Two visual modes driven by `status === 'READY'`: sage-gradient-background full card vs paper-card + StatusTimeline variant. Contains: eyebrow + title + meta line + status pill (top-right) + optional timeline + dashed line-item list + footer (Total + CTA).

**Files:**
- Create: `components/orders/ActiveOrderCard.tsx`

- [ ] **Step 1: Check availability of LinearGradient dep**

The sage-gradient mode needs `expo-linear-gradient`. Check:

```bash
grep -n 'expo-linear-gradient' package.json
```

Expected: the dep is already present (Phase 2 Home's signed-out banner uses it). If NOT present, STOP and surface to the operator — installing a new native dep is out of Phase 5 scope.

- [ ] **Step 2: Write `ActiveOrderCard.tsx`**

Full file contents:

```tsx
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CupArt } from '@/components/brand/CupArt'
import { Icon } from '@/components/brand/Icon'
import { hashColor } from '@/components/brand/color'
import { T, FONT, SHADOW } from '@/constants/theme'
import { placedRelative } from '@/components/orders/time'
import { StatusTimeline, type TimelineStatus } from '@/components/orders/StatusTimeline'
import type { OrderHistoryItem, OrderHistoryLine, OrderHistoryLineModifier } from '@/store/orders'

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? Number(cents) / 100 : cents / 100
  return `A$${n.toFixed(2)}`
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return `#${order.referenceId}`
  return `#${order.id.slice(-6).toUpperCase()}`
}

// Group modifiers by listName the same way CartItem does. Returns a
// dot-joined summary like "Size: Large 700ml · Sugar: 50%".
function modifierSummary(line: OrderHistoryLine): string {
  if (line.modifiers.length === 0) {
    return line.variationName || ''
  }
  const groups = new Map<string, string[]>()
  for (const m of line.modifiers) {
    const bucket = groups.get(m.listName) ?? []
    bucket.push(m.name)
    groups.set(m.listName, bucket)
  }
  const parts: string[] = []
  if (line.variationName) parts.push(line.variationName)
  for (const [list, names] of groups) {
    parts.push(`${list}: ${names.join(', ')}`)
  }
  return parts.join(' · ')
}

// Line items have quantity ≥ 1. Our cart store dedupes by lineId but
// still carries each add as quantity 1; orders API aggregates. Show
// quantity only when > 1 to avoid visual clutter.
function lineQtyLabel(line: OrderHistoryLine): string {
  return line.quantity > 1 ? `${line.quantity}× ${line.name}` : line.name
}

function lineUnitPrice(line: OrderHistoryLine): number {
  const mods = line.modifiers.reduce(
    (sum: number, m: OrderHistoryLineModifier) => sum + Number(m.priceCents || '0'),
    0,
  )
  return (Number(line.basePriceCents || '0') + mods) * line.quantity
}

interface Props {
  order: OrderHistoryItem
  status: TimelineStatus
  onTrack: (order: OrderHistoryItem) => void
}

export function ActiveOrderCard({ order, status, onTrack }: Props) {
  const ready = status === 'READY'

  const eyebrowColor = ready ? 'rgba(255,255,255,0.75)' : T.brand
  const textColor = ready ? '#fff' : T.ink
  const subTextColor = ready ? 'rgba(255,255,255,0.85)' : T.ink3
  const dashedColor = ready ? 'rgba(255,255,255,0.3)' : T.line
  const footerBorderColor = ready ? 'rgba(255,255,255,0.25)' : T.line
  const pillBg = ready ? 'rgba(255,255,255,0.2)' : 'rgba(141,85,36,0.12)'
  const pillText = ready ? '#fff' : T.brand
  const tileBg = ready ? 'rgba(255,255,255,0.18)' : '#f1ebe4'
  const priceColor = ready ? '#fff' : T.ink2

  const shell = (
    <>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={[styles.eyebrow, { color: eyebrowColor }]}>
            {ready ? 'READY FOR PICKUP' : 'IN PROGRESS'}
          </Text>
          <Text style={[styles.title, { color: textColor }]}>
            Order {referenceLabel(order)}
          </Text>
          <Text style={[styles.meta, { color: subTextColor }]}>
            Placed {placedRelative(order.createdAt)} · {order.lineCount}
            {' '}
            {order.lineCount === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
          <Icon name="clock" color={pillText} size={12} />
          <Text style={[styles.statusPillText, { color: pillText }]}>
            {ready ? 'Now' : 'Preparing'}
          </Text>
        </View>
      </View>

      {!ready ? <StatusTimeline status={status} /> : null}

      <View style={[styles.items, { borderTopColor: dashedColor }]}>
        {order.lineItems.map((line, i) => (
          <View key={`${line.variationId}-${i}`} style={styles.itemRow}>
            <View style={[styles.itemTile, { backgroundColor: tileBg }]}>
              <CupArt
                fill={hashColor(line.name)}
                stroke={ready ? '#fff' : T.ink}
                size={22}
              />
            </View>
            <View style={styles.itemMain}>
              <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                {lineQtyLabel(line)}
              </Text>
              {modifierSummary(line) ? (
                <Text
                  style={[styles.itemMods, { color: subTextColor }]}
                  numberOfLines={1}
                >
                  {modifierSummary(line)}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.itemPrice, { color: priceColor }]}>
              {formatCents(lineUnitPrice(line))}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { borderTopColor: footerBorderColor }]}>
        <View>
          <Text style={[styles.totalLabel, { color: subTextColor }]}>TOTAL</Text>
          <Text style={[styles.totalValue, { color: textColor }]}>
            {formatCents(order.totalCents)}
          </Text>
        </View>
        <Pressable
          onPress={() => onTrack(order)}
          style={({ pressed }) => [
            styles.cta,
            ready ? styles.ctaReady : styles.ctaPreparing,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text
            style={[
              styles.ctaText,
              { color: ready ? T.greenDark : '#fff' },
            ]}
          >
            {ready ? 'Show pickup' : 'Track order'}
          </Text>
          <Icon
            name={ready ? 'qr' : 'arrow'}
            color={ready ? T.greenDark : '#fff'}
            size={ready ? 14 : 12}
          />
        </Pressable>
      </View>
    </>
  )

  if (ready) {
    return (
      <View style={[styles.container, iosShadow('readyCard')]}>
        <LinearGradient
          colors={[T.sage, '#8CA07D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {shell}
        </LinearGradient>
      </View>
    )
  }

  return (
    <View style={[styles.container, styles.paperCard, iosShadow('card')]}>
      {shell}
    </View>
  )
}

function iosShadow(preset: 'card' | 'readyCard') {
  return Platform.select({
    ios: {
      shadowColor: SHADOW[preset].shadowColor,
      shadowOffset: SHADOW[preset].shadowOffset,
      shadowOpacity: SHADOW[preset].shadowOpacity,
      shadowRadius: SHADOW[preset].shadowRadius,
    },
    android: { elevation: SHADOW[preset].elevation },
  })
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  paperCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 4,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  meta: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    fontWeight: '700',
  },
  items: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  itemTile: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: FONT.sans,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  itemMods: {
    marginTop: 1,
    fontFamily: FONT.sans,
    fontSize: 11,
  },
  itemPrice: {
    fontFamily: FONT.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontFamily: FONT.sans,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontFamily: FONT.mono,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  ctaPreparing: {
    backgroundColor: T.brand,
  },
  ctaReady: {
    backgroundColor: '#fff',
  },
  ctaText: {
    fontFamily: FONT.sans,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
```

Key notes:
- `LinearGradient` sage gradient uses `T.sage` (`#A2AD91`) and `#8CA07D` (reference value) — the second color stays inline because we don't have a brand token for it and adding a token for a single use is premature generalization.
- `borderStyle: 'dashed'` on React Native works reliably only with `borderTopWidth` set via `StyleSheet.hairlineWidth`. It's a known constraint — `StyleSheet.hairlineWidth` renders as 1 physical pixel.
- `iosShadow` helper splits shadow application between iOS and Android. The existing `MiniCartBar` uses the same pattern; stay consistent.
- `modifierSummary` groups by listName first (same logic CartItem uses) — plan-author chose not to import CartItem's helper because CartItem's function signature expects its own CartItem type. Keep inlined helper small + typed to `OrderHistoryLine`.
- `onTrack` is the only consumer-supplied handler — PREPARING and READY both call it. The calling `order.tsx` decides whether to route to `/order-detail` or (future) a pickup-QR sheet.

- [ ] **Step 3: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warnings ≤ baseline.

- [ ] **Step 4: Confirm no forbidden imports**

```bash
grep -n '@expo/vector-icons\|@/lib/constants' components/orders/ActiveOrderCard.tsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/orders/ActiveOrderCard.tsx
git commit -m "$(cat <<'EOF'
feat(orders): add ActiveOrderCard component

Full-bleed active-order card with two visual modes driven by status:
PREPARING → paper card + 3-step StatusTimeline; READY → sage-gradient
full card + Show pickup CTA. CupArt tiles for each line item, dashed
separator, footer with Total + CTA.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rewrite `app/(tabs)/order.tsx` + disable stack header

**Purpose:** Replace the current OrdersScreen body with the new composition: inline header + filter pills + active/past sections + empty/loading/unauth branches. Drop Ionicons + BRAND. Set `headerShown: false` on the Tabs.Screen so the inline header takes over.

**Files:**
- Modify: `app/(tabs)/_layout.tsx` (set `headerShown: false` on the order tab)
- Modify: `app/(tabs)/order.tsx` (full rewrite)

- [ ] **Step 1: Update `_layout.tsx` — order tab header**

Locate the `<Tabs.Screen name="order" options={{ ... }} />` block in `app/(tabs)/_layout.tsx` (around line 71-78). It currently reads:

```tsx
        <Tabs.Screen
          name="order"
          options={{
            title: 'My Orders',
            tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color} />,
            tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          }}
        />
```

Add `headerShown: false`:

```tsx
        <Tabs.Screen
          name="order"
          options={{
            title: 'My Orders',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color} />,
            tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          }}
        />
```

- [ ] **Step 2: Rewrite `app/(tabs)/order.tsx`**

Replace the entire file contents with:

```tsx
import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { useCartStore } from '@/store/cart'
import { isUnfinished, type OrderHistoryItem } from '@/store/orders'
import { useOrderHistory } from '@/hooks/use-order-history'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'
import {
  OrdersFilterPills,
  type OrdersFilter,
} from '@/components/orders/OrdersFilterPills'
import {
  ActiveOrderCard,
} from '@/components/orders/ActiveOrderCard'
import { PastOrderRow } from '@/components/orders/PastOrderRow'
import type { TimelineStatus } from '@/components/orders/StatusTimeline'
import { reorder } from '@/components/orders/reorder'

function timelineStatusFor(order: OrderHistoryItem): TimelineStatus {
  if (order.state === 'OPEN' && order.fulfillmentState === 'PREPARED') {
    return 'READY'
  }
  if (order.state === 'OPEN') {
    return 'PREPARING'
  }
  return 'OPEN'
}

function subtitleText(activeCount: number, pastCount: number): string {
  if (activeCount === 0 && pastCount === 0) return ''
  if (activeCount > 0) {
    return `${activeCount} in progress · ${pastCount} past`
  }
  return `${pastCount} past order${pastCount === 1 ? '' : 's'}`
}

export default function OrderScreen() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { orders, loading, refresh } = useOrderHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<OrdersFilter>('all')
  const replaceCart = useCartStore((s) => s.clearCart)
  const addItem = useCartStore((s) => s.addItem)

  const { activeOrders, pastOrders } = useMemo(() => {
    const active = orders.filter(isUnfinished)
    const past = orders.filter((o) => !isUnfinished(o))
    return { activeOrders: active, pastOrders: past }
  }, [orders])

  const hasActiveOrder = activeOrders.length > 0

  useFocusEffect(
    useCallback(() => {
      if (!profile) return
      refresh()
      if (!hasActiveOrder) return
      const id = setInterval(() => {
        refresh()
      }, 10_000)
      return () => clearInterval(id)
    }, [profile, refresh, hasActiveOrder]),
  )

  const onPullRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleTrack = useCallback(
    (order: OrderHistoryItem) => {
      router.push({
        pathname: '/order-detail',
        params: {
          orderId: order.id,
          referenceId: order.referenceId ?? '',
          createdAt: order.createdAt ?? '',
          state: order.state ?? '',
          totalCents: order.totalCents,
          itemSummary: order.itemSummary,
          lineCount: String(order.lineCount),
          from: 'orders',
        },
      })
    },
    [router],
  )

  const handleReorder = useCallback(
    (order: OrderHistoryItem) => {
      const result = reorder(replaceCart, addItem, order)
      if (result === 'empty') {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Sign in to view your orders</Text>
        <Pressable
          style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
      </View>
    )
  }

  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  const showActive = filter === 'all' || filter === 'active'
  const showPast = filter === 'all' || filter === 'past'
  const subtitle = subtitleText(activeOrders.length, pastOrders.length)
  const isCompletelyEmpty = orders.length === 0

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={T.brand}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.title}>My Orders</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Icon name="clock" color={T.ink} size={18} />
          </View>
        </View>

        <OrdersFilterPills
          value={filter}
          activeCount={activeOrders.length}
          onChange={setFilter}
        />

        {isCompletelyEmpty ? (
          <EmptyAllState />
        ) : (
          <>
            {showActive && activeOrders.length > 0 ? (
              <>
                <SectionHead
                  label="In progress"
                  count={`${activeOrders.length} order${activeOrders.length === 1 ? '' : 's'}`}
                />
                {activeOrders.map((order) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    status={timelineStatusFor(order)}
                    onTrack={handleTrack}
                  />
                ))}
              </>
            ) : null}

            {showPast ? (
              <>
                <SectionHead label="Past orders" />
                {pastOrders.length > 0 ? (
                  pastOrders.map((order) => (
                    <PastOrderRow
                      key={order.id}
                      order={order}
                      onOpen={handleTrack}
                      onReorder={handleReorder}
                    />
                  ))
                ) : (
                  <EmptyPastState />
                )}
              </>
            ) : null}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function SectionHead({ label, count }: { label: string; count?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  )
}

function EmptyAllState() {
  return (
    <View style={styles.emptyAll}>
      <View style={styles.emptyIconCircle}>
        <Icon name="receipt" color={T.ink4} size={28} />
      </View>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Your orders will show up here once you place one.
      </Text>
    </View>
  )
}

function EmptyPastState() {
  return (
    <View style={styles.emptyPast}>
      <View style={styles.emptyIconCircle}>
        <Icon name="receipt" color={T.ink4} size={24} />
      </View>
      <Text style={styles.emptyTitle}>No past orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Your past orders will show up here.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 56,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 28,
    letterSpacing: -0.5,
    color: T.ink,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 13,
    color: T.ink3,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(42,30,20,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    color: T.ink,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    color: T.ink3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
    backgroundColor: T.bg,
  },
  muted: {
    fontFamily: FONT.sans,
    color: T.ink3,
    fontSize: 14,
    textAlign: 'center',
  },
  signInBtn: {
    backgroundColor: T.ink,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  signInText: {
    color: '#fff',
    fontFamily: FONT.sans,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyAll: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  emptyPast: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(42,30,20,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    color: T.ink2,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 18,
    textAlign: 'center',
  },
})
```

- [ ] **Step 3: Verify `tsc` + lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc exit 0, lint warnings ≤ baseline.

- [ ] **Step 4: Verify no forbidden imports**

```bash
grep -n '@expo/vector-icons\|from "@/lib/constants"\|from '\''@/lib/constants'\''' app/\(tabs\)/order.tsx
```

Expected: no output.

```bash
grep -n 'OrderHistory' app/\(tabs\)/order.tsx
```

Expected: no output. The old `OrderHistory` component is no longer referenced on this tab.

- [ ] **Step 5: Verify OrderHistory callers reduced by exactly 1**

```bash
grep -rn 'OrderHistory' app components | grep -v node_modules
```

Expected 2 lines (vs Task 0 baseline 3):
- `app/(tabs)/account.tsx:<line>:<OrderHistory import/usage>`
- `components/account/OrderHistory.tsx:<line>:<self export>`

If there are 3 or more, STOP — order.tsx still has an import.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/\(tabs\)/order.tsx
git commit -m "$(cat <<'EOF'
feat(orders): rewrite My Orders tab to Phase 5 tokens

Inline header + OrdersFilterPills + ActiveOrderCard / PastOrderRow
sections. Replaces Ionicons/BRAND.color with Icon/T tokens. Header is
now inline (Tabs.Screen headerShown: false). Data layer unchanged —
useOrderHistory + useOrdersStore polling behaves identically.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Verify WIP untouched**

```bash
git status --short
```

Expected: same 13 Phase 3d WIP paths as Task 0, no extras.

---

## Task 9: Final verification

**Purpose:** Catch regressions across all Phase 5 deliverables before handoff. No code changes unless a fix is required.

**Files:** Read only. If a failure surfaces, fix in the file that owns the problem and amend the relevant Phase 5 commit (not any other).

- [ ] **Step 1: Full tsc**

```bash
npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 2: Full lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: warning count ≤ Task 0 baseline. If Phase 5 added a warning, track it down to a Phase 5 file and fix (no `eslint-disable` adds — fix the code).

- [ ] **Step 3: BRAND / Ionicons invariants in Phase 5 files**

```bash
grep -rn 'from "@/lib/constants"\|from '\''@/lib/constants'\''' \
  app/\(tabs\)/order.tsx \
  components/orders/ \
  constants/theme.ts
```

Expected: no output.

```bash
grep -rn '@expo/vector-icons' \
  app/\(tabs\)/order.tsx \
  components/orders/
```

Expected: no output.

- [ ] **Step 4: OrderHistory.tsx still works + no regression**

```bash
grep -n 'reorder\|Ionicons\|BRAND' components/account/OrderHistory.tsx
```

Expected:
- `reorder` — 1 import line + 1 call line.
- `Ionicons` — multiple hits (Account tab's visual is still Phase-5-unmigrated — Phase 6 handles this).
- `BRAND` — multiple hits (same reason).

That's fine. Phase 5 only swapped the reorder helper in this file.

- [ ] **Step 5: WIP byte-check**

```bash
git status --short
```

Expected 13 uncommitted paths:

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

Spot-check the two most-risky WIP files are byte-identical vs HEAD at Task 0:

```bash
git diff --stat HEAD~9..HEAD -- app/_layout.tsx app/\(tabs\)/account.tsx components/auth/AuthProvider.tsx
```

Expected: no entries (these files were NOT touched by any Phase 5 commit).

- [ ] **Step 6: Commit count + chain**

```bash
git log --oneline -n 10
```

Expected top of log (in descending order):
```
<sha> feat(orders): rewrite My Orders tab to Phase 5 tokens
<sha> feat(orders): add ActiveOrderCard component
<sha> feat(orders): add PastOrderRow component
<sha> feat(orders): add OrdersFilterPills component
<sha> feat(orders): add StatusTimeline component
<sha> refactor(orders): extract reorder helper to components/orders/reorder.ts
<sha> feat(orders): add placedRelative time formatter
<sha> feat(theme): add SHADOW.readyCard preset for Phase 5 ready-card variant
<sha> docs: redesign Phase 5 spec — My Orders
<…prior phases…>
```

Total Phase 5 commits: **8** (1 spec + 7 implementation). If more or fewer, audit what drifted.

- [ ] **Step 7: On-device smoke (iOS simulator)**

Start Metro and boot the app on iOS simulator (user action — plan cannot run this). Manual checks:

1. Sign in (skip if dev-token autologin).
2. My Orders tab: inline header renders "My Orders" Fraunces 28pt + subtitle.
3. Filter pills — all three pills work; inactive = transparent + border, active = dark ink fill + cream text.
4. Place a fresh order through /checkout (Apple Pay test card). After success:
   - Active section shows 1 card with eyebrow `IN PROGRESS`, StatusTimeline with step 1+2 filled, `Track order →` CTA.
   - Tap → navigates to /order-detail (existing screen).
5. Simulate READY: in Square Dashboard, mark the fulfillment PREPARED. Pull-to-refresh. Active card should swap to sage gradient, white text, `READY FOR PICKUP` eyebrow, `Now` pill, `Show pickup →` CTA routes to /order-detail.
6. Past section: verify CupArt thumb renders with hashed color, `#ref` + relative time, items summary, price + `Reorder →` button. Tap Reorder → cart is replaced with the line items and `/checkout` opens.
7. Tap row body (not Reorder button) → /order-detail opens.
8. Empty state (new user): receipt icon in circle, "No orders yet" copy, bg is `T.bg`.
9. Unauth state: "Sign in to view your orders" + ink-filled pill button.

- [ ] **Step 8: On-device smoke (Android)**

Repeat Step 7 on Android emulator (Pixel 5 profile or similar). Specifically verify:
- Shadows render (elevation: 10 / 1).
- LinearGradient sage variant doesn't clip content.
- Dashed border on item separator renders (Android can render dashed lines differently — a single thin line at `hairlineWidth` is acceptable; aggressive dash gaps are not acceptable).

- [ ] **Step 9: Report**

Summarize to the controller:
- 8 Phase 5 commits on main.
- tsc / lint results.
- BRAND/Ionicons invariants confirmed clean in Phase 5 files.
- WIP 13 paths byte-identical.
- Simulator smoke results (iOS + Android).
- Any deferred smoke (e.g., actual READY transition requires Square Dashboard access) should be flagged for user action.

---

## Invariants summary

Run at any commit boundary to confirm Phase 5 health:

```bash
# WIP still the 13 known paths
git status --short | wc -l                             # expect 13

# Phase 5 files don't import BRAND or Ionicons
grep -rn 'from "@/lib/constants"\|from '\''@/lib/constants'\''' \
  app/\(tabs\)/order.tsx components/orders/ constants/theme.ts    # expect empty

grep -rn '@expo/vector-icons' \
  app/\(tabs\)/order.tsx components/orders/              # expect empty

# OrderHistory callers reduced from 3 → 2
grep -rn 'OrderHistory' app components | grep -v node_modules | wc -l  # expect 2

# tsc clean
npx tsc --noEmit                                        # exit 0
```
