# Redesign Phase 3 — Menu + Product Detail Sheet

## Goal

Re-skin `app/(tabs)/menu.tsx` and `components/menu/ItemDetailSheet.tsx` + `ItemDetailContent.tsx` using Phase 1 design tokens (`T` / `TYPE` / `RADIUS` / `SHADOW` / `FONT`) and Phase 2's visual vocabulary (Fraunces display, Inter body, JetBrainsMono eyebrows/prices, `<Icon>` brand icons, `SectionHead`-style hierarchy). No structural redesign; no new features. Matches Phase 2 Home's look so the tab-to-tab feel is coherent.

## Scope

### In scope

- `app/(tabs)/menu.tsx` — full re-skin: root bg, search bar, sidebar, sidebar tabs, product rows, category section header (banner kept), empty state, error state
- `components/menu/ItemDetailSheet.tsx` — sheet header re-skin (drag handle, icon buttons, divider, bg), no snap-point change
- `components/menu/ItemDetailContent.tsx` — full re-skin: hero image (fixed 1:1), name + description, modifier sections (Size / Sugar / Ice / Toppings), sticky bottom CTA with total price; loading skeleton replaces ActivityIndicator; error state gets retry affordance
- `components/brand/Icon.tsx` — add `share` case (SVG share arrow); existing Icon names used throughout stay
- `components/menu/SkeletonCard.tsx` — update bg/border colors to tokens only (no structural change)
- `BRAND` imports in the four menu files replaced by `T` tokens; no new `BRAND` usages added anywhere in Phase 3

### Out of scope (defer to later phase / dropped)

- Quantity stepper in ItemSheet
- Preview snap point (50%) for ItemSheet
- Favorites / heart button
- Reviews, nutrition, allergen info
- Home/StoreCard re-layout (Phase 2 complete)
- Cart modal / 4-tab restructure (Phase 4)
- Account (Phase 6)
- `BRAND` const removal / migration in non-menu files (Phase 7)
- Category banner asset re-export or deletion (Phase 7)
- Language / i18n

### Phase 3d Supabase Auth WIP constraint

These files MUST remain byte-identical and uncommitted throughout Phase 3:

Modified:
- `app/(tabs)/account.tsx`
- `app/_layout.tsx`
- `components/auth/AuthProvider.tsx`
- `ios/Podfile.lock`
- `ios/mandysbubbleteaapp.xcodeproj/project.pbxproj`
- `ios/mandysbubbleteaapp/Info.plist`
- `ios/mandysbubbleteaapp/PrivacyInfo.xcprivacy`
- `ios/mandysbubbleteaapp/mandysbubbleteaapp.entitlements`

Untracked:
- `app/login.tsx`
- `assets/images/login-banner.webp`
- `components/auth/AuthGate.tsx`
- `components/legal/`
- `lib/legal.ts`

---

## §1. Menu screen shell (`app/(tabs)/menu.tsx`)

### Root container

- `flex: 1`, `backgroundColor: T.bg` (`#F2E8DF`)
- No other wrapper change; `<MiniCartBar />` renders last (unchanged)

### Search bar (top)

- `marginHorizontal: 12`, `marginTop: 8`, `marginBottom: 6`, `paddingHorizontal: 14`, `height: 42` (up from 38)
- `backgroundColor: T.paper`, `borderWidth: 1`, `borderColor: T.line`, `borderRadius: 999` (pill), `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 10`
- Leading icon: `<Icon name="search" color={T.ink3} size={18} />` (replaces Ionicons)
- Input: `flex: 1`, `fontFamily: 'Inter_400Regular'`, `fontSize: 14`, `color: T.ink`; placeholder `"Search drinks"`, `placeholderTextColor: T.ink3`
- Clear button (when `query.length > 0`): `<Icon name="close" color={T.ink3} size={16} />` inside a 24×24 hit area with `hitSlop={8}`
- Behavior unchanged: `autoCapitalize="none"`, `autoCorrect={false}`, `clearButtonMode="while-editing"`, `returnKeyType="search"`

### Two-column container (non-search mode)

- `flexDirection: 'row'`, `flex: 1`, no background (inherits `T.bg`)
- **Sidebar flex: 1** (stays)
- **Main flex: 3.2** (was 3) — gives right column ~8dp more over current 25/75 split

### Sidebar

