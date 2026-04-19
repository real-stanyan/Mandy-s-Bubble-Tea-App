# Redesign Phase 4 — Tab Bar + Mini-Cart Pill + Cart Sheet

Date: 2026-04-19
Umbrella: `docs/superpowers/specs/2026-04-19-redesign-umbrella.md`
Depends on: Phase 1 (Foundation — `T` tokens + `<Icon>` + `<CupArt>`)
Design reference:
- Tab bar — `reference/src/shared.jsx:212-245`
- MiniCart — `reference/src/App.jsx:142-174`
- CartSheet — `reference/src/App.jsx:14-140`

## Goal

Re-skin the bottom tab bar, floating mini-cart pill, and cart bottom-sheet modal to the new visual system. Hoist MiniCartBar + CartSheet to a single global mount on the tabs layout so the pill is visible across all four tabs and the sheet opens from anywhere inside the tab shell. Remove the dormant `app/(tabs)/cart.tsx` tab screen.

## Non-goals

- No change to cart data model (`store/cart.ts`) or cart-sheet open/close signalling (`store/cartSheet.ts`).
- No change to `CartItem` row's per-item data dependencies — only its visual shell.
- No change to `CartItem` business logic (modifier grouping, lineId dedupe, quantity bounds).
- No addition of a new deep-link route for the cart. `mbt://cart` and any `/(tabs)/cart` references are deliberately broken here — the cart is a modal, not a page.
- No change to Checkout screen. The sheet's "Checkout →" continues to `router.push('/checkout')`.
- No change to the legacy `BRAND` const. Only the four files touched in this phase migrate their `BRAND.*` references to `T.*`.

## Current state (2026-04-19)

- Tab bar: `app/(tabs)/_layout.tsx` uses `Ionicons` + `BRAND.color`; 4 visible tabs (`index`, `menu`, `order`, `account`) + one hidden `<Tabs.Screen name="cart" href={null} />`.
- `app/(tabs)/cart.tsx` exists (66 lines, `FlatList` + bottom bar) but is unreachable — legacy stub.
- `MiniCartBar` is imported and mounted per-screen in `app/(tabs)/index.tsx` and `app/(tabs)/menu.tsx`. Orders and Account tabs have no pill.
- `CartSheet` is mounted globally in `app/_layout.tsx` (inside the root stack, above all screens including `checkout`).
- All four `components/cart/*.tsx` files use `Ionicons` + `BRAND.color`, not the Phase 1 `<Icon>` / `T.*`.

## Target state

### Mount topology

| Surface | Where it mounts |
|---|---|
| `<CartSheet />` | `app/(tabs)/_layout.tsx` — inside tab layout, above tab screens, below modal stacks |
| `<MiniCartBar />` | `app/(tabs)/_layout.tsx` — single mount, one instance for all four tabs |
| Old mounts removed | `app/_layout.tsx` (CartSheet), `app/(tabs)/index.tsx` (MiniCartBar), `app/(tabs)/menu.tsx` (MiniCartBar) |

Rationale: The sheet and pill belong to the tab shell conceptually. Mounting inside the tabs layout naturally hides the pill on pushed screens (`/checkout`, `/order-detail`) without explicit state and stops sheet z-index fights with the checkout's own sticky CTA.

### Tab bar (`app/(tabs)/_layout.tsx`)

- **Removed**: `<Tabs.Screen name="cart" />`, `Ionicons` imports, `BRAND` import.
- **Added**: `<Icon>` from `@/components/brand/Icon`, `T` from `@/constants/theme`, `<CartSheet />` + `<MiniCartBar />` mounts.
- **Screen order preserved**: `index` → `menu` → `order` → `account`. `order` tab keeps its `tabBarBadge` driven by `useOrdersStore.activeOrderCount`.
- **Icon mapping**: `home`, `cafe`, `receipt`, `user` — all from the Phase 1 `<Icon>` set.

**Style (per `reference/src/shared.jsx:219-244`):**

