# Home Messages Inbox — Design Spec

**Date**: 2026-04-21
**Owner**: stan
**Repos touched**: `mandys_bubble_tea_app` (RN, primary), `mandys_bubble_tea` (web, one-line API change)

## Problem

`HomeHeader.tsx:42-69` already renders a bell icon to the left of the cart, but its `onPress` is a `/* notifications out of scope */` no-op and the unread red dot is hard-coded (always shown). Users have no in-app surface to review their order activity or recent push events. The cold-start tap from a "Your order is ready 🧋" push deep-links straight to `/order-detail`, but there's no place to look back at past activity if the user dismissed the system notification.

## Goals

- Make the bell button functional: tap → navigate to a new `/messages` screen.
- Show a unified, time-ordered inbox derived from existing client-side data (no new tables, no new APIs beyond a single `updatedAt` field added to `/api/orders/history`).
- Make the unread red dot reflect reality: lit only when there is at least one event whose timestamp falls on today.
- Cover both **order events** (placed / ready / picked up) and **promo state** (active welcome discount) without inventing a new event log.

## Non-Goals (YAGNI)

- True per-message read/unread tracking. The red dot is a per-day signal, not an inbox-zero affordance.
- "Mark all as read" interaction.
- Independent push notification history (Square does not re-send; the in-app order state already reflects "your order is ready").
- `CANCELED` order events.
- Promo history beyond the currently active welcome discount.
- Cross-device sync of read state (no state to sync).
- Server-side notification subscriptions (push/email digests).

## Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | **Content scope**: order events + promo state, derived | User chose D ("A+C combined"). |
| D2 | **Storage**: hybrid derived — no new tables | User chose option 3. Re-uses `useOrdersStore` and `useAuth().welcomeDiscount`. |
| D3 | **Card model**: one card per order, state-aware text | We don't have per-transition timestamps. Adding only `updatedAt` keeps the change minimal. |
| D4 | **Red dot**: lit when `max(updatedAt, createdAt)` is today for any order. Welcome discount does NOT contribute to the dot — the promo card is always pinned and visible when active, so there's no "alert" need. | Stateless; recomputed every render of HomeHeader. `WelcomeDiscountInfo` has no `grantedAt`, so we can't honestly know "was granted today" without a server change — and the pinned card already makes the promo discoverable. |
| D5 | **UI**: full-screen route `app/messages.tsx`, mirroring `app/order-detail.tsx` | User chose A. Stack header reuses existing `from`-aware label pattern. |

## Data Model

Each row rendered in the inbox is shaped as:

```ts
type InboxEntry =
  | {
      kind: 'order'
      orderId: string
      referenceId: string | null     // OL-prefixed pickup number when present
      timestamp: string              // ISO; updatedAt ?? createdAt
      state: 'PLACED' | 'READY' | 'COMPLETED'
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
```

Entries are derived inside `hooks/use-message-events.ts`:

- For each `OrderHistoryItem` in `useOrdersStore`:
  - If `state === 'OPEN'` and `fulfillmentState === 'PREPARED'` → `state: 'READY'`
  - Else if `state === 'OPEN'` → `state: 'PLACED'`
  - Else if `state === 'COMPLETED'` → `state: 'COMPLETED'`
  - Else (`CANCELED`, etc.) → omitted
- If `welcomeDiscount.available` is true → one `promo` entry pinned to the top, regardless of timestamp
- Order entries sorted by `timestamp DESC`

The hook returns `{ entries, hasTodayEvent }`. `hasTodayEvent` is `true` when any **order** entry's `timestamp` equals today (Australia/Brisbane timezone — match what `getStoreStatus` uses). The pinned promo entry never contributes to `hasTodayEvent` (see D4).

## Server Change Required

`src/app/api/orders/history/route.ts:134-148` — add one field to the returned object:

```ts
return {
  id: order.id,
  referenceId: order.referenceId ?? order.ticketName ?? null,
  createdAt: order.createdAt ?? null,
  updatedAt: order.updatedAt ?? null,   // NEW
  ...
};
```

Square's order resource already carries `updatedAt`; this surfaces it. No schema migration. Backwards-compatible: existing clients ignore the extra field.

## Client Interface Change

`store/orders.ts:22-34` — add `updatedAt: string | null` to `OrderHistoryItem`. No other store change needed; the API response shape just gains a field.

## UI Structure