- `backgroundColor: T.bg` (matches root)
- `paddingVertical: 8` (unchanged)

### Sidebar tab (one per category)

- Container: `minHeight: 64` (was 60), `paddingHorizontal: 6`, `paddingVertical: 12` (was 8), `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`
- Active tab: `backgroundColor: T.paper` (was `#fff`)
- Active vertical bar: `position: 'absolute'`, `left: 0`, `top: 12`, `bottom: 12`, `width: 4` (was 3), `backgroundColor: T.brand`, `borderTopRightRadius: 2`, `borderBottomRightRadius: 2`
- Label (`<Text>`): `fontSize: 12`, `lineHeight: 15`, `textAlign: 'center'`, `numberOfLines: 2`
  - Inactive: `fontFamily: 'Inter_500Medium'`, `color: T.ink3`
  - Active: `fontFamily: 'Inter_700Bold'`, `color: T.brand`

### Main column (non-search)

- `ScrollView` with existing handlers: `onScroll` (active tab sync), `onMomentumScrollEnd` / `onScrollEndDrag` (clears `scrollingToRef`), `onScrollBeginDrag` = `Keyboard.dismiss`
- `contentContainerStyle: { paddingBottom: 48 }` (unchanged)

### Search mode (query.trim().length > 0)

- Hide sidebar and two-column split; `ScrollView` goes full width
- Empty state (no matches): centered `TYPE.body` text `color: T.ink3`, `marginTop: 40`, `textAlign: 'center'`, content: `` `No drinks match "${query.trim()}"` ``
- Results: each result is a `<ProductRow />` same as category mode

### Loading state

- When `loading && items.length === 0` → render existing `<SkeletonSection />` (bg/border tokens updated, see §9)

### Error state

- When `error && items.length === 0` → centered container with `TYPE.body`, `color: T.ink3`, message: `"Menu unavailable. Try again later."` (no red color)

---

## §2. Category section header (`CategorySection`)

Keeps title + banner image.

### Card container

- `marginHorizontal: 16`, `marginTop: 24`, `marginBottom: 8`, `padding: 14`
- `backgroundColor: T.paper`, `borderRadius: RADIUS.card` (20), `borderWidth: 1`, `borderColor: T.line`
- `...SHADOW.card`

### Header layout (inside card)

Vertical stack:

1. **Eyebrow row** (tiny monospace label): `TYPE.eyebrow` (`JetBrainsMono_700Bold 10.5, letterSpacing: 1.3, uppercase`), `color: T.ink3`, content: `` `CATEGORY ${String(index + 1).padStart(2, '0')}` `` (e.g., `CATEGORY 01`)
2. **Title**: `TYPE.screenTitleSm` (`Fraunces_500Medium 22, letterSpacing: -0.5`), `color: T.ink`, `marginTop: 2`, `marginBottom: 10`, `numberOfLines: 1`
3. **Banner image**: only if `categoryBanner(category.name)` resolves; `<Image>` from `expo-image`, `source={banner}`, `contentFit="cover"`, `contentPosition="center"`, `width: '100%'`, `height: 96` (was 110), `borderRadius: RADIUS.tile` (12), `backgroundColor: T.sage`
4. **Banner overlay**: absolute-positioned `<View>` over banner, `borderRadius: RADIUS.tile`, `backgroundColor: 'rgba(42,30,20,0.06)'` — darkens brightness without inner shadow

### Position / layout in main scroll

- `CategorySection` wrapper view uses `onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}` (unchanged) so sidebar tab-active sync keeps working
- No `paddingTop` on the wrapper (margins inside the card handle spacing)

---

## §3. Product row (`ProductRow`)

### Row container

- `<TouchableOpacity>`, `activeOpacity: 0.6` (was 0.7)
- `flexDirection: 'row'`, `alignItems: 'center'`, `paddingHorizontal: 16`, `paddingVertical: 10` (was 12), `gap: 14` (was 12)
- Tap → `useItemSheetStore.getState().open(item.id)` (unchanged)
- No dividing border between rows

### Product thumbnail (76×76)