```
tabBarStyle:
  backgroundColor: T.paper
  borderTopColor: T.line
  borderTopWidth: StyleSheet.hairlineWidth
  paddingTop: 8
  paddingBottom: (safe area inset) ?? 30 on iOS / 8 on Android
  height: 8 + 24 (icon) + 3 (gap) + 14 (label line) + bottom pad
tabBarActiveTintColor: T.brand
tabBarInactiveTintColor: T.ink3
tabBarLabelStyle:
  fontFamily: FONT.inter
  fontSize: 10.5
  fontWeight active ? '700' : '500'
  letterSpacing: 0.1
tabBarBadgeStyle:
  backgroundColor: T.brand
  color: '#fff'
  fontSize: 11
  fontWeight: '700'
```

`paddingBottom` is computed from `useSafeAreaInsets().bottom` — use the default `Tabs` iOS behaviour (honours `SafeAreaView` automatically) unless measurement on-device shows a gap; fall back to the hard-coded 30px from the design only if needed.

### MiniCartBar (`components/cart/MiniCartBar.tsx`)

- **Removed**: `Ionicons`, `BRAND`.
- **Added**: `<Icon name="bag" />`, `T.brand`, `FONT.inter`, `useSafeAreaInsets` coordination with `useBottomTabBarHeight()`.
- **Position**: `position: absolute`, `left: 12`, `right: 12`, `bottom = tabBarHeight + 8`. Use `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` (already a transitive dep of `expo-router`) so the pill sits 8px above the real tab bar regardless of safe-area padding.
- **Visual (per `reference/src/App.jsx:142-174`):**
  - Container: `T.brand` bg, radius 28, `paddingLeft: 14`, `paddingRight: 6`, `paddingVertical: 6`, gap 10.
  - Shadow: `shadowColor: '#000', opacity 0.3, radius 10, offset (0, 10)` on iOS; `elevation: 8` on Android.
  - Left: bag icon 20px white + count badge (top `-3`, right `-6`, min 16×16, white bg, `T.brand` text, 10px 800 weight).
  - Middle: `A$${total.toFixed(2)}` — white, 15px, 700, `FONT.inter`.
  - Right: "View Cart" chip — white bg, `T.brand` text 13px 700, `paddingHorizontal: 16`, `paddingVertical: 8`, radius 22.
- **Animation preserved**: existing `useAnimatedReaction` entrance / pulse / exit stays byte-identical. Only style tokens change.
- **Zero-count behaviour preserved**: `if (itemCount === 0) return null`.

### CartSheet (`components/cart/CartSheet.tsx`)

Swap out everything inside `<BottomSheetModal>` for the reference layout, keep the gorhom modal shell and store wiring.

**Preserved**:
- `BottomSheetModal` + `BottomSheetScrollView` + `BottomSheetBackdrop` usage.
- `useCartSheetStore` open/hide wiring.
- `router.push('/checkout')` on Checkout tap.
- `clearCart` on Clear tap.
- Auto-close `useEffect` when `items.length === 0` (problem 3 decision A).
- `snapPoints: ['75%']`, `enableDynamicSizing: false`, `enablePanDownToClose: true`.

**New layout (top to bottom, per `reference/src/App.jsx:14-140`):**

1. **Header** (`paddingHorizontal: 24`, `paddingTop: 18`, `paddingBottom: 8`, row with `alignItems: 'flex-end'` and `justifyContent: 'space-between'`):
   - Left column:
     - Eyebrow: `FONT.jetBrainsMono` 10.5, weight 700, `letterSpacing: 1.5`, color `T.brand`, UPPERCASE — literal `"YOUR CART"`.
     - Title: `FONT.fraunces` 26, weight 500, `letterSpacing: -0.6`, color `T.ink`, `marginTop: 4`, `lineHeight: 1.1 * 26` — renders `{count} item` (count === 1) or `{count} items`.
   - Right: **"Clear" text button** (fontSize 12, weight 600, color `T.ink3`, 6×10 padding) — only when `items.length > 0`.
2. **Items list** inside `BottomSheetScrollView` (`paddingHorizontal: 16`, `paddingTop: 6`, `paddingBottom: 0`):
   - Each `<CartItemRow>` styled as below.
3. **Total row** (only when items.length > 0):
   - `marginTop: 8`, `paddingHorizontal: 8`, `paddingVertical: 14`.
   - `borderTopWidth: 1`, `borderTopColor: T.line`, `borderStyle: 'dashed'`.
   - Row: left eyebrow `"TOTAL"` in JetBrains Mono 11 / 700 / `letterSpacing: 1.2` / `T.ink3`; right amount `A$${total.toFixed(2)}` in JetBrains Mono 22 / 700 / `T.ink`.
