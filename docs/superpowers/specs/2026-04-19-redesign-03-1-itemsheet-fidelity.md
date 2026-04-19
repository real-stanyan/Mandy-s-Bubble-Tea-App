# Phase 3.1 — ItemSheet design fidelity

**Goal:** Close the six divergences between the Phase 3 shipped ItemSheet and the approved Figma reference.

**Scope:** `components/menu/ItemDetailContent.tsx` + one new tiny file (`components/menu/bestsellers.ts`). No other files.

**Tech stack:** Expo SDK 54, React Native 0.81, TypeScript, `@/constants/theme` tokens, `zustand` cart store (unchanged API).

---

## Divergences & resolutions

| # | Design shows | Phase 3 shipped | Decision |
|---|---|---|---|
| 1 | `[− N +]` stepper left of CTA | CTA only | Stepper left, CTA right, CTA shows `total × N`. |
| 2 | Toppings as full-width checkbox rows | Pill chips | Detect Topping list; render rows. Other sections stay chips. |
| 3 | Size shows `−A$0.50` / blank / `+A$0.80` | Shows `+A$7.80` absolute | Compute deltas from baseline (Regular if present, else `variations[0]`). |
| 4 | `REQUIRED` pill top-right of section | Hint text (e.g. "Pick one") | Show `REQUIRED` pill when `minSelected >= 1` or Size section; replaces hint. |
| 5 | `BESTSELLER` pill above name | None | Hardcoded name list in `components/menu/bestsellers.ts`; pill uses `T.star` bg. |
| 6 | Base price beside item name | None | `flex-row space-between` title row; right-aligned Fraunces 22px baseline price. |

---

## §1 Quantity stepper

**Component position:** inside `ctaBar` — `flex: row`, `gap: 12`, `paddingHorizontal: 16`, `paddingTop: 12`, `paddingBottom: 12 + insets.bottom`.

**Stepper container:**
- `flex: row`, `alignItems: center`, `gap: 6`
- `paddingHorizontal: 6`, `paddingVertical: 4`
- `borderRadius: 999`, `borderWidth: 1`, `borderColor: T.line`, `backgroundColor: T.paper`
- Width is intrinsic (no fixed width); children drive size.

**− / + buttons (both identical):**
- `width: 40`, `height: 40`, `borderRadius: 999`, `alignItems: center`, `justifyContent: center`
- `+` button uses `<Icon name="plus" size={18} color={T.ink} />`.
- `−` button uses a `<Text>` with character `−` (U+2212) — the brand `Icon` component does not export a minus glyph. Style: `fontFamily: 'Inter_600SemiBold'`, `fontSize: 22`, `lineHeight: 22`, `color: T.ink`. This keeps weight parity with the plus icon.
- Disabled state: `opacity: 0.4`, onPress no-op.
- Pressed: `opacity: 0.5`.

**Count label:**
- `minWidth: 24`, `textAlign: center`
- `fontFamily: Inter_600SemiBold`, `fontSize: 16`, `color: T.ink`.

**State:**
- Local: `const [quantity, setQuantity] = useState(1)`
- `− onPress`: `setQuantity((q) => Math.max(1, q - 1))`, `Haptics.selectionAsync()`
- `+ onPress`: `setQuantity((q) => Math.min(99, q + 1))`, `Haptics.selectionAsync()`
- `− disabled` when `quantity === 1`; `+ disabled` when `quantity === 99`.

**CTA integration:**
- CTA wrapper gets `flex: 1` so stepper + CTA fill the bar.
- CTA amount becomes `formatPrice(totalCents * quantity)`.
- "Add to cart" label unchanged.
- `handleAddToCart` calls `addItem(...)` in a `for (let i = 0; i < quantity; i++) { addItem(...) }` loop. Cart store dedupes by `lineId` and bumps quantity — single visible line with count N.
- After a successful add, reset `quantity` to 1 (inside the same `setAdded(true)` block, set before the 1500ms timer fires).
- During the "Added" state (1500ms), stepper stays visible but is **not** disabled — user can still tweak count for a second add.

