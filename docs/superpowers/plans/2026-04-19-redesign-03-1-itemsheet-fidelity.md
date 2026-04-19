# Phase 3.1 — ItemSheet design fidelity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six targeted changes to `components/menu/ItemDetailContent.tsx` (plus one tiny new helper file) so the Phase 3 ItemSheet matches the approved Figma reference: quantity stepper, Toppings checkbox rows, Size price deltas, REQUIRED badge, BESTSELLER pill, headline base price.

**Architecture:** All UI logic lives inside the existing `ItemDetailContent` function component. Bestseller name detection is extracted to a sibling helper file so the same list can be reused later (e.g. Menu screen) without circular imports. No changes to cart store API, API routes, or Square types — quantity ships by calling the existing `addItem` dedupe-by-`lineId` path N times.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, `@/constants/theme` tokens, zustand cart store (`@/store/cart`), `expo-haptics`, brand `<Icon>` + `<CupArt>` components.

**Testing approach:** This repo does not run unit tests for sheet components (Phase 3 also shipped without them). Verification is:
1. `npx tsc --noEmit` passes.
2. Manual smoke test via Metro + iOS simulator following the spec's §Smoke-test checklist.

Each task commits independently so Phase 3d Supabase Auth WIP stays untouched — stage files by name, never `git add -A`.

**WIP files that must stay uncommitted throughout:**
- Modified: `app/(tabs)/account.tsx`, `app/_layout.tsx`, `components/auth/AuthProvider.tsx`, `ios/Podfile.lock`, `ios/mandysbubbleteaapp.xcodeproj/project.pbxproj`, `ios/mandysbubbleteaapp/Info.plist`, `ios/mandysbubbleteaapp/PrivacyInfo.xcprivacy`, `ios/mandysbubbleteaapp/mandysbubbleteaapp.entitlements`
- Untracked: `app/login.tsx`, `assets/images/login-banner.webp`, `components/auth/AuthGate.tsx`, `components/legal/`, `lib/legal.ts`

---

## File Structure

**New:**
- `components/menu/bestsellers.ts` — hardcoded bestseller name set + `isBestseller(name)` helper.

**Modified:**
- `components/menu/ItemDetailContent.tsx` — all six UI changes land here.

No other files touched.

---

## Task 1: Add bestsellers helper

**Files:**
- Create: `components/menu/bestsellers.ts`

- [ ] **Step 1: Create the helper file**

Create `components/menu/bestsellers.ts` with exactly:

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

The name list mirrors the Home carousel `SLIDES` in `components/home/HeroCarousel.tsx` (same six drinks). Keep string literals exact — name matching is case-sensitive.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/menu/bestsellers.ts
git commit -m "feat(phase3.1): add bestseller name helper"
```

Do not run `git add -A` or `git add .` — Phase 3d WIP must stay uncommitted.

---

## Task 2: Headline price + BESTSELLER pill in title row

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

**Context:** current title rendering is a single `<Text>` below hero. Design shows (top-to-bottom): BESTSELLER pill (conditional) → title row with name left / price right.

- [ ] **Step 1: Add imports**

Near the top of `components/menu/ItemDetailContent.tsx`, add to the existing imports:

```ts
import { isBestseller } from '@/components/menu/bestsellers'
```

- [ ] **Step 2: Compute baseline variation**

Inside `ItemDetailContent`, after `const variations = item.itemData?.variations ?? []` (search for that exact line — it's in the render body after the loading/error returns), add:

```ts
const baselineVariation =
  variations.find(
    (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
  ) ?? variations[0] ?? null
const baselineAmount = Number(
  baselineVariation?.itemVariationData?.priceMoney?.amount ?? 0,
)
```

This is a plain local (not memoized) — the render body already re-runs cheaply; `variations.find` over a handful of sizes is free.

- [ ] **Step 3: Replace the title markup**

Find the block (currently around the `<View style={styles.content}>` children start):

```tsx
<Text style={[TYPE.screenTitleLg, { color: T.ink }]}>
  {item.itemData?.name}
</Text>
```

Replace with:

```tsx
{isBestseller(item.itemData?.name) ? (
  <View style={styles.bestsellerPill}>
    <Text style={styles.bestsellerText}>BESTSELLER</Text>
  </View>
) : null}
<View style={styles.titleRow}>
  <Text style={[TYPE.screenTitleLg, styles.titleText, { color: T.ink }]} numberOfLines={2}>
    {item.itemData?.name}
  </Text>
  {baselineAmount > 0 ? (
    <Text style={styles.headlinePrice}>{formatPrice(baselineAmount)}</Text>
  ) : null}
</View>
```

- [ ] **Step 4: Add the new styles**

Append these entries inside the existing `StyleSheet.create({ ... })` block (before the closing `})`):

```ts
bestsellerPill: {
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: T.star,
  marginBottom: 8,
},
bestsellerText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
  letterSpacing: 1.4,
  color: T.ink,
  textTransform: 'uppercase',
},
titleRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
},
titleText: { flex: 1 },
headlinePrice: {
  fontFamily: 'Fraunces_500Medium',
  fontSize: 22,
  color: T.ink,
  marginTop: 6,
},
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If "Property 'star' does not exist" appears, re-check — `T.star` is `#F2B64A` in `constants/theme.ts` (verified pre-plan).

