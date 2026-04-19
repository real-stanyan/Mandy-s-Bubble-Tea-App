# Redesign Phase 2 — Home (Vertical Slice)

Date: 2026-04-19
Parent: `2026-04-19-redesign-umbrella.md`
Depends on: `2026-04-19-redesign-01-foundation.md`
Reference: `/Users/stanyan/Downloads/design_handoff_mandys_bubble_tea/reference/src/HomeScreen.jsx`

## Goal

Rebuild the Home screen to the design handoff. Home is the vertical-slice validator for the token + font system shipped in Phase 1: every new widget consumes `T` / `TYPE` / `FONT` / `SHADOW` / `RADIUS` exclusively, with zero new `BRAND` imports. No backend changes; all data comes from existing hooks (`useAuth`, `useCart`, `useOrdersStore`, `useMenu`).

## Scope — 8 sections (all from reference)

Home composes, top-to-bottom:

1. **HomeHeader** — greeting variant (time-of-day copy + first name), right-side bell (inert) and bag (routes to cart), second-row Southport status pill
2. **HomeLoyaltyHero** — brand-gradient card, 9-cup progress variant, "Member" chip, tap routes to `/promotions`
3. **YourUsual** — single highest-frequency past-order card with one-tap re-add
4. **DailySpecial** — welcome-discount peach card, auto-hides when not eligible
5. **CategoriesStrip** — 7 hardcoded colored tiles with real item counts
6. **HotPicks** — existing peek carousel, restyled with T tokens and new section head
7. **StoreCard** — stylized sage map thumbnail + Southport address + Directions button
8. **MiniCartBar** — existing, unchanged visually (Phase 4 will replace)

### First task: delete `/dev/theme-showcase`

The dev route `app/dev/theme-showcase.tsx` added in Phase 1 is removed as Task 1 of this phase, per Phase 1's exit contract. The `Safari deep link` test path is retired too; no other file references the route.

## Deliverables

### 1. `components/home/SectionHead.tsx` (new, internal utility)

```tsx
type Props = {
  label: string;
  eyebrow?: string;       // small uppercase chip above label
  count?: string;         // right-side muted count, e.g. "ordered 14×"
  actionLabel?: string;   // right-side action text, e.g. "See all"
  onAction?: () => void;
};
```

Layout: optional `eyebrow` row (TYPE.eyebrow, T.brand), main row with `label` (TYPE.screenTitleSm, T.ink) on the left and either `count` (TYPE.body, T.ink3) or `actionLabel` + right-chevron (TYPE.bodyStrong, T.brand, tappable) on the right. Horizontal padding 20. Used by YourUsual / Categories / HotPicks.

### 2. `components/home/HomeHeader.tsx` (new)

```tsx
type Props = {};
```

Reads `useAuth().profile` for first name, computes greeting by `new Date().getHours()` (12 / 17 thresholds). Reads `useCart().items.length` for bag badge.

Layout:
- Row 1 — `{greeting},` (TYPE.body, T.ink3) above `{firstName || 'Mandy'}.` (Fraunces_500Medium 30 / 1.1 / letterSpacing -0.8, T.ink). Right: two 40×40 RADIUS.pill buttons with `rgba(42,30,20,0.05)` fill:
  - bell — renders `<Icon name="bell" color={T.ink} size={20} />` + 7×7 peach dot top-right (border 1.5px T.paper). `onPress` is a no-op (notifications out of scope).
  - bag — renders `<Icon name="bag" color={T.ink} size={20} />`. When `cartCount > 0` shows a 16×16 RADIUS.pill peach-ink badge with count (JetBrainsMono_700Bold 10 / `#fff`). `onPress` → `router.push('/(tabs)/cart')`.
- Row 2 — store pill (`display: flex; self-start`): bg `rgba(162,173,145,0.25)`, padding `4px 10px 4px 8px`, RADIUS.pill. Contents: `<Icon name="pin" color={T.brand} size={10} />` + `Southport · 34 Davenport St` (TYPE.body 11.5, T.ink2) + separator `·` (T.ink3) + hours status (TYPE.bodyStrong 11.5). Hours status is built from `getStoreStatus()` (see §9): when `open`, render `Open {nextLabel}` in T.greenDark (e.g. `Open until 9pm`); when closed, render `Opens {nextLabel}` in T.ink3 (e.g. `Opens 9am tomorrow`).

