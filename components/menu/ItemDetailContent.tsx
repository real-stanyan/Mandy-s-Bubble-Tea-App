import { useEffect, useRef, useState, ComponentType } from 'react'
import {
  View,
  Text,
  ScrollView,
  ScrollViewProps,
  Pressable,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { T, TYPE, RADIUS } from '@/constants/theme'
import { isBestseller } from '@/components/menu/bestsellers'
import { lockedToppingsFor, displayNameFor, isLockedToppingName, lockedModifierIds, imageSourceFor, lockedToppingsPriceCents } from '@/lib/menu/top10-presets'
import { originalPriceCentsFor } from '@/lib/menu/weekly-specials'
import { SquareImage } from '@/components/ui/SquareImage'
import { ImageSkeleton } from '@/components/ui/ImageSkeleton'
import { IMG_HERO } from '@/lib/optimized-image'
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'
import { CupPreview } from '@/components/menu/CupPreview'
import { OptionSlider } from '@/components/menu/OptionSlider'
import { axisKindFor, axisOptions } from '@/lib/menu/option-axis'
import { useFlyToBagStore } from '@/store/flyToBag'

const EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']
const WARM_ICE_NAME = 'warm'

// TOPPING cap: three toppings on a drink, in total, and Oreo is free.
//
// Was three KINDS with three of each — up to nine on a cup, which is not what
// "up to 3" reads as. Stan flattened it to a total of three (2026-08-14).
// Three of one kind is fine; the total is what is capped.
//
// The app also never had the Oreo exemption the web menu has had all along,
// so a customer adding Oreo here was spending one of their three on it while
// the website gave it away. Both are the same rule now.
const TOPPING_MAX_TOTAL = 3

// Substring match, so a Square rename to "Oreo (New)" keeps the exemption and
// a rename away from Oreo safely rejoins the cap. Same rule as the web's
// lib/menu/topping-rules.ts.
function isUncountedTopping(name: string): boolean {
  return name.trim().toLowerCase().includes('oreo')
}

type CountMap = Record<string, number>
const EMPTY_COUNTS: Readonly<CountMap> = Object.freeze({}) as Readonly<CountMap>

function isToppingList(name: string | undefined | null): boolean {
  return (name ?? '').toUpperCase().includes('TOPPING')
}

function isWarmIceModifier(mod: { name: string }): boolean {
  return mod.name.trim().toLowerCase() === WARM_ICE_NAME
}

function someSelectedAcrossLists(
  selectedByList: Record<string, CountMap>,
  modifierLists: ModifierList[],
  predicate: (mod: { name: string }) => boolean,
): boolean {
  for (const ml of modifierLists) {
    const counts = selectedByList[ml.id] ?? EMPTY_COUNTS
    for (const mod of ml.modifiers) {
      if ((counts[mod.id] ?? 0) > 0 && predicate(mod)) return true
    }
  }
  return false
}

function totalInList(counts: CountMap): number {
  let sum = 0
  for (const v of Object.values(counts)) sum += v
  return sum
}

/** Quantities summed, skipping Oreo. Two pearls and a jelly is three. */
function cappedTotalInList(list: ModifierList, counts: CountMap): number {
  let n = 0
  for (const mod of list.modifiers) {
    if (isUncountedTopping(mod.name)) continue
    n += counts[mod.id] ?? 0
  }
  return n
}

interface Props {
  itemId: string
  categorySlug?: string | null
  ScrollComponent?: ComponentType<ScrollViewProps> | ComponentType<any>
  onLoaded?: (item: CatalogItem) => void
  /** Send a dot from the Add button to the mini cart bar (the sheet, which
   *  floats over the tabs; the stack route has no bar to fly to). */
  flyToBag?: boolean
}

export function ItemDetailContent({
  itemId,
  categorySlug,
  ScrollComponent = ScrollView,
  onLoaded,
  flyToBag = false,
}: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const ctaRef = useRef<View>(null)
  const insets = useSafeAreaInsets()
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => { onLoadedRef.current = onLoaded })
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, CountMap>>({})
  const [added, setAdded] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [quantity, setQuantity] = useState(1)
  // Hero skeleton lifecycle: the skeleton sits UNDER the image, so keep it
  // mounted ~200ms past onLoad — the image's 150ms fade-in covers it and
  // unmounting never exposes the bare background mid-fade.
  const [heroLoaded, setHeroLoaded] = useState(false)
  const heroLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onHeroLoad = () => {
    if (heroLoadTimer.current) clearTimeout(heroLoadTimer.current)
    heroLoadTimer.current = setTimeout(() => setHeroLoaded(true), 200)
  }
  useEffect(() => {
    return () => {
      if (heroLoadTimer.current) clearTimeout(heroLoadTimer.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setItem(null)
    setSelectedVariation(null)
    setSelectedByList({})
    setHeroLoaded(false)
    ;(async () => {
      try {
        const data = await apiFetch<{ item: CatalogItem; modifierLists?: ModifierList[] }>(
          `/api/catalog/${itemId}`,
        )
        if (cancelled) return
        setItem(data.item)
        const mls = (data.modifierLists ?? []).map((ml) =>
          isToppingList(ml.name)
            ? { ...ml, minSelected: 0, maxSelected: null }
            : ml,
        )
        setModifierLists(mls)
        const vars = data.item.itemData?.variations ?? []
        if (vars.length) {
          const available = vars.filter((v) => !v.soldOut)
          const pool = available.length > 0 ? available : vars
          const baseline =
            pool.find(
              (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
            ) ?? pool[0]
          setSelectedVariation(baseline)
        }
        const lockedToppings = lockedToppingsFor(
          categorySlug ?? undefined,
          data.item.itemData?.name ?? '',
        )
        const lockedIds = lockedModifierIds(
          mls.map((ml) => ({ id: ml.id, modifiers: ml.modifiers })),
          lockedToppings,
        )
        const initial: Record<string, CountMap> = {}
        for (const ml of mls) {
          const defaults = ml.modifiers.filter((m) => m.onByDefault)
          if (defaults.length > 0) {
            const map: CountMap = {}
            for (const m of defaults) map[m.id] = 1
            initial[ml.id] = map
          }
        }
        for (const { listId, modifierId } of lockedIds) {
          const map = initial[listId] ?? {}
          if ((map[modifierId] ?? 0) < 1) map[modifierId] = 1
          initial[listId] = map
        }
        setSelectedByList(initial)
        onLoadedRef.current?.(data.item)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, retryNonce, categorySlug])

  useEffect(
    () => () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    },
    [],
  )

  const getExclusivePartner = (list: ModifierList, modifierId: string): string | null => {
    const mod = list.modifiers.find((m) => m.id === modifierId)
    if (!mod || !EXCLUSIVE_TOPPINGS.includes(mod.name)) return null
    const partner = list.modifiers.find(
      (m) => m.id !== modifierId && EXCLUSIVE_TOPPINGS.includes(m.name),
    )
    return partner?.id ?? null
  }

  const countOf = (listId: string, modifierId: string): number =>
    selectedByList[listId]?.[modifierId] ?? 0

  const isLockedName = (modName: string) =>
    isLockedToppingName(modName, lockedToppingsFor(categorySlug ?? undefined, item?.itemData?.name ?? ''))

  const canIncrement = (list: ModifierList, modifierId: string): boolean => {
    const mod = list.modifiers.find((m) => m.id === modifierId)
    if (!mod || mod.soldOut) return false
    const counts = selectedByList[list.id] ?? EMPTY_COUNTS
    const current = counts[modifierId] ?? 0
    // Cross-list mutex: Warm ice ⊥ Cheese Cream / Brulee toppings.
    // Hot drinks don't pair with cold cream / torched-sugar toppings.
    if (
      isWarmIceModifier(mod) &&
      someSelectedAcrossLists(selectedByList, modifierLists, (m) =>
        EXCLUSIVE_TOPPINGS.includes(m.name),
      )
    ) {
      return false
    }
    if (
      EXCLUSIVE_TOPPINGS.includes(mod.name) &&
      someSelectedAcrossLists(selectedByList, modifierLists, isWarmIceModifier)
    ) {
      return false
    }
    if (list.maxSelected === 1) return current < 1
    // Exclusive modifier (Cheese Cream / Brulee): 0-or-1 and partner-mutex.
    if (EXCLUSIVE_TOPPINGS.includes(mod.name)) {
      const partnerId = getExclusivePartner(list, modifierId)
      if (partnerId && (counts[partnerId] ?? 0) > 0) return false
      if (current >= 1) return false
    }
    if (isToppingList(list.name)) {
      const mod = list.modifiers.find((m) => m.id === modifierId)
      // Oreo neither counts toward the three nor is blocked by it.
      if (!mod || !isUncountedTopping(mod.name)) {
        if (cappedTotalInList(list, counts) >= TOPPING_MAX_TOTAL) return false
      }
    }
    if (list.maxSelected != null && totalInList(counts) >= list.maxSelected)
      return false
    return true
  }

  const incrementModifier = (list: ModifierList, modifierId: string) => {
    if (!canIncrement(list, modifierId)) return
    setSelectedByList((prev) => {
      const next: CountMap = { ...(prev[list.id] ?? {}) }
      if (list.maxSelected === 1) {
        for (const k of Object.keys(next)) next[k] = 0
      }
      const partnerId = getExclusivePartner(list, modifierId)
      if (partnerId) next[partnerId] = 0
      next[modifierId] = (next[modifierId] ?? 0) + 1
      return { ...prev, [list.id]: next }
    })
  }

  const decrementModifier = (list: ModifierList, modifierId: string) => {
    setSelectedByList((prev) => {
      const next: CountMap = { ...(prev[list.id] ?? {}) }
      const current = next[modifierId] ?? 0
      if (current <= 0) return prev
      const mod = list.modifiers.find((m) => m.id === modifierId)
      if (mod && isLockedName(mod.name) && current <= 1) return prev
      next[modifierId] = current - 1
      return { ...prev, [list.id]: next }
    })
  }

  const toggleModifier = (list: ModifierList, modifierId: string) => {
    const current = countOf(list.id, modifierId)
    const mod = list.modifiers.find((m) => m.id === modifierId)
    if (current > 0) {
      if (mod && isLockedName(mod.name)) return
      decrementModifier(list, modifierId)
    } else {
      incrementModifier(list, modifierId)
    }
  }

  const handleAddToCart = () => {
    if (!item || !selectedVariation) return
    const basePrice = Number(selectedVariation.itemVariationData?.priceMoney?.amount ?? 0)
    const chosenModifiers = modifierLists.flatMap((ml) => {
      const counts = selectedByList[ml.id] ?? EMPTY_COUNTS
      return ml.modifiers.flatMap((m) => {
        const c = counts[m.id] ?? 0
        if (c <= 0) return []
        return Array.from({ length: c }, () => ({
          id: m.id,
          name: m.name,
          listName: ml.name,
          priceCents: Number(m.priceCents ?? 0),
        }))
      })
    })
    const modifierTotal = chosenModifiers.reduce((sum, m) => sum + m.priceCents, 0)
    if (flyToBag) {
      ctaRef.current?.measureInWindow((x, y, w, h) => {
        if (![x, y, w, h].every(Number.isFinite)) return
        // A beat later than the store update, so an empty cart's bar has
        // mounted by the time the dot arrives to be caught.
        setTimeout(() => useFlyToBagStore.getState().launch({ x: x + w / 2, y: y + h / 2 }), 40)
      })
    }
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: item.id,
        variationId: selectedVariation.id,
        name: displayNameFor(categorySlug ?? undefined, item.itemData?.name ?? '') || (item.itemData?.name ?? 'Unknown'),
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

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error || !item) {
    return (
      <ErrorView
        message={error ?? 'Item not found'}
        onRetry={() => setRetryNonce((n) => n + 1)}
      />
    )
  }

  const lockedToppings = lockedToppingsFor(categorySlug ?? undefined, item.itemData?.name ?? '')
  const isLocked = (modName: string) => isLockedToppingName(modName, lockedToppings)
  const shownName = displayNameFor(categorySlug ?? undefined, item.itemData?.name ?? '')
  const customHero = imageSourceFor(categorySlug ?? undefined, item.itemData?.name ?? '')

  const variations = item.itemData?.variations ?? []
  const baselineVariation =
    variations.find(
      (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
    ) ?? variations[0] ?? null
  const baselineAmount = Number(
    baselineVariation?.itemVariationData?.priceMoney?.amount ?? 0,
  )
  // Inside TOP 10 the locked toppings are mandatory → headline price shows the
  // real starting price (base + locked toppings).
  const lockedSurcharge = lockedToppingsPriceCents(
    categorySlug ?? undefined,
    item.itemData?.name ?? '',
    modifierLists.flatMap((ml) =>
      ml.modifiers.map((m) => ({ name: m.name, priceCents: Number(m.priceCents ?? 0) })),
    ),
  )
  const headlineAmount = baselineAmount + lockedSurcharge
  const originalPriceCents = originalPriceCentsFor(item.itemData?.name ?? '')
  const isOnSpecial = originalPriceCents != null && originalPriceCents > headlineAmount
  const baseCents = Number(selectedVariation?.itemVariationData?.priceMoney?.amount ?? 0)
  const modifierCents = modifierLists.reduce((sum, ml) => {
    const counts = selectedByList[ml.id] ?? EMPTY_COUNTS
    return (
      sum +
      ml.modifiers.reduce(
        (s, m) => s + Number(m.priceCents ?? 0) * (counts[m.id] ?? 0),
        0,
      )
    )
  }, 0)
  const totalCents = baseCents + modifierCents
  const hasSoldOutSelectedModifier = modifierLists.some((ml) => {
    const counts = selectedByList[ml.id] ?? EMPTY_COUNTS
    return ml.modifiers.some((m) => (counts[m.id] ?? 0) > 0 && m.soldOut)
  })
  const addDisabled =
    !selectedVariation ||
    selectedVariation.soldOut === true ||
    hasSoldOutSelectedModifier

  return (
    <View style={styles.container}>
      {/* Child order matters: hero(0), title block(1), cup(2), the rest(3).
          stickyHeaderIndices pins the cup once it reaches the top, so the
          live preview stays in view while the customer scrolls the modifier
          lists — web's stickyPreview parity (ItemOrderForm.tsx). */}
      <ScrollComponent stickyHeaderIndices={[2]}>
        {customHero ? (
          <Image
            source={customHero}
            style={styles.hero}
            contentFit="cover"
            contentPosition="center"
          />
        ) : item.imageUrl ? (
          <View style={styles.hero}>
            {!heroLoaded ? <ImageSkeleton /> : null}
            <SquareImage
              url={item.imageUrl}
              width={IMG_HERO}
              style={StyleSheet.absoluteFill}
              contentPosition="center"
              onLoad={onHeroLoad}
            />
          </View>
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <CupArt fill={hashColor(itemId)} size={200} />
          </View>
        )}

        <View style={styles.contentTop}>
          {isBestseller(item.itemData?.name) ? (
            <View style={styles.bestsellerPill}>
              <Text style={styles.bestsellerText}>BESTSELLER</Text>
            </View>
          ) : null}
          <View style={styles.titleRow}>
            <Text style={[TYPE.screenTitleLg, styles.titleText, { color: T.ink }]} numberOfLines={2}>
              {shownName}
            </Text>
            {headlineAmount > 0 ? (
              <View style={styles.headlinePriceRow}>
                {isOnSpecial ? (
                  <Text style={styles.headlinePriceOriginal}>
                    {formatPrice(originalPriceCents)}
                  </Text>
                ) : null}
                <Text style={[styles.headlinePrice, isOnSpecial && styles.headlinePriceSpecial]}>
                  {formatPrice(headlineAmount)}
                </Text>
              </View>
            ) : null}
          </View>
          {item.itemData?.description ? (
            <Text style={[TYPE.body, { color: T.ink3, marginTop: 4 }]}>
              {item.itemData.description}
            </Text>
          ) : null}
        </View>

        {/* Live cup preview — redraws as picks change. Same mapper as the
            web's (lib/cup-visual mirrors it); anything it doesn't recognise
            simply doesn't draw, the sections below stay the source of truth.
            Direct ScrollComponent child so stickyHeaderIndices can pin it;
            solid paper background because the form scrolls underneath. */}
        <View style={styles.stickyCup}>
          <CupPreview
            drinkName={shownName}
            picked={modifierLists.flatMap((ml) =>
              ml.modifiers.map((mod) => ({
                name: mod.name,
                count: (selectedByList[ml.id] ?? EMPTY_COUNTS)[mod.id] ?? 0,
              })),
            )}
          />
        </View>

        <View style={styles.content}>
          {/* Size section (unified — single or multi variation) */}
          <ModifierSection
            eyebrow="SIZE"
            title="Choose size"
            hint={variations.length > 1 ? 'Pick one' : 'Only option'}
            required
          >
            {variations.map((v) => {
              const selected = v.id === selectedVariation?.id
              const priceAmt = Number(v.itemVariationData?.priceMoney?.amount ?? 0)
              const delta = priceAmt - baselineAmount
              const priceSuffix =
                v.soldOut
                  ? 'Sold out'
                  : delta === 0
                    ? null
                    : delta < 0
                      ? `−${formatPrice(Math.abs(delta))}`
                      : `+${formatPrice(delta)}`
              return (
                <Chip
                  key={v.id}
                  // "Regular" carries the capacity so the pill answers the
                  // size question by itself (Stan, 2026-08-24); a real named
                  // size (if one ever appears) renders untouched.
                  label={sizeChipLabel(v.itemVariationData?.name ?? 'Regular')}
                  priceSuffix={priceSuffix}
                  selected={selected}
                  disabled={v.soldOut === true && !selected}
                  onPress={() => {
                    if (v.soldOut) return
                    setSelectedVariation(v)
                  }}
                />
              )
            })}
          </ModifierSection>

          {modifierLists.map((ml) => {
            const counts = selectedByList[ml.id] ?? EMPTY_COUNTS
            const isTopping = isToppingList(ml.name)
            if (isTopping) {
              return (
                <ToppingSection
                  key={ml.id}
                  eyebrow={eyebrowForList(ml.name)}
                  title={titleForList(ml.name)}
                  hint={describeSelection(ml, true)}
                  required={ml.minSelected >= 1}
                >
                  {ml.modifiers.map((mod) => {
                    const count = counts[mod.id] ?? 0
                    const isExclusive = EXCLUSIVE_TOPPINGS.includes(mod.name)
                    const supportsStepper = !isExclusive
                    const canInc = canIncrement(ml, mod.id)
                    const rowDisabled = count === 0 && !canInc
                    const locked = isLocked(mod.name)
                    return (
                      <ToppingRow
                        key={mod.id}
                        label={mod.name}
                        priceCents={Number(mod.priceCents ?? 0)}
                        count={count}
                        supportsStepper={supportsStepper}
                        canIncrement={canInc}
                        disabled={rowDisabled}
                        soldOut={mod.soldOut === true}
                        locked={locked}
                        canDecrement={!(locked && count <= 1)}
                        onIncrement={() => incrementModifier(ml, mod.id)}
                        onDecrement={() => decrementModifier(ml, mod.id)}
                        onToggle={() => toggleModifier(ml, mod.id)}
                      />
                    )
                  })}
                </ToppingSection>
              )
            }
            const axis = ml.maxSelected === 1 ? axisKindFor(ml.name) : null
            if (axis) {
              // Sugar / ice: one dimension, so one slider. Selecting sets the
              // count to 1 and clears the rest (incrementModifier does that
              // for maxSelected === 1); the mutex rules still apply through
              // canIncrement, which is what greys Warm out under cheese cream.
              const ordered = axisOptions(axis, ml.modifiers)
              const selectedId = ordered.find((o) => (counts[o.option.id] ?? 0) > 0)?.option.id ?? null
              return (
                <ModifierSection
                  key={ml.id}
                  eyebrow={eyebrowForList(ml.name)}
                  title={titleForList(ml.name)}
                  hint={describeSelection(ml, false)}
                  required={ml.minSelected >= 1}
                  layout="block"
                >
                  <OptionSlider
                    accessibilityLabel={titleForList(ml.name)}
                    options={ordered.map((o) => ({
                      id: o.option.id,
                      short: o.short,
                      name: o.option.soldOut ? `${o.option.name} · Sold out` : o.option.name,
                      disabled:
                        o.option.soldOut === true ||
                        ((counts[o.option.id] ?? 0) === 0 && !canIncrement(ml, o.option.id)),
                    }))}
                    value={selectedId}
                    onChange={(id) => {
                      if ((counts[id] ?? 0) > 0) return
                      incrementModifier(ml, id)
                    }}
                  />
                </ModifierSection>
              )
            }
            return (
              <ModifierSection
                key={ml.id}
                eyebrow={eyebrowForList(ml.name)}
                title={titleForList(ml.name)}
                hint={describeSelection(ml, false)}
                required={ml.minSelected >= 1}
              >
                {ml.modifiers.map((mod) => {
                  const count = counts[mod.id] ?? 0
                  const isSelected = count > 0
                  const canInc = canIncrement(ml, mod.id)
                  const isDisabled = !isSelected && !canInc
                  const priceSuffix = mod.soldOut
                    ? 'Sold out'
                    : mod.priceCents != null && mod.priceCents > 0
                      ? `+${formatPrice(mod.priceCents)}`
                      : null
                  return (
                    <Chip
                      key={mod.id}
                      label={mod.name}
                      priceSuffix={priceSuffix}
                      selected={isSelected}
                      disabled={isDisabled}
                      onPress={() => toggleModifier(ml, mod.id)}
                    />
                  )
                })}
              </ModifierSection>
            )
          })}
        </View>
      </ScrollComponent>

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
          ref={ctaRef}
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
    </View>
  )
}

function ModifierSection({
  eyebrow,
  title,
  hint,
  required,
  layout = 'chips',
  children,
}: {
  eyebrow: string
  title: string
  hint: string
  required?: boolean
  /** chips wrap in a row; a block (the sugar / ice slider) takes the full width. */
  layout?: 'chips' | 'block'
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
      <View style={layout === 'block' ? styles.block : styles.chipRow}>{children}</View>
    </View>
  )
}

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
  const [expanded, setExpanded] = useState(true)
  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.sectionHeader, pressed && { opacity: 0.6 }]}
      >
        <View style={{ gap: 2 }}>
          <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{eyebrow}</Text>
          <Text style={[TYPE.cardTitle, { color: T.ink }]}>{title}</Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          {required ? (
            <View style={styles.requiredPill}>
              <Text style={styles.requiredPillText}>REQUIRED</Text>
            </View>
          ) : (
            <Text style={styles.sectionHint}>{hint}</Text>
          )}
          <Text
            style={[styles.toppingChevron, !expanded && { transform: [{ rotate: '180deg' }] }]}
          >
            ▾
          </Text>
        </View>
      </Pressable>
      {expanded ? <View style={styles.toppingList}>{children}</View> : null}
    </View>
  )
}

function Chip({
  label,
  priceSuffix,
  selected,
  disabled,
  onPress,
}: {
  label: string
  priceSuffix: string | null
  selected: boolean
  disabled: boolean
  onPress: () => void
}) {
  const chipStyle = [
    styles.chip,
    selected
      ? styles.chipSelected
      : disabled
        ? styles.chipDisabled
        : styles.chipUnselected,
  ]
  const labelStyle = selected
    ? styles.chipLabelSelected
    : disabled
      ? styles.chipLabelDisabled
      : styles.chipLabel
  const priceStyle = selected
    ? styles.chipPriceSelected
    : disabled
      ? styles.chipPriceDisabled
      : styles.chipPrice
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [chipStyle, pressed && !disabled && { opacity: 0.6 }]}
    >
      <Text style={labelStyle}>{label}</Text>
      {priceSuffix ? <Text style={priceStyle}>{priceSuffix}</Text> : null}
    </Pressable>
  )
}