4. **Footer** (`paddingHorizontal: 24`, `paddingTop: 14`, `paddingBottom: inset + 12`, `flexDirection: 'row'`, `gap: 10`):
   - Left button "Keep browsing" — transparent bg, `T.line` 1px border, `T.ink2` text 14/600, radius 999, `paddingVertical: 14`, `paddingHorizontal: 20`. OnPress: `hide()`.
   - Right button "Checkout →" — `flex: 1`, bg `T.ink` (dark, not `T.brand`, per design), `T.cream` text 14/700, `letterSpacing: 0.2`, radius 999, `paddingVertical: 14`, centered row with `<Icon name="arrow" size={14} color={T.cream} />` after text. Disabled when `items.length === 0` — bg `T.ink4`, same text. OnPress: `hide()` then `router.push('/checkout')`.

### CartItemRow (`components/cart/CartItem.tsx`)

**Preserved**:
- `item: CartItem` type, modifier grouping helpers, `useCartStore` add/remove/updateQty actions, `lineId` key use.

**New layout (per `reference/src/App.jsx:55-100`):**
- Row: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 12`, `paddingHorizontal: 8`, `paddingVertical: 12`, `borderTopWidth: 1`, `borderTopColor: T.line` (first row's top border is visually absorbed by header).
- **Thumbnail**: 44×44, radius 10, bg `#f1ebe4`. If `item.imageUrl` present → `<Image>` `contentFit: 'cover'`. Else → `<CupArt size={28} fill={T.brand} stroke={T.ink} />`. Shrinks: `flexShrink: 0`.
- **Middle block** (`flex: 1`, `minWidth: 0`):
  - Name line: Inter 13.5, weight 600, `T.ink`, `lineHeight: 1.2 * 13.5`, `numberOfLines: 1`.
  - Price line: `marginTop: 2`, JetBrains Mono 12, weight 600, `T.brand` — `A$${unitPrice.toFixed(2)}` (per-unit, not line total).
  - (Modifier summary stays — same `Size: Large · Ice: Less · Topping: Tapioca` format, Inter 11, `T.ink3`, `numberOfLines: 2`, `marginTop: 2`.)
- **Stepper pill** (right-aligned):
  - Shell: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 8`, bg `rgba(42,30,20,0.05)`, radius 999, padding 3.
  - `−` button: 26×26, radius 13, bg `#fff`, text `−` 16/700, `T.ink2`. OnPress: `updateQuantity(item.lineId, item.quantity - 1)` — store auto-removes when quantity ≤ 0.
  - Qty text: minWidth 14, centered, JetBrains Mono 13/700, `T.ink`.
  - `+` button: 26×26, radius 13, bg `T.brand`, renders `<Icon name="plus" color="#fff" size={14} />`. OnPress: `updateQuantity(item.lineId, item.quantity + 1)` — no cap beyond existing store behaviour.

### Files deleted

- `app/(tabs)/cart.tsx`
- `components/cart/EmptyCart.tsx` — verify via `grep -r "EmptyCart"` it's no longer imported anywhere. If a stray import exists in `app/(tabs)/cart.tsx` only, deleting both resolves it.

## File impact table

| File | Action | Phase 3d overlap |
|---|---|---|
| `app/_layout.tsx` | Remove `<CartSheet />` line + its import (2 edits) | **YES — stash isolate** |
| `app/(tabs)/_layout.tsx` | Rewrite (new icons, tokens, remove cart screen, mount pill + sheet) | no |
| `app/(tabs)/index.tsx` | Remove `<MiniCartBar />` + import (2 edits) | no |
| `app/(tabs)/menu.tsx` | Remove `<MiniCartBar />` + import (2 edits) | no |
| `app/(tabs)/cart.tsx` | **Delete** | no |
| `components/cart/MiniCartBar.tsx` | Full restyle + position via `useBottomTabBarHeight()` | no |
| `components/cart/CartSheet.tsx` | Body rewrite inside BottomSheetModal | no |
| `components/cart/CartItem.tsx` | Full restyle: thumbnail + stepper pill + typography | no |
| `components/cart/EmptyCart.tsx` | **Delete** (unused after `cart.tsx` removed) | no |