Signed-out fallback: greeting "Hi there," / name "Welcome." (Fraunces 30, same style). Store pill is identical (Southport info is not user-specific).

Outer padding: `6px 20px 14px`.

### 3. `components/home/HomeLoyaltyHero.tsx` (new)

```tsx
type Props = {};
```

Reads `useAuth().loyalty`, `useAuth().starsPerReward`, `useAuth().profile`. Renders nothing when `!profile` (signed out).

Treat `balance = loyalty?.balance ?? 0`, `goal = starsPerReward ?? 9`, `toGo = Math.max(0, goal - balance)`, `reached = balance >= goal`.

Visual:
- Outer: horizontal padding 16, marginBottom 20.
- Card: RADIUS.card 24, padding 22, gradient `linear-gradient(155deg, T.brand 0%, T.brandDark 100%)`, SHADOW.miniCart (shadowColor T.brandDark). Implemented with `expo-linear-gradient` on both iOS and Android (verify in Task 0 the package is in `package.json`; `npx expo install expo-linear-gradient` if missing).
- Subtle stripes overlay: 45°, repeating-linear-gradient `#fff 0 1px / transparent 1px 8px`, opacity 0.08.
- Top row (flex space-between, alignItems flex-start):
  - Left: eyebrow "MANDY'S REWARDS" (TYPE.eyebrow, rgba(255,255,255,0.7)) preceded by 6×6 peach dot. Below: big count — Fraunces 36 / lineHeight 1 / letterSpacing -0.8. `balance` is weight 600; ` / {goal} stars` is Fraunces 24 rgba(255,255,255,0.45).
  - Right: "★ Member" chip, padding `6px 10px`, RADIUS.pill, bg `rgba(255,255,255,0.15)`, TYPE.bodyStrong 11 white, star icon peach 12.
- 9-cup progress grid (`<CupProgressRow value={balance} total={goal} />`): marginTop 22, `display: grid; gridTemplateColumns: repeat(9, 1fr); gap: 6; alignItems: end`. Each cell is a 22×28 SVG: lid rect (2,5,18,2.6 rx=1) + body path (trapezoid with 4-unit radius inside). Filled cells use `T.peach` for lid and body fill with `#fff` 1.2 stroke; unfilled cells have `fill: none`, white stroke, and are `translateY(2px) opacity(0.35)`. CSS transition: `all 200ms ease`. **CupProgressRow lives inline inside `HomeLoyaltyHero.tsx`** as a private sub-component (not exported — not reused by Account phase, which owns its own variant).
- Bottom row (marginTop 18, flex space-between):
  - Left: "{toGo} stars until a free drink" (TYPE.body, rgba(255,255,255,0.85)) with `toGo` bolded; when `reached`, replace with "🎉 Free drink ready to redeem".
  - Right: CTA chip, padding `7px 12px`, RADIUS.pill, bg `rgba(255,255,255,0.18)` normal / `T.peach` when reached. Label "View" or "Redeem" + arrow icon 12 (white / T.brandDark).

Whole card is a Pressable. `onPress` → `router.push('/promotions')`. Scale-press feedback via `react-native-reanimated` — `scale: pressed ? 0.985 : 1`, 160ms.

### 4. `components/home/YourUsual.tsx` (new)

```tsx
type Props = {};
```

Reads `useOrdersStore().orders`, `useCart().addItem`. Computes `usual` via pure helper `computeYourUsual(orders)` (see §9). Renders nothing when `orders.length === 0` or when helper returns `null` (e.g., all orders had empty `lineItems`).