**Accessibility:**
- Both buttons: `accessibilityRole="button"`, `accessibilityLabel="Increase quantity"` / `"Decrease quantity"`, `accessibilityState={{ disabled }}`.
- Count label: `accessibilityLiveRegion="polite"`, `accessibilityLabel={`Quantity ${quantity}`}`.

---

## §2 Toppings as checkbox rows

**Detection:** `const isToppingList = (name: string) => (name ?? '').toUpperCase().includes('TOPPING')`.

**Section rendering logic (in the `modifierLists.map` block):**
```
if (isToppingList(ml.name)) render <ToppingSection /> (checkbox rows)
else render existing pill chip <ModifierSection />
```

**`ToppingSection` layout:**
- Reuse the existing `sectionHeader` markup (eyebrow + title + REQUIRED/hint) — header is identical.
- Row container: `marginTop: 10`, `borderTopWidth: 1`, `borderTopColor: T.line`, `backgroundColor: 'transparent'`.
- Each row:
  - `Pressable`, disabled when `isModifierDisabled(ml, mod.id)` and not already selected.
  - `flexDirection: row`, `alignItems: center`, `paddingVertical: 14`, `gap: 12`.
  - `borderBottomWidth: 1`, `borderBottomColor: T.line` (includes trailing divider on last row for visual closure).
  - Children: `<Checkbox />`, `<Text label />` (`flex: 1`), `<Text price />` (right, only if `priceCents > 0`).
  - Disabled row: `opacity: 0.45`.
  - Pressed: `opacity: 0.6`.
  - Accessibility: `accessibilityRole="checkbox"`, `accessibilityState={{ checked: isSelected, disabled: isDisabled }}`.

**Checkbox component (inline, in same file):**
- Size `22×22`, `borderRadius: 6`, `borderWidth: 1.5`.
- Unchecked: `borderColor: T.line`, `backgroundColor: T.paper`.
- Checked: `borderColor: T.brand`, `backgroundColor: T.brand`, contains `<Icon name="check" size={14} color="#fff" />` centered.

**Text:**
- Label: `fontFamily: Inter_500Medium`, `fontSize: 15`, `color: T.ink`.
- Price: `fontFamily: Inter_500Medium`, `fontSize: 13`, `color: T.ink3`. Format: `+{formatPrice(priceCents)}`. Omitted when `priceCents === 0`.

**Business rules preserved verbatim:**
- `EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']` — selecting one disables the other.
- `maxSelected: 3` — when three already selected, remaining unselected rows show disabled state.
- `onByDefault` modifiers pre-selected on load (existing `useEffect` handles this — unchanged).

---

## §3 Size chips with deltas

**Baseline selection (once, memoized via `useMemo` on `variations`):**
```
const baselineVariation = useMemo(() => {
  if (!variations.length) return null
  return variations.find((v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular')
    ?? variations[0]
}, [variations])
```

**Initial selected variation:** set to `baselineVariation` (replaces `variations[0]` in the existing load `useEffect`).

**Chip label with delta:**
```
const baselineAmount = Number(baselineVariation?.itemVariationData?.priceMoney?.amount ?? 0)
const priceAmt = Number(v.itemVariationData?.priceMoney?.amount ?? 0)
const delta = priceAmt - baselineAmount
const priceSuffix =
  delta === 0 ? null
  : delta < 0 ? `−${formatPrice(Math.abs(delta))}`
  : `+${formatPrice(delta)}`
```

Pass this `priceSuffix` to the existing `Chip` — it already handles `null` by omitting the suffix.

**Important:** the minus sign is a Unicode MINUS (`−` U+2212), **not** a hyphen-minus. The design reference uses a true minus glyph for typographic balance.

---

## §4 REQUIRED badge

**Rule:**
- Size synthetic section: always required.
- All other `modifierLists`: required when `ml.minSelected >= 1`.

**Replacement of hint:** the existing `sectionHint` (e.g. "Pick one") is **replaced** by the REQUIRED pill when required. A section is never shown with both.

**Update `ModifierSection` prop shape:**
```
{ eyebrow: string; title: string; hint: string; required?: boolean }
```

Inside `sectionHeader` right-side:
- If `required` → render `<RequiredBadge />`.
- Else → render hint text as before.