```
app/messages.tsx (Stack.Screen)
└─ ScrollView
   ├─ [if welcomeDiscount.available]
   │   └─ PromoCard (peach gradient, "30% off your first order", tap → /promotions)
   ├─ SectionList grouped by ['Today', 'Yesterday', 'Earlier']
   │   └─ MessageRow:
   │      ┌─────────────────────────────────────────────────┐
   │      │ [icon] Title                          5:32 PM   │
   │      │        Subtitle (e.g. "Order OL003")            │
   │      └─────────────────────────────────────────────────┘
   └─ [if entries.length === 0 and !welcomeDiscount.available]
       └─ EmptyState: "No activity yet. Place an order to get started."
```

### Row content per state

| state | icon | title | subtitle |
|---|---|---|---|
| `PLACED` | `clock` (orange) | "Order placed" | `referenceId ?? '#' + id.slice(-3)` · A$N.NN |
| `READY` | `cafe` (green) | "Your order is ready 🧋" | `referenceId` · "Pickup at Mandy's Bubble Tea" |
| `COMPLETED` | `check` (sage) | "Order picked up" | `referenceId` · "Thanks!" |
| `promo` | `gift` (peach) | "30% off your first order" | "Tap to view your discount" |

### Row tap behavior

- `kind === 'order'` → `router.push({ pathname: '/order-detail', params: { orderId, referenceId, createdAt: timestamp, state: state === 'READY' ? 'OPEN' : state, from: 'messages' } })`
- `kind === 'promo'` → `router.push('/promotions')`

### Time formatting

- "Today" / "Yesterday" / "Earlier" section heads, computed against device local time (`new Date()`).
- Inside each row, right-aligned timestamp:
  - Today → `5:32 PM`
  - Yesterday → `Yesterday 5:32 PM`
  - Earlier → `Mon 18 Apr`

## File Changes

### New
- `app/messages.tsx` — full-screen inbox route
- `hooks/use-message-events.ts` — derives `InboxEntry[]` + `hasTodayEvent`
- `components/messages/MessageRow.tsx` — single row component
- `components/messages/PromoCard.tsx` — pinned welcome discount card

### Modified
- `app/_layout.tsx` — register `<Stack.Screen name="messages">` with `from`-aware "Back to Home" header (mirror `order-detail` line 89-95)
- `components/home/HomeHeader.tsx`:
  - `onPress={() => router.push({ pathname: '/messages', params: { from: 'home' } })}`
  - Red dot becomes conditional on `hasTodayEvent` from the hook
- `store/orders.ts` — add `updatedAt: string | null` to `OrderHistoryItem`
- `mandys_bubble_tea/src/app/api/orders/history/route.ts` — add `updatedAt: order.updatedAt ?? null` to mapped response

## Edge Cases

| Case | Behavior |
|---|---|
| User signed out | `useOrdersStore` is empty; `welcomeDiscount.available` is false → empty state |
| API 401 / network error | Inherits store's existing error state; shows EmptyState (errors aren't surfaced — non-critical screen) |
| Order has no `referenceId` and no `ticketName` | Subtitle falls back to `'#' + id.slice(-3)` (matches `order-detail.tsx:189` behavior) |
| Server hasn't deployed `updatedAt` yet | `updatedAt` is undefined → derived `timestamp` falls back to `createdAt`; READY events show with placement time. Acceptable interim state. |
| Promo timing | Per D4, promo never contributes to red dot. Pinned card is the only surface. No timestamp logic needed. |
| Same order transitions twice in one day (PLACED → READY → COMPLETED) | One card, current state. Red dot stays lit (still "today event"). |
| Many orders (>50) | ScrollView is fine at this scale; revisit if list grows beyond 100. |

## Testing / Verification

- TypeScript: `npx tsc --noEmit` in both repos exits 0
- Manual:
  1. Sign in with welcome discount active → bell shows red dot → tap → see promo card pinned + empty state below
  2. Place an order → bell red dot stays → open messages → see "Order placed" today
  3. Square dashboard → mark order ready → push received → red dot stays → open messages → see "Your order is ready" today; tap → land on `/order-detail` with correct OL number
  4. Mark order completed → see "Order picked up" today; previous READY card replaced (one card per order)
  5. Cold start next day → red dot off; messages show yesterday's events under "Yesterday" head

## Open Question Resolved During Spec Review

The original brainstorm assumed a per-event timestamp (so a single order would generate up to 3 cards: PLACED, READY, COMPLETED). The data plumbing doesn't support this without per-transition logging. Switching to **one card per order, state-aware** preserves the user's intent (D = combined order+push events) without adding a server-side event table — it just collapses repeated transitions of the same order into the latest state. The trade-off is that the inbox can't show "your order went ready 5 minutes ago AND was picked up 2 minutes ago" as two separate rows; only the latest state appears. Given the use case (a customer at a bubble tea shop), this is fine.