Layout:
- Outer: horizontal padding 16, marginBottom 20.
- `<SectionHead label="Your usual" count={`ordered ${count}×`} />`.
- Card: bg T.card, RADIUS.card 20, padding 12, border 1px T.line, SHADOW.card. Inside flex row gap 12 align-items-center:
  - Thumbnail 72×72, RADIUS.tile 14. If `usual.imageUrl` exists use `<Image source={{ uri }} contentFit="cover" />`. Otherwise T.sage bg + diagonal stripes overlay `rgba(255,255,255,0.08) 0 10px / transparent 10px 20px` + centered `<CupArt fill={T.brand} stroke={T.ink} size={48} />`.
  - Middle (flex 1, minWidth 0):
    - Name — Fraunces 18 / weight 500 / letterSpacing -0.3 / lineHeight 1.15 / T.ink.
    - Modifier summary — TYPE.body 12.5 T.ink3, format `{size} · {sugar} · {ice}{toppings.length ? ' · ' + toppings.join(', ').toLowerCase() : ''}`. If a group is empty, skip it.
    - Price — JetBrainsMono_700Bold 13, T.ink2, prefix `A$`.
  - Right: 44×44 RADIUS.pill button bg T.brand. Default shows Icon.plus white 18. Tap fires `cart.addItem(usual)` then flips to Icon.check 16 for 900ms (local `adding` state via `useState` + `setTimeout`). Shadow `0 6px 14px -4px rgba(141,85,36,0.5)` (iOS) / elevation 3 (Android). Transform `scale(0.92)` during `adding`, transition 150ms.

### 5. `components/home/DailySpecial.tsx` (new)

```tsx
type Props = {};
```

Reads `useAuth().welcomeDiscount`, `useAuth().profile`. Renders nothing when `!profile` (signed out — the existing Account-tab sign-in flow is the acquisition channel) or when `!welcomeDiscount?.available` (already consumed / not eligible).

Compute `drinksRemaining = welcomeDiscount.drinksRemaining ?? 2` and `pct = welcomeDiscount.percentage ?? 30`.

Layout:
- Outer: horizontal padding 16, marginBottom 20.
- Card: RADIUS.card 24, overflow hidden, `linear-gradient(160deg, T.peach 0%, #FFCFA3 60%, T.cream 100%)`, border 1px `rgba(141,85,36,0.12)`, padding 22, minHeight 180, flex row.
- Left (flex 1, column, space-between, paddingRight 6):
  - Chip "NEW MEMBER OFFER" — inline-block, padding `3px 9px`, RADIUS.small 4, bg T.ink, color T.cream, TYPE.eyebrow 10 / letterSpacing 1.3.
  - Headline — Fraunces 24 / weight 400 / lineHeight 1.05 / letterSpacing -0.5 / T.ink, marginTop 10. Content: `First ${drinksRemaining} `  + `<Text italic weight 500>milk teas</Text>` + `\n— ${pct}% off`.
  - Subcopy — TYPE.body 12.5 T.ink2 lineHeight 1.4 maxWidth 180. "Welcome gift for new members. Auto-applied at checkout."
  - CTA pill — align-self flex-start, marginTop 14, padding `8px 14px`, RADIUS.pill, bg T.ink, color T.cream, TYPE.bodyStrong 13 + arrow icon 12 T.cream.
- Right (width 130, shrink 0, align-items flex-end):
  - Dashed circle decoration — absolute right -30 top -20, 150×150, border 2px dashed `rgba(42,30,20,0.18)`, RADIUS.pill.
  - `<CupArt fill="#FFC875" stroke={T.ink} size={100} />` rotated -4°, translateY 6, filter `drop-shadow(0 8px 16px rgba(107,62,21,0.3))` (iOS `shadow*`, Android `elevation: 4`).

Whole card Pressable. `onPress` → `router.push('/(tabs)/menu')`.

### 6. `components/home/CategoriesStrip.tsx` (new)

```tsx
type Props = {};
```

Reads `useMenu()` — returns `{items, categories, loading}`. Computes per-category counts by filtering `items` whose `itemData?.categories?.some(c => c.id === cat.id)`.