- Size: **76×76** (was 72)
- `borderRadius: RADIUS.tile` (12)
- If `item.imageUrl`: `<Image>` from `expo-image`, `source={{ uri: item.imageUrl }}`, `contentFit="cover"`, `contentPosition="center"`, `backgroundColor: T.sage`
- If no `imageUrl`: `<View>` 76×76, `backgroundColor: T.sage`, `borderRadius: RADIUS.tile`, `alignItems: 'center'`, `justifyContent: 'center'`, containing `<CupArt fill={hashColor(item.id)} size={60} />`
  - `hashColor(id)` = deterministic color picker from `[T.peach, T.cream, T.star, T.brand, T.sage]` by hashing `id` string — already exists in Phase 2 `components/home/CategoriesStrip.tsx` helper; lift to a `components/brand/color.ts` if not shared, or inline

### Info block (middle, `flex: 1`, `justifyContent: 'center'`, `gap: 4`)

- **Name**: `TYPE.cardTitle` (`Fraunces_500Medium 17, letterSpacing: -0.3`), `color: T.ink`, `numberOfLines: 2`
- **Variation subtitle** (optional): only if `firstVariation?.itemVariationData?.name` exists AND it's not the empty-ish value `"Regular"` (case-insensitive). Style: `fontFamily: 'Inter_400Regular'`, `fontSize: 11`, `color: T.ink3`, `numberOfLines: 1`
- **Price**: `fontFamily: 'Inter_600SemiBold'`, `fontSize: 14`, `color: T.ink2`. Format via existing `formatPrice(price)`. If `price == null` → omit entirely (no placeholder)

### Add button (`+`)

- **Size: 38×38** (was 32×32)
- `borderRadius: 999`, `backgroundColor: T.brand`, `alignItems: 'center'`, `justifyContent: 'center'`, `overflow: 'hidden'`
- Content: `<Icon name="plus" color="#fff" size={18} />`
- Press behavior (unchanged):
  - `cancelAnimation` both shared values
  - `btnScale`: `withSequence(withTiming(0.9, 80ms ease-out-quad), withTiming(1, 140ms ease-out-quad))`
  - Cross-fade plus → check:
    - `plusStyle`: `opacity: 1 - checkOpacity.value`
    - `checkStyle`: `opacity: checkOpacity.value`, `transform: [{ scale: 0.6 + checkOpacity.value * 0.4 }]`
    - `checkOpacity`: `withSequence(withTiming(1, 120ms), withTiming(0, 260ms))`
  - `Haptics.selectionAsync()` on tap (unchanged)
- Check glyph: `<Icon name="check" color="#fff" size={18} />` (replaces Ionicons checkmark)

### Cart add payload (unchanged)

```ts
addItem({
  id: item.id,
  variationId: firstVariation.id,
  name,
  price: Number(price ?? 0),
  imageUrl: item.imageUrl,
  variationName: firstVariation.itemVariationData?.name,
  modifiers: [],
})
```

---

## §4. ItemDetailSheet container (`components/menu/ItemDetailSheet.tsx`)

Uses `@gorhom/bottom-sheet`. Snap points stay `['90%']`, `enableDynamicSizing: false`, `enablePanDownToClose: true`.

### Drag handle

- Render above header inside the sheet (above the share/close row)
- Centered `<View>`, `width: 38`, `height: 4`, `borderRadius: 2`, `backgroundColor: T.ink4`, `marginTop: 8`, `alignSelf: 'center'`

### Header bar

- `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`
- `paddingHorizontal: 16`, `height: 44`
- Bottom divider: `borderBottomWidth: 1`, `borderBottomColor: T.line`

### Share button (left)

- `<Pressable>`, 36×36, transparent bg, pressed opacity 0.6, `hitSlop: 8`
- Content: `<Icon name="share" color={T.ink} size={20} />` — **requires adding `share` to `Icon.tsx`** (see §10)
- `onPress`: unchanged `Share.share({ message: url, url: url })` with `url = 'https://mandybubbletea.com/menu/' + itemId`

### Close button (right)

- `<Pressable>`, 36×36, transparent bg, pressed opacity 0.6, `hitSlop: 8`
- Content: `<Icon name="close" color={T.ink} size={22} />`
- `onPress`: unchanged `close()` → calls `useItemSheetStore.close()`

### Sheet surface

- `BottomSheetModal` itself: add `backgroundStyle={{ backgroundColor: T.paper, borderTopLeftRadius: RADIUS.sheetTop, borderTopRightRadius: RADIUS.sheetTop }}` — gorhom respects `backgroundStyle`
- Backdrop: unchanged `<BottomSheetBackdrop appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />`