No other files are modified. Phase 3d WIP files (`app/_layout.tsx`, `components/auth/AuthProvider.tsx`, `app/(tabs)/account.tsx`, `components/auth/AuthGate.tsx`, `components/legal/*`, `lib/legal.ts`, `app/login.tsx`, native iOS dirs) — only `app/_layout.tsx` is shared, isolated via `git stash push -- app/_layout.tsx`.

## Success criteria

- `npx tsc --noEmit` clean.
- `npm run lint` — no new warnings beyond the phase-entry baseline (capture count before first commit, compare after last).
- `grep -rn "from '@/lib/constants'" components/cart/ app/\(tabs\)/_layout.tsx` returns zero matches (only `T`/`FONT` imports in the four touched files).
- `grep -rn "Ionicons" components/cart/ app/\(tabs\)/_layout.tsx` returns zero matches.
- `grep -rn "EmptyCart\|from.*tabs.*cart" --include='*.ts' --include='*.tsx' .` returns zero matches.
- On iOS real device + Android mid-size device:
  1. Home tab + empty cart: no pill visible, tab bar renders new tokens.
  2. Add 1 drink from Menu → pill slides up from just above tab bar, shows "1 / A$X.XX / View Cart".
  3. Switch to Orders tab → pill still visible.
  4. Switch to Account tab → pill still visible.
  5. Tap pill → sheet rises with new header ("YOUR CART" + "1 item"), CupArt thumb (or image), stepper pill.
  6. `+` → qty 2, line price updates, pill total updates, pulse animation fires.
  7. `−` on qty-1 row → row removes, sheet may stay open with remaining items.
  8. Tap Clear → all items gone → sheet auto-closes.
  9. Re-add an item → pill entrance animation replays.
  10. Tap "Keep browsing" → sheet closes; "Checkout →" → sheet closes + `/checkout` opens.
  11. On `/checkout` screen: no pill, no stray CartSheet.
  12. Drag the sheet down → closes normally, no layout jump behind it.
- BRAND import count in `components/cart/` and `app/(tabs)/_layout.tsx`: **before = 4** (`CartSheet`, `EmptyCart` [deleted], `MiniCartBar`, tab layout), **after = 0**.
- Phase 3d WIP (`git diff` lines across 3 files + untracked count) byte-identical after the phase's final commit.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Phase 3d WIP in `app/_layout.tsx` corrupted when removing `<CartSheet />` | `git stash push -- app/_layout.tsx` before edit; after commit, `git stash pop`; if the removed line is in a conflict-free region of the Phase 3d diff, pop is clean |
| `useBottomTabBarHeight()` returns 0 on first render (race with tab layout mount) | Hook returns height synchronously once inside a `<Tabs>` descendant; `MiniCartBar` will always be mounted as a child of the tabs layout so it never reads outside that context. Guard with `|| 80` fallback if the runtime warns |
| gorhom `BottomSheetModal` re-mount breaks existing ItemDetailSheet ordering | `CartSheet` stays a sibling of `ItemDetailSheet` in the same provider subtree; only its parent node changes from root to tabs layout. Both use the same `BottomSheetModalProvider` higher up |
| Deep link `mandybubbletea://(tabs)/cart` from an old email / push silently 404s | Accepted (problem 2 decision A). If ever needed, a thin `app/cart.tsx` with `useEffect(() => { show(); router.replace('/(tabs)') }, [])` is a one-file add |
| Android tab bar padding double-counts safe area | Use platform-split: `paddingBottom: Platform.OS === 'ios' ? undefined : 8`, let `Tabs` apply iOS safe area via its built-in handling; verify on device |
| Reanimated pulse animation regresses after `BRAND.color` → `T.brand` bg change | Colors are static string constants; animations only animate `opacity`/`transform`. No risk, covered by existing logic |
| Moving CartSheet from root to tabs breaks "open cart from push screen" use case | No such call site exists (`grep useCartSheetStore` shows only MiniCartBar + CartSheet itself). Checkout never triggers `show()` |

## Open items

None.