Hardcoded palette `HOME_CATEGORIES` in same file:
```ts
const HOME_CATEGORIES = [
  { slug: 'milky',            label: 'Milky',            color: '#F5E1C5', swatch: '#D9A066' },
  { slug: 'fruity',           label: 'Fruity',           color: '#FCE1C9', swatch: '#F27D45' },
  { slug: 'fruity-black-tea', label: 'Fruity Black Tea', color: '#EFDACB', swatch: '#8C5635' },
  { slug: 'fresh-brew',       label: 'Fresh Brew',       color: '#E8DAC6', swatch: '#6B3E15' },
  { slug: 'frozen',           label: 'Frozen',           color: '#D8E4E8', swatch: '#6EA3B0' },
  { slug: 'cheese-cream',     label: 'Cheese Cream',     color: '#FFF1D6', swatch: '#E8B44E' },
  { slug: 'special-mix',      label: 'Special Mix',      color: '#E6DDEB', swatch: '#8B6AA8' },
] as const;
```

Match `slug` against category name via `normalizeSlug(name) === cat.slug` (lowercase + replace spaces → `-`, strip non-alphanumeric except hyphen). When `categories` from `useMenu()` hasn't resolved a given slug, skip that tile (tiles always have a matching Square category in practice — all 7 slugs map to real categories; but tolerate a missing match by rendering the tile with count "—").

Layout:
- `<SectionHead label="Browse the menu" actionLabel="See all" onAction={...} />`, then horizontal ScrollView paddingLeft 20 paddingRight 14, gap 10, `snapToInterval={140}` (130 tile + 10 gap) `decelerationRate="fast"`, `showsHorizontalScrollIndicator={false}`.
- Each tile: 130×84, RADIUS.tile 16, bg `c.color`, padding 12, position relative, overflow hidden.
  - Absolute decoration: right -10 bottom -10, 50×50 RADIUS.pill, bg `c.swatch`, opacity 0.85.
  - Top: label (Fraunces 15 / weight 500 / lineHeight 1.1 / letterSpacing -0.2 / T.ink).
  - Bottom-left: `{count} drinks` (TYPE.eyebrow 10.5 T.ink3), 12px from bottom, 12px from left.
- Tap any tile → `router.push('/(tabs)/menu')`. **No category-anchored scroll** (Phase 3 Menu redesign is where `?category=` wiring lands).

### 7. `components/home/HotPicks.tsx` (re-skin of `HeroCarousel.tsx`)

**Approach A** — rename not required; edit `HeroCarousel.tsx` in place (file path unchanged, imports unchanged; only visual rewrite). New exported name stays `HeroCarousel` for import compatibility. `Home` imports it as `<HotPicks />` via a new export alias at the top: `export { HeroCarousel as HotPicks } from './HeroCarousel';` — the named import in Home is `import { HotPicks } from '@/components/home/HeroCarousel';` (file renaming deferred to Phase 7).

Visual diff from current:
- Remove `BRAND.color` / `BRAND.background` usages. Replace with `T.brand` / `T.bg` / `T.paper` / T.ink*.
- Section head: use new `<SectionHead label="This week's favourites" eyebrow="HOT PICKS" />` instead of the current two-line eyebrow + title block.
- Card background: photo stays (top_{1..6}.webp). Card RADIUS changes from current (check existing) to **22**. Shadow uses SHADOW.miniCart preset.
- `#N` rank chip: move from top-left, size unchanged. Bg `T.paper` (was brand color). Text color T.brand. Font JetBrainsMono_700Bold 10.5. Padding `4px 8px`. RADIUS.pill.
- Tagline (eyebrow): TYPE.eyebrow 10 `rgba(255,255,255,0.75)`.
- Product name: TYPE.cardTitle 17 white (Fraunces_500Medium / -0.3 / 1.15).
- Bottom gradient overlay for readability: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)` height ~60% of card.
- Dot indicators: active dot 22px wide T.brand, inactive 6px round T.ink4, gap 6. (Keep existing peek + snapToInterval behavior; just token swap.)

Tap any card → `router.push(/menu/${item.id})` (existing behavior).

### 8. `components/home/StoreCard.tsx` (new)

```tsx
type Props = {};
```

Reads `getStoreStatus()`. Hardcoded store info inline:
- Name: "Southport Store"
- Address: "34 Davenport St · Gold Coast · Southport"
- Map target: "34 Davenport St, Southport QLD 4215"

Layout:
- Outer: horizontal padding 16, marginBottom 32.
- Card: bg T.paper, RADIUS.card 20, padding 16, border 1px T.line, SHADOW.card. flex row gap 14 align-items-center.
- Left (76×76 RADIUS.tile 14, bg T.sage, overflow hidden, relative):
  - Grid pattern: two layered `linear-gradient(T.paper 1px, transparent 1px) 0 0 / 18px 18px` (horizontal) + `linear-gradient(90deg, T.paper 1px, transparent 1px) 0 0 / 18px 18px` (vertical), opacity 0.5. Implement via two absolute positioned Views with `repeating-linear-gradient` fallback — RN doesn't support CSS `linear-gradient` on `View`, so use `expo-linear-gradient` twice stacked, or simpler: draw 4 horizontal + 4 vertical `View` lines. **Implementation**: a 4×4 line grid (4 horizontal 1px T.paper lines at 18px intervals + 4 vertical) using 8 `<View>` siblings inside the container with opacity 0.5.
  - Pin marker: absolute left 50% top 50%, 14×14 teardrop — `borderRadius: '50% 50% 50% 0'` not supported in RN. Implement as `<View>` with `borderRadius: 7` (circle) translated + rotated -45°, border 2px `#fff`, bg T.brand. Accept visual drift from reference's CSS teardrop; still reads as a pin.