- [ ] **Step 6: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat(phase3.1): headline base price + bestseller pill in title row"
```

---

## Task 3: Size chips show price deltas

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

**Context:** Currently every Size chip shows `+A$7.80` (absolute price) as its suffix — spec wants the suffix relative to baseline, with negative / empty / positive forms.

- [ ] **Step 1: Change default selected variation to baseline**

Find the block in the initial load `useEffect`:

```ts
if (data.item.itemData?.variations?.length) {
  setSelectedVariation(data.item.itemData.variations[0])
}
```

Replace with:

```ts
const vars = data.item.itemData?.variations ?? []
if (vars.length) {
  const baseline =
    vars.find(
      (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
    ) ?? vars[0]
  setSelectedVariation(baseline)
}
```

This keeps the behavior identical when no "Regular" variation exists (falls back to the first, matching previous code).

- [ ] **Step 2: Replace the Size chip `priceSuffix` computation**

Find the Size `ModifierSection` rendering block:

```tsx
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
```

Replace with:

```tsx
{variations.map((v) => {
  const selected = v.id === selectedVariation?.id
  const priceAmt = Number(v.itemVariationData?.priceMoney?.amount ?? 0)
  const delta = priceAmt - baselineAmount
  const priceSuffix =
    delta === 0
      ? null
      : delta < 0
        ? `−${formatPrice(Math.abs(delta))}`
        : `+${formatPrice(delta)}`
  return (
    <Chip
      key={v.id}
      label={v.itemVariationData?.name ?? 'Regular'}
      priceSuffix={priceSuffix}
      selected={selected}
      disabled={false}
      onPress={() => setSelectedVariation(v)}
    />
  )
})}
```

**Important:** the negative branch uses `−` (U+2212, Unicode MINUS), not `-` (hyphen-minus). Copy the character from this plan exactly; do not retype.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. `baselineAmount` was added in Task 2 Step 2 — it must be visible from this scope. If TS complains that it's not defined, confirm Task 2 was committed first.

- [ ] **Step 4: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat(phase3.1): size chips show deltas from baseline variation"
```

---

## Task 4: REQUIRED badge replaces hint for required sections

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

**Context:** `ModifierSection` currently always shows a hint text (`Pick one`, `Pick up to 3`, etc). Design shows a REQUIRED pill instead for sections where the user must pick at least one — including the always-required Size section.

- [ ] **Step 1: Extend `ModifierSection` props**

Find the `ModifierSection` definition:

```tsx
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
```

Replace with:

```tsx
function ModifierSection({
  eyebrow,
  title,
  hint,
  required,
  children,
}: {
  eyebrow: string
  title: string
  hint: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ gap: 2 }}>
          <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{eyebrow}</Text>
          <Text style={[TYPE.cardTitle, { color: T.ink }]}>{title}</Text>
        </View>
        {required ? (
          <View style={styles.requiredPill}>
            <Text style={styles.requiredPillText}>REQUIRED</Text>
          </View>
        ) : (
          <Text style={styles.sectionHint}>{hint}</Text>
        )}
      </View>
      <View style={styles.chipRow}>{children}</View>
    </View>
  )
}
```

- [ ] **Step 2: Add the new styles**

Append to `StyleSheet.create({ ... })`:

```ts
requiredPill: {
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: 'rgba(196,58,16,0.12)',
},
requiredPillText: {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
  letterSpacing: 1.2,
  color: T.brand,
  textTransform: 'uppercase',
},
```

*(T.brand is `#C43A10` — the rgba value is the same hex at 12% alpha.)*

- [ ] **Step 3: Wire the `required` prop on the Size section**

Find the `<ModifierSection eyebrow="SIZE" ...>` call in the render body. Add `required` prop:

```tsx
<ModifierSection
  eyebrow="SIZE"
  title="Choose size"
  hint={variations.length > 1 ? 'Pick one' : 'Only option'}
  required
>
```

- [ ] **Step 4: Wire the `required` prop on modifier lists**

Find the `modifierLists.map((ml) => { ... })` block that renders non-Size modifier sections. The `<ModifierSection>` inside currently looks like:

```tsx
<ModifierSection
  key={ml.id}
  eyebrow={eyebrowForList(ml.name)}
  title={titleForList(ml.name)}
  hint={describeSelection(ml)}
>
```

Add `required`:

```tsx
<ModifierSection
  key={ml.id}
  eyebrow={eyebrowForList(ml.name)}
  title={titleForList(ml.name)}
  hint={describeSelection(ml)}
  required={ml.minSelected >= 1}
>
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat(phase3.1): add REQUIRED badge on required modifier sections"
```

---

## Task 5: Toppings as full-width checkbox rows

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

**Context:** Currently Toppings render as pill chips (same as Sugar/Ice). Design wants them as full-width rows with a checkbox on the left. Other lists (Sugar, Ice) must remain as pill chips.

- [ ] **Step 1: Add a `ToppingSection` component**

Add this component *next to* `ModifierSection` in the file (below it is fine — file ordering doesn't matter since both are used in the same render tree):

```tsx
function ToppingSection({
  eyebrow,
  title,
  hint,
  required,
  children,
}: {
  eyebrow: string
  title: string
  hint: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ gap: 2 }}>
          <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{eyebrow}</Text>
          <Text style={[TYPE.cardTitle, { color: T.ink }]}>{title}</Text>
        </View>
        {required ? (
          <View style={styles.requiredPill}>
            <Text style={styles.requiredPillText}>REQUIRED</Text>
          </View>
        ) : (
          <Text style={styles.sectionHint}>{hint}</Text>
        )}
      </View>
      <View style={styles.toppingList}>{children}</View>
    </View>
  )
}
```

- [ ] **Step 2: Add a `ToppingRow` component**

Add below `Chip`:

```tsx
function ToppingRow({
  label,
  priceCents,
  selected,
  disabled,
  onPress,
}: {
  label: string
  priceCents: number
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled && !selected}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: disabled && !selected }}
      style={({ pressed }) => [
        styles.toppingRow,
        disabled && !selected && { opacity: 0.45 },
        pressed && !(disabled && !selected) && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected ? <Icon name="check" size={14} color="#fff" /> : null}
      </View>
      <Text style={styles.toppingLabel}>{label}</Text>
      {priceCents > 0 ? (
        <Text style={styles.toppingPrice}>+{formatPrice(priceCents)}</Text>
      ) : null}
    </Pressable>
  )
}
```

- [ ] **Step 3: Add the row styles**

Append to `StyleSheet.create({ ... })`:

```ts
toppingList: {
  marginTop: 10,
  borderTopWidth: 1,
  borderTopColor: T.line,
},
toppingRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  gap: 12,
  borderBottomWidth: 1,
  borderBottomColor: T.line,
},
checkbox: {
  width: 22,
  height: 22,
  borderRadius: 6,
  borderWidth: 1.5,
  borderColor: T.line,
  backgroundColor: T.paper,
  alignItems: 'center',
  justifyContent: 'center',
},
checkboxChecked: {
  borderColor: T.brand,
  backgroundColor: T.brand,
},
toppingLabel: {
  flex: 1,
  fontFamily: 'Inter_500Medium',
  fontSize: 15,
  color: T.ink,
},
toppingPrice: {
  fontFamily: 'Inter_500Medium',
  fontSize: 13,
  color: T.ink3,
},
```

- [ ] **Step 4: Branch the render between chip and row sections**

Find the `modifierLists.map((ml) => { ... })` block (Task 4 Step 4 location). Currently it only renders `<ModifierSection>` with chips. Replace the body inside the `.map` callback so Topping lists get the new row treatment:

```tsx
{modifierLists.map((ml) => {
  const selected = selectedByList[ml.id] ?? new Set()
  const isTopping = (ml.name ?? '').toUpperCase().includes('TOPPING')
  if (isTopping) {
    return (
      <ToppingSection
        key={ml.id}
        eyebrow={eyebrowForList(ml.name)}
        title={titleForList(ml.name)}
        hint={describeSelection(ml)}
        required={ml.minSelected >= 1}
      >
        {ml.modifiers.map((mod) => {
          const isSelected = selected.has(mod.id)
          const isDisabled = isModifierDisabled(ml, mod.id)
          return (
            <ToppingRow
              key={mod.id}
              label={mod.name}
              priceCents={Number(mod.priceCents ?? 0)}
              selected={isSelected}
              disabled={isDisabled}
              onPress={() => toggleModifier(ml, mod.id)}
            />
          )
        })}
      </ToppingSection>
    )
  }
  return (
    <ModifierSection
      key={ml.id}
      eyebrow={eyebrowForList(ml.name)}
      title={titleForList(ml.name)}
      hint={describeSelection(ml)}
      required={ml.minSelected >= 1}
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
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat(phase3.1): render toppings as checkbox rows"
```

---

## Task 6: Quantity stepper left of CTA

**Files:**
- Modify: `components/menu/ItemDetailContent.tsx`

**Context:** `ctaBar` currently contains a single full-width `<Pressable>` styled as `cta`. Spec wants a stepper pill left (`[− N +]`) and CTA right with the total adjusted for quantity.

- [ ] **Step 1: Add quantity state**

Inside `ItemDetailContent`, add next to the other `useState` hooks near the top of the component:

```ts
const [quantity, setQuantity] = useState(1)
```

- [ ] **Step 2: Update `handleAddToCart` to loop N times and reset quantity**

Find `handleAddToCart`. Replace its body with:

```ts
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
  for (let i = 0; i < quantity; i++) {
    addItem({
      id: item.id,
      variationId: selectedVariation.id,
      name: item.itemData?.name ?? 'Unknown',
      price: basePrice + modifierTotal,
      imageUrl: item.imageUrl,
      variationName: selectedVariation.itemVariationData?.name,
      modifiers: chosenModifiers,
    })
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  setAdded(true)
  setQuantity(1)
  if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
  addedTimerRef.current = setTimeout(() => setAdded(false), 1500)
}
```

The only changes: `for` loop around `addItem` and `setQuantity(1)` after `setAdded(true)`.

- [ ] **Step 3: Replace the CTA bar JSX**

Find the block:

```tsx
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
```

Replace with:

```tsx
<View style={[styles.ctaBar, { paddingBottom: 12 + insets.bottom }]}>
  <View style={styles.stepper}>
    <Pressable
      onPress={() => {
        if (quantity <= 1) return
        Haptics.selectionAsync()
        setQuantity((q) => Math.max(1, q - 1))
      }}
      disabled={quantity <= 1}
      accessibilityRole="button"
      accessibilityLabel="Decrease quantity"
      accessibilityState={{ disabled: quantity <= 1 }}
      style={({ pressed }) => [
        styles.stepperBtn,
        quantity <= 1 && { opacity: 0.4 },
        pressed && quantity > 1 && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.stepperMinus}>−</Text>
    </Pressable>
    <Text
      style={styles.stepperCount}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Quantity ${quantity}`}
    >
      {quantity}
    </Text>
    <Pressable
      onPress={() => {
        if (quantity >= 99) return
        Haptics.selectionAsync()
        setQuantity((q) => Math.min(99, q + 1))
      }}
      disabled={quantity >= 99}
      accessibilityRole="button"
      accessibilityLabel="Increase quantity"
      accessibilityState={{ disabled: quantity >= 99 }}
      style={({ pressed }) => [
        styles.stepperBtn,
        quantity >= 99 && { opacity: 0.4 },
        pressed && quantity < 99 && { opacity: 0.5 },
      ]}
    >
      <Icon name="plus" size={18} color={T.ink} />
    </Pressable>
  </View>
  <Pressable
    onPress={handleAddToCart}
    disabled={addDisabled}
    style={({ pressed }) => [
      styles.cta,
      styles.ctaFlex,
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
          <Text style={styles.ctaRight}>{formatPrice(totalCents * quantity)}</Text>
        ) : null}
      </>
    )}
  </Pressable>
