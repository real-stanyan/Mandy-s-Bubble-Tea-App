import { useEffect, useState, ComponentType } from 'react'
import {
  View,
  Text,
  ScrollView,
  ScrollViewProps,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { BRAND } from '@/lib/constants'
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'

const EXCLUSIVE_TOPPINGS = ['Cheese Cream', 'Brulee']

interface Props {
  itemId: string
  ScrollComponent?: ComponentType<ScrollViewProps>
  onLoaded?: (item: CatalogItem) => void
}

export function ItemDetailContent({
  itemId,
  ScrollComponent = ScrollView,
  onLoaded,
}: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, Set<string>>>({})
  const [added, setAdded] = useState(false)

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
        if (data.item.itemData?.variations?.length) {
          setSelectedVariation(data.item.itemData.variations[0])
        }
        const initial: Record<string, Set<string>> = {}
        for (const ml of mls) {
          const defaults = ml.modifiers.filter((m) => m.onByDefault).map((m) => m.id)
          if (defaults.length > 0) initial[ml.id] = new Set(defaults)
        }
        setSelectedByList(initial)
        onLoaded?.(data.item)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, onLoaded])

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
    addItem({
      id: item.id,
      variationId: selectedVariation.id,
      name: item.itemData?.name ?? 'Unknown',
      price: basePrice + modifierTotal,
      imageUrl: item.imageUrl,
      variationName: selectedVariation.itemVariationData?.name,
      modifiers: chosenModifiers,
    })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Item not found'}</Text>
      </View>
    )
  }

  const variations = item.itemData?.variations ?? []

  return (
    <View style={styles.container}>
      <ScrollComponent>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, styles.placeholderImage]}>
            <Text style={{ fontSize: 64 }}>🧋</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.name}>{item.itemData?.name}</Text>
          {item.itemData?.description ? (
            <Text style={styles.description}>{item.itemData.description}</Text>
          ) : null}

          {variations.length > 1 ? (
            <View style={styles.modifierSection}>
              <Text style={styles.sectionTitle}>Size</Text>
              <View style={styles.pillRow}>
                {variations.map((v) => {
                  const active = v.id === selectedVariation?.id
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedVariation(v)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {v.itemVariationData?.name ?? 'Regular'}
                      </Text>
                      {v.itemVariationData?.priceMoney?.amount != null ? (
                        <Text style={[styles.pillPrice, active && styles.pillTextActive]}>
                          {formatPrice(v.itemVariationData.priceMoney.amount)}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ) : null}

          {modifierLists.map((ml) => {
            const selected = selectedByList[ml.id] ?? new Set()
            return (
              <View key={ml.id} style={styles.modifierSection}>
                <View style={styles.modifierHeader}>
                  <Text style={styles.sectionTitle}>{ml.name}</Text>
                  <Text style={styles.selectionHint}>{describeSelection(ml)}</Text>
                </View>
                <View style={styles.pillRow}>
                  {ml.modifiers.map((mod) => {
                    const isSelected = selected.has(mod.id)
                    const isDisabled = isModifierDisabled(ml, mod.id)
                    return (
                      <TouchableOpacity
                        key={mod.id}
                        style={[
                          styles.pill,
                          isSelected && styles.pillActive,
                          !isSelected && isDisabled && styles.pillDisabled,
                        ]}
                        onPress={() => toggleModifier(ml, mod.id)}
                        disabled={isDisabled}
                        activeOpacity={isDisabled ? 1 : 0.6}
                      >
                        <Text style={[styles.checkmark, !isSelected && styles.checkmarkHidden]}>
                          ✓
                        </Text>
                        <Text
                          style={[
                            styles.pillText,
                            isSelected && styles.pillTextActive,
                            !isSelected && isDisabled && styles.pillTextDisabled,
                          ]}
                        >
                          {mod.name}
                        </Text>
                        {mod.priceCents != null && mod.priceCents > 0 ? (
                          <Text
                            style={[
                              styles.pillPrice,
                              isSelected && styles.pillTextActive,
                              !isSelected && isDisabled && styles.pillTextDisabled,
                            ]}
                          >
                            +{formatPrice(mod.priceCents)}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )
          })}

          {selectedVariation?.itemVariationData?.priceMoney?.amount != null ? (
            <Text style={styles.price}>
              {formatPrice(selectedVariation.itemVariationData.priceMoney.amount)}
            </Text>
          ) : null}
        </View>
      </ScrollComponent>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.addButton, added && styles.addedButton]}
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>{added ? 'Added!' : 'Add to Cart'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
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
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: 'red', fontSize: 16 },
  heroImage: { width: '100%', height: 300 },
  placeholderImage: { backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12 },
  name: { fontSize: 24, fontWeight: '700' },
  description: { fontSize: 15, color: '#666', lineHeight: 22 },
  modifierSection: { marginTop: 8 },
  modifierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  selectionHint: { fontSize: 12, color: '#999' },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  pillActive: { borderColor: BRAND.color, backgroundColor: BRAND.color },
  pillDisabled: { borderColor: '#eee', backgroundColor: '#fafafa' },
  pillText: { fontSize: 14, color: '#333' },
  pillPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  pillTextDisabled: { color: '#ccc' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', width: 12, textAlign: 'center' },
  checkmarkHidden: { color: 'transparent' },
  price: { fontSize: 22, fontWeight: '700', color: BRAND.color },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  addButton: {
    backgroundColor: BRAND.color,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addedButton: { backgroundColor: '#2e7d32' },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