### Content mount

- `<ItemDetailContent itemId={itemId} ScrollComponent={BottomSheetScrollView} />` (unchanged)

---

## §5. ItemDetailContent — hero + title

### Hero image

- Wrapper: `width: '100%'`, `aspectRatio: 1` (fixed 1:1), `backgroundColor: T.sage`, no border radius, no margin
- If `item.imageUrl`: `<Image>` from `expo-image`, `source={{ uri: item.imageUrl }}`, `style={{ flex: 1 }}`, `contentFit="cover"`, `contentPosition="center"`
  - **Remove** the dynamic `imageAspectRatio` state + `onLoad` handler — no longer needed
- If no `imageUrl`: `<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>` containing `<CupArt fill={hashColor(itemId)} size={200} />`

### Content padding

- Wrapper `<View>`: `padding: 20`, `gap: 14` (was 12)

### Name

- `TYPE.screenTitleLg` (`Fraunces_500Medium 28, letterSpacing: -0.5`), `color: T.ink`
- Source: `item.itemData?.name ?? ''` (unchanged)

### Description

- Only if `item.itemData?.description` truthy
- Style: `TYPE.body` (`Inter_400Regular 13, lineHeight: 19`), `color: T.ink3`, `marginTop: 4`

### Inline price preview

- **Removed.** Price below modifier sections is deleted; total lives in sticky CTA (§7)

---

## §6. Modifier sections (Size / Sugar / Ice / Toppings)

One unified section structure for all modifier lists + the virtual "Size" section at the top.

### Section wrapper

- `marginTop: 20`, `paddingHorizontal: 20` (matches content padding)

### Section header (horizontal row)

- `<View>`, `flexDirection: 'row'`, `alignItems: 'baseline'`, `justifyContent: 'space-between'`, `marginBottom: 10`
- Left stack (vertical, `gap: 2`):
  - Eyebrow: `TYPE.eyebrow`, `color: T.ink3`. Content derived from section name:
    - `SIZE`, `SUGAR`, `ICE`, `TOPPINGS`, or fallback `ml.name.toUpperCase()`
  - Title: `TYPE.cardTitle`, `color: T.ink`. Content:
    - Size: `"Choose size"`
    - Sugar: `"Sugar level"`
    - Ice: `"Ice level"`
    - Toppings: `"Add toppings"`
    - Fallback (any other modifier list): `ml.name`
  - Name matching is case-insensitive against `ml.name` (e.g., `"TOPPING"` → toppings title)
- Right: hint text via `describeSelection(ml)` (existing helper, unchanged logic). Style: `fontFamily: 'Inter_400Regular'`, `fontSize: 11`, `color: T.ink3`
  - For the synthetic Size section when exactly 1 variation: hint = `"Only option"` (no existing modifier list, so `describeSelection` not called — hardcode this string for the 1-variation case)
  - For the synthetic Size section when >1 variations: hint = `"Pick one"`

### Chip row

- `<View>`, `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: 8`

### Chip (single option)

Container `<Pressable>`:

- `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`, `paddingHorizontal: 16`, `paddingVertical: 10`, `borderRadius: 999`, `borderWidth: 1`
- Pressed: `opacity: 0.6` when not disabled; `opacity: 1` when disabled (no press feedback for disabled)

States:

- **Unselected, enabled**: `backgroundColor: T.paper`, `borderColor: T.line`
- **Selected**: `backgroundColor: T.brand`, `borderColor: T.brand`
- **Unselected, disabled** (`isModifierDisabled(ml, modId)` returns true): `backgroundColor: T.bg`, `borderColor: T.line`, wrapper `opacity: 0.5`; `Pressable` `disabled={true}`

Label text:

- `fontFamily: 'Inter_500Medium'`, `fontSize: 14`
- Color:
  - Unselected enabled: `T.ink`
  - Selected: `#fff`, `fontFamily: 'Inter_600SemiBold'`
  - Disabled: `T.ink4`

Price suffix (only if `mod.priceCents != null && mod.priceCents > 0`):

- `fontFamily: 'Inter_500Medium'`, `fontSize: 12`, `marginLeft: 4`
- Content: `` `+${formatPrice(mod.priceCents)}` ``
- Color:
  - Unselected enabled: `T.ink3`
  - Selected: `rgba(255,255,255,0.85)`
  - Disabled: `T.ink4`