</View>
```

The minus button uses a `<Text>` with `−` (U+2212). Copy the character exactly; do not retype.

- [ ] **Step 4: Add stepper styles + make the CTA bar a flex row**

Find the existing `ctaBar` and `cta` style entries. **Replace** `ctaBar` with a flex-row version, then append the new stepper styles.

Replace this:

```ts
ctaBar: {
  paddingHorizontal: 16,
  paddingTop: 12,
  backgroundColor: T.paper,
  borderTopWidth: 1,
  borderTopColor: T.line,
},
```

With:

```ts
ctaBar: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingHorizontal: 16,
  paddingTop: 12,
  backgroundColor: T.paper,
  borderTopWidth: 1,
  borderTopColor: T.line,
},
```

Append these additional entries:

```ts
stepper: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 6,
  paddingVertical: 4,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: T.line,
  backgroundColor: T.paper,
},
stepperBtn: {
  width: 40,
  height: 40,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
},
stepperMinus: {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 22,
  lineHeight: 22,
  color: T.ink,
},
stepperCount: {
  minWidth: 24,
  textAlign: 'center',
  fontFamily: 'Inter_600SemiBold',
  fontSize: 16,
  color: T.ink,
},
ctaFlex: { flex: 1 },
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If "Property 'selectionAsync' does not exist" appears, the `Haptics` import at the top of the file should already include it (the existing `notificationAsync` import brings in the whole module).