function ToppingRow({
  label,
  priceCents,
  count,
  supportsStepper,
  canIncrement,
  disabled,
  soldOut = false,
  locked = false,
  canDecrement = true,
  onIncrement,
  onDecrement,
  onToggle,
}: {
  label: string
  priceCents: number
  count: number
  supportsStepper: boolean
  canIncrement: boolean
  disabled: boolean
  soldOut?: boolean
  locked?: boolean
  canDecrement?: boolean
  onIncrement: () => void
  onDecrement: () => void
  onToggle: () => void
}) {
  const selected = count > 0
  // If the modifier supports multi-count and is already chosen, show a
  // stepper on the right instead of the checkbox toggle so the customer
  // can add more of the same kind.
  const showStepper = supportsStepper && selected
  return (
    <Pressable
      onPress={showStepper ? undefined : onToggle}
      disabled={showStepper || disabled}
      accessibilityRole={showStepper ? undefined : 'checkbox'}
      accessibilityState={showStepper ? undefined : { checked: selected, disabled }}
      style={({ pressed }) => [
        styles.toppingRow,
        disabled && !selected && { opacity: 0.45 },
        !showStepper && pressed && !disabled && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected ? <Icon name="check" size={14} color="#fff" /> : null}
      </View>
      <Text style={styles.toppingLabel}>{label}</Text>
      {locked ? (
        <View style={styles.includedPill}>
          <Text style={styles.includedPillText}>INCLUDED</Text>
        </View>
      ) : null}
      {soldOut ? (
        <Text style={styles.toppingSoldOut}>Sold out</Text>
      ) : showStepper ? (
        <View style={styles.toppingStepper}>
          <Pressable
            onPress={onDecrement}
            disabled={!canDecrement}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${label}`}
            accessibilityState={{ disabled: !canDecrement }}
            style={({ pressed }) => [
              styles.toppingStepperBtn,
              !canDecrement && { opacity: 0.35 },
              pressed && canDecrement && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.toppingStepperMinus}>−</Text>
          </Pressable>
          <Text style={styles.toppingStepperCount}>{count}</Text>
          <Pressable
            onPress={onIncrement}
            disabled={!canIncrement}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${label}`}
            accessibilityState={{ disabled: !canIncrement }}
            style={({ pressed }) => [
              styles.toppingStepperBtn,
              !canIncrement && { opacity: 0.35 },
              pressed && canIncrement && { opacity: 0.5 },
            ]}
          >
            <Icon name="plus" size={14} color={T.ink} />
          </Pressable>
          {priceCents > 0 ? (
            <Text style={styles.toppingStepperPrice}>+{formatPrice(priceCents)}</Text>
          ) : null}
        </View>
      ) : priceCents > 0 ? (
        <Text style={styles.toppingPrice}>+{formatPrice(priceCents)}</Text>
      ) : null}
    </Pressable>
  )
}

function LoadingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: T.paper }}>
      <View style={[styles.hero, { backgroundColor: T.sage }]} />
      <View style={{ padding: 20, gap: 10 }}>
        <View style={{ height: 28, width: '70%', borderRadius: 8, backgroundColor: T.line }} />
        <View style={{ height: 14, width: '100%', borderRadius: 7, backgroundColor: T.line }} />
        <View style={{ height: 14, width: '60%', borderRadius: 7, backgroundColor: T.line }} />
        <View style={{ marginTop: 24, gap: 10 }}>
          <View style={{ height: 10, width: 80, borderRadius: 5, backgroundColor: T.line }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
            <View style={{ height: 36, width: 80, borderRadius: 999, backgroundColor: T.line }} />
          </View>
        </View>
      </View>
    </View>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCenter}>
      <Icon name="cafe" color={T.ink3} size={32} />
      <Text style={[TYPE.cardTitle, { color: T.ink, textAlign: 'center', marginTop: 12 }]}>
        Couldn&apos;t load this drink.
      </Text>
      <Text
        style={[TYPE.body, { color: T.ink3, textAlign: 'center', marginTop: 6 }]}
      >
        {message || 'Try again.'}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  )
}

/** "Regular" gains its capacity — every drink is one 700ml size, and the
 *  bare word answered nothing. Any other (future, real) size name passes
 *  through untouched. Same wording as the web's size chip. */