No leading `✓` character is rendered — selection is communicated by the filled chip alone.

### Size section unification

Current code has two separate sections: a hardcoded "Large 700ml" disabled pill AND a "Select Size" section when `variations.length > 1`. Unified into one section:

- Always render one section labelled SIZE / "Choose size"
- Map over `item.itemData?.variations ?? []`
- When `variations.length === 1`: single chip, visually "selected" (since it's the only option), still `onPress` calls `setSelectedVariation(v)` (no-op) — not disabled, but hint says "Only option"
- When `variations.length > 1`: multi-chip, `onPress` sets `selectedVariation`; chip with `v.id === selectedVariation?.id` is selected
- Chip content: variation name (e.g., `"Large 700ml"`) + optional price suffix if `v.itemVariationData?.priceMoney?.amount != null` (chip price suffix format same as modifier)

### Topping modifier special rules (preserved)

- `ml.name.toUpperCase() === 'TOPPING'` → override `maxSelected: 3`, `minSelected: 0` (existing lines 60–63 of `ItemDetailContent.tsx`)
- `EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']` — picking one disables the other when the other is selected (existing `getExclusivePartner` helper unchanged)

### onByDefault pre-selection (preserved)

- Populate initial `selectedByList` from `modifiers.filter((m) => m.onByDefault)` during the fetch effect (existing lines 68–73)

### `describeSelection(ml)` hint (preserved, copy unchanged)

- `Pick one (optional)` / `Pick one` / `Pick any` / `Pick at least N` / `Pick up to N` / `Pick min–max`

---

## §7. Sticky bottom CTA

Replaces existing `styles.bottomBar` + `styles.addButton`. Lives outside the `ScrollComponent`, inside the `container` view's `flex: 1` parent.

### Container

- `paddingHorizontal: 16`, `paddingTop: 12`, `paddingBottom: 12 + insets.bottom` (use `useSafeAreaInsets` from `react-native-safe-area-context`; on Android `insets.bottom` is usually 0)
- `backgroundColor: T.paper`, `borderTopWidth: 1`, `borderTopColor: T.line`

### CTA button (`<Pressable>`)

- Full width, `borderRadius: 999`, `paddingVertical: 16`, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `paddingHorizontal: 20`
- States:
  - **Default** (enabled, not recently added): `backgroundColor: T.brand`, pressed opacity 0.85
    - Left text: `"Add to cart"`, `fontFamily: 'Fraunces_500Medium'`, `fontSize: 16`, `color: '#fff'`
    - Right text: `formatPrice(totalCents)`, `fontFamily: 'Inter_600SemiBold'`, `fontSize: 15`, `color: 'rgba(255,255,255,0.9)'`
  - **Added** (`added === true`, 1500ms window): `backgroundColor: T.greenDark`
    - Single centered row: `<Icon name="check" color="#fff" size={18} />` + `"Added"` text (`Fraunces_500Medium 16, color: '#fff', marginLeft: 8`)
  - **Disabled** (`!selectedVariation`): `backgroundColor: T.ink4`, `Pressable` disabled, same layout as default but no price

### `totalCents` derivation

- `base = Number(selectedVariation?.itemVariationData?.priceMoney?.amount ?? 0)`
- `mods = sum over modifierLists.flatMap(ml => ml.modifiers.filter(m => selectedByList[ml.id]?.has(m.id)).map(m => Number(m.priceCents ?? 0)))`
- `totalCents = base + mods`

### Add behavior (preserved)

- `handleAddToCart()` on press — same payload construction (variation + chosen modifiers), same Haptics success pulse, same 1500ms `added` timer on `setAdded(true)` → `setAdded(false)` via `addedTimerRef`, same cleanup in `useEffect(() => () => clearTimeout(addedTimerRef.current))` on unmount

---

## §8. Loading + error states inside ItemDetailContent

### Loading (replaces `<ActivityIndicator>`)

Skeleton placeholder, static (no shimmer animation — YAGNI):

- Hero: `<View>` `width: '100%'`, `aspectRatio: 1`, `backgroundColor: T.sage`, no inner content
- Content padding `20`:
  - 3 stacked placeholder bars, `gap: 10`:
    - Title bar: `height: 28`, `width: '70%'`, `borderRadius: 8`, `backgroundColor: T.line`
    - Desc bar 1: `height: 14`, `width: '100%'`, `borderRadius: 7`, `backgroundColor: T.line`
    - Desc bar 2: `height: 14`, `width: '60%'`, `borderRadius: 7`, `backgroundColor: T.line`
  - Section placeholder: `marginTop: 24`, one eyebrow-bar (`height: 10`, `width: 80`) + chip-row placeholder (3 chips, each `height: 36`, `width: 80`, `borderRadius: 999`, `backgroundColor: T.line`, `gap: 8`)

### Error

- Centered `<View>`, `padding: 40`
- Icon (optional): `<Icon name="cafe" color={T.ink3} size={32} />` (spare icon for empty/error — already exists)
- Title: `TYPE.cardTitle`, `color: T.ink`, `textAlign: 'center'`, content `"Couldn't load this drink."`
- Message: `TYPE.body`, `color: T.ink3`, `textAlign: 'center'`, `marginTop: 6`, content = the caught error message (or `"Try again."` if empty)
- Retry button: `<Pressable>`, `marginTop: 16`, `paddingHorizontal: 20`, `paddingVertical: 10`, `borderRadius: 999`, `borderWidth: 1`, `borderColor: T.brand`, `backgroundColor: 'transparent'`; label `Inter_600SemiBold 13, color: T.brand, content: "Try again"`
- Retry mechanism: bump a `retryNonce` `useState` counter; include in the fetch effect's dependency array so clicking re-runs the fetch

---

## §9. Supporting component tweaks

### `components/menu/SkeletonCard.tsx` — tokens only

Replace any hardcoded `#fff`, `#f5f5f5`, `BRAND.*` with:

- `backgroundColor` placeholders → `T.sage` for images, `T.line` for text bars, `T.paper` for card
- `borderColor` → `T.line`

No structural change.

### `components/brand/Icon.tsx` — add `share` case

Add a new `case 'share':` branch that returns an SVG of a generic share arrow. Suggested path (standard system share icon):

```xml
<Svg width={size} height={size} viewBox="0 0 24 24">
  <Path
    d="M12 3 L7 8 M12 3 L17 8 M12 3 V15"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
  <Path
    d="M5 13 V19 Q5 21 7 21 H17 Q19 21 19 19 V13"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
</Svg>
```

Optical alignment not critical — this icon is used once in the sheet header and target size is 20.

### `lib/constants.ts` — untouched

`BRAND` stays defined; only the four menu files stop importing it. Phase 7 deletes it.

---

## §10. File map (summary)

| File | Change type | Summary |
|---|---|---|
| `app/(tabs)/menu.tsx` | modify | Full re-skin: root bg, search bar, sidebar, rows, section headers. Drop `BRAND` import. |
| `components/menu/ItemDetailSheet.tsx` | modify | Drag handle, icon buttons → transparent `<Icon>`, divider, `backgroundStyle` with `T.paper` + `RADIUS.sheetTop`. |
| `components/menu/ItemDetailContent.tsx` | modify | Fixed 1:1 hero, Fraunces display name, unified Size section, token-based chips, sticky CTA with total price, skeleton loading, error with retry. Drop `BRAND` import. |
| `components/menu/SkeletonCard.tsx` | modify | Replace hardcoded colors with tokens. Keep structure. |
| `components/brand/Icon.tsx` | modify | Add `case 'share':` returning share-arrow SVG. |

No file deletions, no new files.

---

## §11. Validation

### Static

- `npx tsc --noEmit` clean
- `npm run lint` — zero new errors/warnings introduced by changed files. (Pre-existing warnings in `app/login.tsx`, `app/checkout.tsx`, `app/order-*.tsx`, `components/cart/CartItem.tsx`, `app/(tabs)/menu.tsx`'s `react/no-unescaped-entities` may remain; if any of those are in files this phase touches — e.g. `menu.tsx` — they MUST be cleared.)
- `grep -n "BRAND" app/(tabs)/menu.tsx components/menu/*.tsx` → zero matches after the phase

### Phase 3d WIP preservation

- `git status --short` after the phase lists exactly the 8 modified + 6 untracked auth/legal files listed in "Scope → Phase 3d constraint" and nothing else.

### On-device smoke (iOS + Android)

Menu screen:
- **Search empty**: sidebar + row list visible, fonts render in Fraunces/Inter, `+` button is 38×38, row image 76×76 with T.sage fallback when no URL (CupArt showing)
- **Search query**: sidebar hides, full-width row list shows filtered results; no-match state shows `No drinks match "…"` in muted copy
- **Sidebar tab tap**: scrolls to section; active tab changes to `T.paper` bg + brick-red bar
- **Scroll while category list**: active sidebar tab auto-switches as you cross sections (tracking unchanged)
- **Row `+` tap**: scale + check animation; item added to cart; MiniCartBar count increments
- **Row body tap**: ItemSheet opens

ItemSheet:
- **Header**: drag handle visible; share and close buttons have transparent bg; divider line below header
- **Hero**: 1:1 square, content-fit cover, center; no dynamic aspect-ratio wobble on load
- **Name**: Fraunces 28
- **Sections**: SIZE / SUGAR / ICE / TOPPINGS each with eyebrow + title + hint; chips match spec states (unselected/selected/disabled)
- **Single-variation size**: one chip selected, hint "Only option"
- **Multi-variation size**: pick switches selected chip, total price updates
- **Toppings**: 3rd topping disables 4th; Cheese Cream and Brulee mutually exclude
- **onByDefault**: pre-selected chips shown on open
- **CTA**: left "Add to cart", right live total (formatted); press → success (green "Added" with check) for 1.5s; cart updates; sticky over scroll
- **Safe area**: CTA lifts above iOS home indicator; not doubled on Android

Loading:
- Open sheet on slow network / simulate delay: skeleton hero (T.sage square) + skeleton bars visible; no spinner

Error:
- Simulate `/api/catalog/BAD_ID` failure (or toggle airplane mode while opening): error copy + retry button; tap retry → refetch

Visual parity:
- Side-by-side vs Phase 2 Home (same fonts, shadows, chip radius). No remaining `BRAND.color` brick red in menu UI except the sidebar active vertical bar (which uses `T.brand`, same shade).

### Performance

- No new `setInterval` / `setTimeout` outside existing ones
- `expo-image` with `contentFit="cover"` + `contentPosition="center"` caches fine
- Skeleton is static (no Reanimated loop)

---

## §12. Open questions (none)

All design decisions confirmed during brainstorm (A/A/A/A/A/OK/OK/OK). No TBDs.

---

## §13. Risks

| Risk | Mitigation |
|---|---|
| Fraunces 28 on some Android devices fell back to serif during Phase 2 | `useFonts` gate in `_layout.tsx` already loads 500/400/700; verify `Fraunces_500Medium` is in the loaded weights list (it is, per Phase 1). No change needed. |
| `CupArt` `hashColor` lives in one Phase 2 file — lifting it creates a tiny util file | Phase 3 Task adds `components/brand/color.ts` exporting `hashColor(id: string): string` (5 of the T.* palette colors by djb2 hash) and updates Phase 2's `CategoriesStrip` to import from it in the same commit. |
| Sheet `backgroundStyle` not applying on older gorhom versions | Current dep is `@gorhom/bottom-sheet` — verify in package.json during Task 0. If absent, use a wrapping `<View>` inside the sheet with the bg instead. |
| Icon `share` SVG differs visually from Ionicons current one | Acceptable — rest of app now uses `<Icon>` exclusively. Single-use icon; drift is fine. |
| Phase 3d WIP drift (auth/legal files) | Every task's commit stages specific files; `git add -A` is prohibited. Final `git status` check enforces byte-identical WIP. |

---

## §14. References

- Umbrella spec: `docs/superpowers/specs/2026-04-19-redesign-umbrella.md` §3 (Menu + Product Detail)
- Phase 1 Foundation spec: `docs/superpowers/specs/2026-04-19-redesign-01-foundation.md`
- Phase 2 Home spec: `docs/superpowers/specs/2026-04-19-redesign-02-home.md`
- Phase 1 tokens: `constants/theme.ts` (`T`, `TYPE`, `RADIUS`, `SHADOW`, `FONT`)
- Phase 1 icons: `components/brand/Icon.tsx`
- Phase 1 CupArt: `components/brand/CupArt.tsx`
- Phase 2 SectionHead: `components/home/SectionHead.tsx`