- Middle (flex 1, minWidth 0):
  - Status row — green dot 6×6 RADIUS.pill bg T.green + text `OPEN NOW` or `CLOSED` (TYPE.eyebrow 11 T.greenDark when open / T.ink3 when closed).
  - Store name — Fraunces 16 / weight 500 / letterSpacing -0.3 / T.ink.
  - Address line — TYPE.body 12 T.ink3 lineHeight 1.4.
- Right: `Directions` pill — padding `8px 14px`, RADIUS.pill, border 1px T.ink4, bg transparent, TYPE.bodyStrong 12.5 T.ink. `onPress` opens platform maps:
  - iOS: `Linking.openURL('http://maps.apple.com/?q=34%20Davenport%20St%20Southport%20QLD%204215')`
  - Android: `Linking.openURL('https://www.google.com/maps/search/?api=1&query=34+Davenport+St+Southport+QLD+4215')`

### 9. Helper utilities

Create `components/home/helpers.ts`:

```ts
// Compute the single highest-frequency past-order line item.
// Groups by `${name}::${variationId}::${sortedModIds.join(',')}`.
// Returns null when orders is empty or no group has count >= 1.
export type YourUsualItem = {
  key: string;
  name: string;
  variationId: string;
  modifiers: Array<{ id: string; name: string; listName?: string; priceCents?: number }>;
  size: string | undefined;     // derived from Size modifier listName
  subtitle: string;             // "Large · 50% Sugar · Less Ice · Pearls"
  priceCents: number;           // variation price + modifier priceCents sum
  imageUrl?: string;
  count: number;
};
export function computeYourUsual(orders: OrderSummary[]): YourUsualItem | null;

// Time-of-day + open-hours state (hardcoded weekly schedule).
export type StoreStatus = { open: boolean; nextLabel: string /* e.g. 'until 9pm' | '9am tomorrow' */ };
export function getStoreStatus(now?: Date): StoreStatus;

// Normalize a Square category name into a slug matchable against HOME_CATEGORIES.
// "Fruity Black Tea" -> "fruity-black-tea"
export function normalizeSlug(name: string): string;

// Time-of-day greeting
export function timeGreeting(now?: Date): 'Good morning' | 'Good afternoon' | 'Good evening';
```

- `computeYourUsual` iterates `orders[].lineItems[]` (ignoring orders with state CANCELED). Key sorts modifier ids alphabetically for deterministic grouping. `size` / `subtitle` read from modifier `listName` groupings (`Size` → take first; `Sugar` / `Ice` / `Topping` → preserve order, title-case values). `priceCents` is taken from the first occurrence (not averaged). `imageUrl` from `lineItems[i].imageUrl` if present. Ties in count → latest order wins.
- `getStoreStatus` uses `Australia/Brisbane` as a fixed reference (store timezone from `AGENTS.md`/`CLAUDE.md`). Hours M–Su 09:00–21:00. No holiday exceptions (YAGNI).

