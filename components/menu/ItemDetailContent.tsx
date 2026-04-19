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
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'

const EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']

interface Props {
  itemId: string
  ScrollComponent?: ComponentType<ScrollViewProps> | ComponentType<any>
  onLoaded?: (item: CatalogItem) => void
}

export function ItemDetailContent({
  itemId,
  ScrollComponent = ScrollView,
  onLoaded,
}: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const insets = useSafeAreaInsets()
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => { onLoadedRef.current = onLoaded })
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, Set<string>>>({})
  const [added, setAdded] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setItem(null)
    setSelectedVariation(null)
    setSelectedByList({})
    ;(async () => {
      try {
        const data = await apiFetch<{ item: CatalogItem; modifierLists?: ModifierList[] }>(
          `/api/catalog/${itemId}`,
        )
        if (cancelled) return
        setItem(data.item)
        const mls = (data.modifierLists ?? []).map((ml) =>
          ml.name?.toUpperCase() === 'TOPPING'
            ? { ...ml, minSelected: 0, maxSelected: 3 }
            : ml,
        )
        setModifierLists(mls)
        const vars = data.item.itemData?.variations ?? []
        if (vars.length) {
          const baseline =
            vars.find(
              (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
            ) ?? vars[0]
          setSelectedVariation(baseline)
        }
        const initial: Record<string, Set<string>> = {}
        for (const ml of mls) {
          const defaults = ml.modifiers.filter((m) => m.onByDefault).map((m) => m.id)
          if (defaults.length > 0) initial[ml.id] = new Set(defaults)
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
  }, [itemId, retryNonce])

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

  const isModifierDisabled = (list: ModifierList, modifierId: string): boolean => {
    const selected = selectedByList[list.id] ?? new Set()
    if (selected.has(modifierId)) return false
    if (list.maxSelected === 1) return false
    if (list.maxSelected != null && selected.size >= list.maxSelected) return true
    const partnerId = getExclusivePartner(list, modifierId)
    if (partnerId && selected.has(partnerId)) return true
    return false
  }

  const toggleModifier = (list: ModifierList, modifierId: string) => {
    if (isModifierDisabled(list, modifierId)) return
    setSelectedByList((prev) => {
      const current = new Set(prev[list.id] ?? [])
      const isSingleSelect = list.maxSelected === 1
      if (current.has(modifierId)) {
        current.delete(modifierId)
      } else {
        if (isSingleSelect) current.clear()
        const partnerId = getExclusivePartner(list, modifierId)
        if (partnerId) current.delete(partnerId)
        current.add(modifierId)
      }
      return { ...prev, [list.id]: current }
    })
  }

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

  const variations = item.itemData?.variations ?? []
  const baselineVariation =
    variations.find(
      (v) => (v.itemVariationData?.name ?? '').toLowerCase() === 'regular',
    ) ?? variations[0] ?? null
  const baselineAmount = Number(
    baselineVariation?.itemVariationData?.priceMoney?.amount ?? 0,
  )
  const baseCents = Number(selectedVariation?.itemVariationData?.priceMoney?.amount ?? 0)
  const modifierCents = modifierLists.reduce((sum, ml) => {
    const picks = selectedByList[ml.id] ?? new Set()
    return (
      sum +
      ml.modifiers.filter((m) => picks.has(m.id)).reduce((s, m) => s + Number(m.priceCents ?? 0), 0)
    )
  }, 0)
  const totalCents = baseCents + modifierCents
  const addDisabled = !selectedVariation

  return (
    <View style={styles.container}>
      <ScrollComponent>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.hero}
            contentFit="cover"
            contentPosition="center"
          />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <CupArt fill={hashColor(itemId)} size={200} />
          </View>
        )}

        <View style={styles.content}>
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
          {item.itemData?.description ? (
            <Text style={[TYPE.body, { color: T.ink3, marginTop: 4 }]}>
              {item.itemData.description}
            </Text>
          ) : null}

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
          </ModifierSection>

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

function describeSelection(ml: ModifierList): string {
  const { minSelected, maxSelected } = ml
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
  content: { padding: 20 },

  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

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
  chipLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink },
  chipLabelSelected: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  chipLabelDisabled: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink4 },
  chipPrice: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.ink3, marginLeft: 4 },
  chipPriceSelected: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 4,
  },
  chipPriceDisabled: {
    fontFamily: 'Inter_500Medium',
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
  ctaLeft: { fontFamily: 'Fraunces_500Medium', fontSize: 16, color: '#fff' },
  ctaRight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaAddedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctaAddedText: {
    fontFamily: 'Fraunces_500Medium',
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
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.brand },

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
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toppingChevron: {
    fontFamily: 'Inter_500Medium',
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
    fontFamily: 'Inter_700Bold',
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
})