- [ ] **Step 6: Commit**

```bash
git add components/menu/ItemDetailContent.tsx
git commit -m "feat(phase3.1): quantity stepper left of add-to-cart CTA"
```

---

## Task 7: Verification pass

**Files:**
- None (verification + DEV_QUEUE update).

- [ ] **Step 1: Typecheck final state**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: ESLint**

Run: `npx eslint 'components/menu/ItemDetailContent.tsx' 'components/menu/bestsellers.ts'`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Confirm WIP untouched**

Run: `git status --short`
Expected: `app/(tabs)/account.tsx`, `app/_layout.tsx`, auth/legal files, and iOS project files remain in modified/untracked state exactly as listed in the plan preamble. No Phase 3.1 commit should have staged any of them.

Also run: `git log --name-only --pretty=format:'%h %s' HEAD~6..HEAD`
Expected: only `components/menu/ItemDetailContent.tsx` and `components/menu/bestsellers.ts` appear in commit bodies (6 commits since the Task 1 commit).

- [ ] **Step 4: Smoke-test checklist**

Open `docs/superpowers/specs/2026-04-19-redesign-03-1-itemsheet-fidelity.md` §Smoke-test checklist. Execute each of the 5 cases against Metro + iOS simulator:

1. Brown Sugar Milk Tea — BESTSELLER pill, headline price, Size deltas, REQUIRED on Size/Sugar/Ice, Toppings as rows, exclusive Cheese Cream/Brulee, third topping disables rest, stepper bumps add count.
2. Single-variation item — no Size delta suffix, REQUIRED still shown, stepper still works.
3. Non-bestseller item — no BESTSELLER pill.
4. Zero-price item — no headline price, CTA shows `Add to cart A$0.00`.
5. Loading skeleton still renders.

Report which pass/fail. Fix any failures inline (amend the relevant task commit if a single-file fix; otherwise add a fixup commit).

---

## Self-review checklist (already run)

- ✅ All six spec divergences mapped to at least one task.
- ✅ No placeholders — every step shows the actual code to write.
- ✅ Type consistency — `baselineAmount`, `quantity`, `isBestseller`, `required`, `ToppingSection`, `ToppingRow` all declared before used.
- ✅ `git add` is always file-specific; no `-A` or `.` to protect Phase 3d WIP.
- ✅ Minus-sign character `−` called out as U+2212 in every place it appears (Size delta label, stepper minus glyph).