**`RequiredBadge` styling:**
- `paddingHorizontal: 8`, `paddingVertical: 3`, `borderRadius: 999`.
- `backgroundColor`: `T.brand` at 12% alpha — use `rgba(196,58,16,0.12)` directly (T.brand is `#C43A10`).
- Text: `fontFamily: Inter_700Bold`, `fontSize: 10`, `letterSpacing: 1.2`, `color: T.brand`, `textTransform: 'uppercase'`, label `REQUIRED`.

**Hint logic simplification:** Size section no longer needs the `"Pick one" / "Only option"` hint — it always shows REQUIRED. Other sections: hint only shown when not required.

---

## §5 BESTSELLER eyebrow pill

**New file:** `components/menu/bestsellers.ts`
```ts
const BESTSELLER_NAMES = new Set([
  'Brown Sugar Milk Tea',
  'Mango Slushy',
  'Oreo Brulee Milk Tea',
  'Lychee Black Tea',
  'Red Dragon Fruit Slushy',
  'Taro Milk Tea',
])

export function isBestseller(name: string | undefined): boolean {
  if (!name) return false
  return BESTSELLER_NAMES.has(name)
}
```

**Render in ItemDetailContent:**
- Above the title row. `marginBottom: 8`.
- Conditional: `{isBestseller(item.itemData?.name) && <BestsellerPill />}`.
- Component layout: `alignSelf: flex-start`, `paddingHorizontal: 10`, `paddingVertical: 4`, `borderRadius: 999`, `backgroundColor: T.star` (gold).
- Text: `fontFamily: Inter_700Bold`, `fontSize: 10`, `letterSpacing: 1.4`, `color: T.ink` (dark on gold works — verify with token), `textTransform: 'uppercase'`, content `BESTSELLER`.

`T.star` is the warm gold `#F2B64A` — dark `T.ink` text reads cleanly against it.

---

## §6 Headline base price

**Title row becomes `flex-row space-between`:**
```
<View style={styles.titleRow}>
  <Text style={[TYPE.screenTitleLg, styles.titleText]} numberOfLines={2}>
    {item.itemData?.name}
  </Text>
  {baselineAmount > 0 ? (
    <Text style={styles.headlinePrice}>{formatPrice(baselineAmount)}</Text>
  ) : null}
</View>
```

**Styles:**
- `titleRow`: `flexDirection: row`, `alignItems: flex-start`, `justifyContent: space-between`, `gap: 12`.
- `titleText`: `flex: 1` so name wraps properly when long.
- `headlinePrice`: `fontFamily: Fraunces_500Medium`, `fontSize: 22`, `color: T.ink`, `marginTop: 6` (optical align with first line of title since Fraunces capitals sit slightly lower).

**The CTA price continues to show `total × quantity` (not baseline) — headline is the static reference price, CTA is the live order total.**

---

## Out of scope (explicit)

- Cart store API changes (`addItem` already dedupes by `lineId`).
- Menu tab changes (Phase 3 already shipped).
- Bestseller flagging via Square catalog metadata.
- Multi-quantity animations (plus/check stays as-is — no count badge on CTA beyond the price multiplier).
- Translations/localization.

---

## Smoke-test checklist (post-implementation)

1. **Brown Sugar Milk Tea** (bestseller, 2+ variations, has Toppings):
   - BESTSELLER pill above name.
   - Headline base price right of name.
   - Size chips show `−A$0.50` / blank / `+A$0.80` (or actual deltas).
   - Sugar/Ice sections show REQUIRED pill where `minSelected >= 1`.
   - Toppings render as checkbox rows with deltas; exclusive Cheese Cream/Brulee still mutually exclusive; third topping disables remaining.
   - Stepper: `−` disabled at 1; tapping `+` three times shows 4 in cart after Add.
2. **Item with only one variation**: Size chip still shown (single chip, no suffix), REQUIRED pill still shown, stepper still works.
3. **Item not in bestseller list**: no BESTSELLER pill, title row otherwise identical.
4. **Item with price 0 / missing variation price**: headline price hidden, CTA shows "Add to cart A$0.00" — no crash.
5. **Loading/error skeleton**: untouched by this change — still renders.