### 10. `app/(tabs)/index.tsx` — full rewrite

Remove `useWindowDimensions`, hero-banner image, banner fade, sign-in ImageBackground, all `BRAND` references, old `CARD_OVERLAP` constant. Keep `MiniCartBar` (unchanged). New composition:

```tsx
import { ScrollView, View } from 'react-native';
import { T } from '@/constants/theme';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeLoyaltyHero } from '@/components/home/HomeLoyaltyHero';
import { YourUsual } from '@/components/home/YourUsual';
import { DailySpecial } from '@/components/home/DailySpecial';
import { CategoriesStrip } from '@/components/home/CategoriesStrip';
import { HotPicks } from '@/components/home/HeroCarousel';
import { StoreCard } from '@/components/home/StoreCard';
import { MiniCartBar } from '@/components/cart/MiniCartBar';

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

No `ActivityIndicator` at root — individual widgets handle their own loading states (skeleton / null-return) so the shell renders immediately.

**SafeArea**: root `_layout.tsx` already provides `T.bg` root. Header's `padding: '6px 20px 14px'` is measured from the top of the ScrollView; on iOS the Stack screen for `(tabs)` has `headerShown: false`, and the natural `safeAreaInsets.top` bleeds into the ScrollView. We add `paddingTop: 8` to the `contentContainerStyle` (above). **No `SafeAreaView` wrapper** — the reference doesn't include a tab-bar top inset offset because the system status bar is handled by the `<StatusBar style="dark" />` in `_layout.tsx`.

### 11. Retire `WelcomeDiscountBanner`

`components/home/WelcomeDiscountBanner.tsx` is no longer imported. Leave the file on disk (strictly-additive principle; deletion is Phase 7 cleanup).

### 12. Delete dev showcase

`app/dev/theme-showcase.tsx` removed as the first task of this phase.

## Out of scope for this phase

- Any change to `components/account/LoyaltyCard.tsx` (Phase 6 owns Account redesign; the two hero variants will intentionally diverge until then).
- Any change to `app/(tabs)/menu.tsx`, `cart.tsx`, `order.tsx`, `account.tsx`.
- Any change to `components/auth/*`, `app/login.tsx`, `app/_layout.tsx`, `components/legal/*`, `lib/legal.ts` (Phase 3d Supabase Auth WIP remains untouched).
- Deleting `hero-banner.webp` / `hero-banner-signed-out.webp` assets — both remain on disk unreferenced, cleanup at Phase 7.
- Removing the `BRAND` const or migrating its usages outside `app/(tabs)/index.tsx`.
- Notifications (bell remains inert).
- Category deep-link from Home tile into Menu section (`/(tabs)/menu?category=`).
- Geolocation-based "km away" on StoreCard.
- Confetti animation on LoyaltyHero tap.
- Any change to welcome-discount backend behavior (Phase 2 only changes how it's surfaced).

## Validation

1. **Type check** — `npx tsc --noEmit` clean.
2. **Lint delta** — `npm run lint` adds zero new warnings over the Phase 1 baseline.
3. **Dev-showcase route gone** — `curl` / file-check confirms `app/dev/theme-showcase.tsx` no longer exists.
4. **Empty-state smoke tests** (signed-out on a fresh install):
   - HomeLoyaltyHero hidden.
   - YourUsual hidden.
   - DailySpecial hidden.
   - HomeHeader shows "Hi there, Welcome." + Southport pill.
   - Categories, HotPicks, StoreCard visible.
5. **Signed-in smoke tests** (account with 0 / 3 / 14 past orders, with / without welcome discount):
   - 0 orders → YourUsual hidden.
   - 3+ orders → YourUsual shows the correct highest-frequency item with accurate "ordered N×" count.
   - welcomeDiscount.available=true → DailySpecial shows "First {drinksRemaining} milk teas — 30% off".
   - welcomeDiscount.available=false → DailySpecial hidden.
   - Loyalty balance 0 → 9 cup tiles all outlined + "9 stars until a free drink". Balance 6 → first 6 filled peach + "3 stars until a free drink". Balance 9 → all 9 filled + "🎉 Free drink ready to redeem" + peach "Redeem" chip.
6. **Interaction**:
   - LoyaltyHero tap → `/promotions`.
   - YourUsual `+` tap → cart gains the item (check `useCart().items` via on-device state) + button flips to check icon for ~900ms.
   - DailySpecial CTA → `/(tabs)/menu`.
   - CategoriesStrip tile → `/(tabs)/menu`.
   - HotPicks card → `/menu/[id]`.
   - StoreCard Directions → OS maps app opens with "34 Davenport St Southport QLD 4215".
   - Header bag → `/(tabs)/cart`.
   - Header bell → no-op (peach dot stays; no navigation).
7. **Visual parity check**: side-by-side with `reference/src/HomeScreen.jsx` rendered in the HTML prototype; greeting / loyalty / usual / special / categories / hotpicks / store layouts match to within ~2dp tolerance on iPhone 14 Pro and a Pixel 6-class Android.
8. **Phase 3d WIP preserved** — `git status` at phase end lists the same 13 WIP files from Phase 1 exit, byte-identical.

## Success criteria

- All 7 new section components (HomeHeader, HomeLoyaltyHero, YourUsual, DailySpecial, CategoriesStrip, StoreCard, SectionHead) import only from `constants/theme.ts`, not `lib/constants.ts BRAND`.
- `HeroCarousel.tsx` (re-skinned as HotPicks) still exports `HeroCarousel` for backward compat; exports alias `HotPicks`.
- `index.tsx` has zero `BRAND` imports.
- Dev showcase route deleted; no references remain.
- tsc clean; lint delta zero; runtime smoke tests above pass on both platforms.
- Empty-state behavior (signed out / 0 orders / no welcome) degrades gracefully — no blank cards, no "undefined" text, no crashes.

## Files touched (estimate)

New:
- `components/home/SectionHead.tsx`
- `components/home/HomeHeader.tsx`
- `components/home/HomeLoyaltyHero.tsx`
- `components/home/YourUsual.tsx`
- `components/home/DailySpecial.tsx`
- `components/home/CategoriesStrip.tsx`
- `components/home/StoreCard.tsx`
- `components/home/helpers.ts`

Modified:
- `app/(tabs)/index.tsx` — full rewrite
- `components/home/HeroCarousel.tsx` — token + type swap + `HotPicks` alias export

Deleted:
- `app/dev/theme-showcase.tsx`

Unreferenced (kept on disk):
- `components/home/WelcomeDiscountBanner.tsx`
- `assets/images/hero-banner.webp`
- `assets/images/hero-banner-signed-out.webp`

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `computeYourUsual` modifier-group key drift across orders (Square modifier ids sometimes rotate) | Use `listName + value` as secondary key when `id` is missing; skip orders where line items lack ids. |
| Gradient rendering diff between iOS/Android for LoyaltyHero | Use `expo-linear-gradient` on both platforms (already a transitive dep via expo), don't rely on CSS gradients. |
| Android teardrop pin in StoreCard doesn't match reference's CSS | Documented — use circle + translate + rotate, accept cosmetic diff. Reference's CSS teardrop does not translate to RN `View`. |
| CategoriesStrip count shows "—" when `useMenu()` still loading on cold start | Acceptable — count populates on first catalog response; no flash-of-wrong-number, just flash-of-placeholder. |
| `SafeAreaView` removal causes Header to overlap iOS status bar on notch devices | `_layout.tsx` already renders StatusBar with `translucent: false` / `style: dark`; the ScrollView content starts below the status bar naturally. If on-device test shows overlap, add `paddingTop: insets.top + 8` via `useSafeAreaInsets()` — this is a tuning parameter discovered during Phase 2 Task 9 validation, not a design change. |
| `expo-linear-gradient` not yet in package.json | Verify at Task 0. If missing, `npx expo install expo-linear-gradient` as part of Task 2 (HomeLoyaltyHero). |