function sizeChipLabel(name: string): string {
  return /^regular$/i.test(name.trim()) ? `${name} (700ml)` : name
}

function eyebrowForList(name: string): string {
  const upper = (name ?? '').toUpperCase()
  if (upper.includes('SUGAR')) return 'SUGAR'
  if (upper.includes('ICE')) return 'ICE'
  if (upper === 'TOPPING' || upper.includes('TOPPING')) return 'TOPPINGS'
  if (upper.includes('SIZE')) return 'SIZE'
  return upper
}

function titleForList(name: string): string {
  const upper = (name ?? '').toUpperCase()
  if (upper.includes('SUGAR')) return 'Sugar level'
  if (upper.includes('ICE')) return 'Ice level'
  if (upper === 'TOPPING' || upper.includes('TOPPING')) return 'Add toppings'
  if (upper.includes('SIZE')) return 'Choose size'
  return name
}

function describeSelection(ml: ModifierList, isTopping: boolean): string {
  const { minSelected, maxSelected } = ml
  if (isTopping) {
    return `Up to ${TOPPING_MAX_TOTAL} toppings in total · Oreo unlimited (doesn't count)`
  }
  if (minSelected === 0 && maxSelected === 1) return 'Pick one (optional)'
  if (minSelected === 1 && maxSelected === 1) return 'Pick one'
  if (maxSelected == null && minSelected === 0) return 'Pick any'
  if (maxSelected == null && minSelected > 0) return `Pick at least ${minSelected}`
  if (minSelected === 0) return `Pick up to ${maxSelected}`
  return `Pick ${minSelected}–${maxSelected}`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  hero: { width: '100%', aspectRatio: 1, backgroundColor: T.sage },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  contentTop: { paddingHorizontal: 20, paddingTop: 20 },
  // Solid bg, not transparent: this block pins to the top of the scroll
  // (stickyHeaderIndices) and the modifier sections slide beneath it —
  // text ghosting through the cup reads as a rendering bug (same call as
  // web's ItemOrderForm sticky card).
  stickyCup: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: T.paper,
  },
  content: { padding: 20, paddingTop: 0 },

  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHint: {
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  block: { width: '100%' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipUnselected: { backgroundColor: T.paper, borderColor: T.line },
  chipSelected: { backgroundColor: T.brand, borderColor: T.brand },
  chipDisabled: { backgroundColor: T.bg, borderColor: T.line, opacity: 0.5 },
  chipLabel: { fontFamily: 'ShantellSans_500Medium', fontSize: 14, color: T.ink },
  chipLabelSelected: { fontFamily: 'ShantellSans_600SemiBold', fontSize: 14, color: '#fff' },
  chipLabelDisabled: { fontFamily: 'ShantellSans_500Medium', fontSize: 14, color: T.ink4 },
  chipPrice: { fontFamily: 'ShantellSans_500Medium', fontSize: 12, color: T.ink3, marginLeft: 4 },
  chipPriceSelected: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 4,
  },
  chipPriceDisabled: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    color: T.ink4,
    marginLeft: 4,
  },

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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: T.brand,
  },
  ctaAdded: { backgroundColor: T.greenDark, justifyContent: 'center' },
  ctaDisabled: { backgroundColor: T.ink4 },
  ctaLeft: { fontFamily: 'ShantellSans_700Bold', fontSize: 16, color: '#fff' },
  ctaRight: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaAddedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaAddedText: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },

  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: T.paper,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: T.brand,
    backgroundColor: 'transparent',
  },
  retryText: { fontFamily: 'ShantellSans_600SemiBold', fontSize: 13, color: T.brand },

  bestsellerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.star,
    marginBottom: 8,
  },
  bestsellerText: {
    fontFamily: 'ShantellSans_600SemiBold',
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
  headlinePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  headlinePriceOriginal: {
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 16,
    color: T.ink4,
    textDecorationLine: 'line-through',
  },
  headlinePrice: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 22,
    color: T.ink,
  },
  headlinePriceSpecial: {
    color: '#dc2626',
  },

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
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  toppingPrice: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 13,
    color: T.ink3,
  },
  toppingSoldOut: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: T.ink3,
    textTransform: 'uppercase',
  },
  toppingStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
  },
  toppingStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toppingStepperMinus: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 18,
    lineHeight: 18,
    color: T.ink,
  },
  toppingStepperCount: {
    minWidth: 20,
    textAlign: 'center',
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 13,
    color: T.ink,
  },
  toppingStepperPrice: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    color: T.ink3,
    marginLeft: 6,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toppingChevron: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 14,
    color: T.ink3,
    lineHeight: 14,
  },

  requiredPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(196,58,16,0.12)',
  },
  requiredPillText: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: T.brand,
    textTransform: 'uppercase',
  },
  includedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(196,58,16,0.12)',
  },
  includedPillText: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: T.brand,
    textTransform: 'uppercase',
  },

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
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 22,
    lineHeight: 22,
    color: T.ink,
  },
  stepperCount: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 16,
    color: T.ink,
  },
  ctaFlex: { flex: 1 },
})
