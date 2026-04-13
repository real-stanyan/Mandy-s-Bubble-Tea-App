import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { BRAND } from '@/lib/constants'
import type { CatalogItem, CatalogItemVariation, ModifierList } from '@/types/square'

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const addItem = useCartStore((s) => s.addItem)

  const [item, setItem] = useState<CatalogItem | null>(null)
  const [modifierLists, setModifierLists] = useState<ModifierList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [selectedByList, setSelectedByList] = useState<Record<string, Set<string>>>({})
  const [added, setAdded] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const data = await apiFetch<{ item: CatalogItem; modifierLists?: ModifierList[] }>(
          `/api/catalog/${id}`,
        )
        setItem(data.item)
        const mls = data.modifierLists ?? []
        setModifierLists(mls)

        if (data.item.itemData?.variations?.length) {
          setSelectedVariation(data.item.itemData.variations[0])
        }

        // Initialize modifier defaults
        const initial: Record<string, Set<string>> = {}
        for (const ml of mls) {
          const defaults = ml.modifiers.filter((m) => m.onByDefault).map((m) => m.id)
          if (defaults.length > 0) {
            initial[ml.id] = new Set(defaults)
          }
        }
        setSelectedByList(initial)

        navigation.setOptions({ title: data.item.itemData?.name ?? '' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, navigation])

  const toggleModifier = (list: ModifierList, modifierId: string) => {
    setSelectedByList((prev) => {
      const current = new Set(prev[list.id] ?? [])
      const isSingleSelect = list.maxSelected === 1
      if (current.has(modifierId)) {
        current.delete(modifierId)
      } else {
        if (isSingleSelect) current.clear()
        current.add(modifierId)
      }
      return { ...prev, [list.id]: current }
    })
  }

  const handleAddToCart = () => {
    if (!item || !selectedVariation) return
    const price = Number(selectedVariation.itemVariationData?.priceMoney?.amount ?? 0)
    addItem({
      id: item.id,
      variationId: selectedVariation.id,
      name: item.itemData?.name ?? 'Unknown',
      price,
      imageUrl: item.imageUrl,
      variationName: selectedVariation.itemVariationData?.name,
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
      <ScrollView>
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
                    return (
                      <TouchableOpacity
                        key={mod.id}
                        style={[styles.pill, isSelected && styles.pillActive]}
                        onPress={() => toggleModifier(ml, mod.id)}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                          {mod.name}
                        </Text>
                        {mod.priceCents != null && mod.priceCents > 0 ? (
                          <Text style={[styles.pillPrice, isSelected && styles.pillTextActive]}>
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
      </ScrollView>

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: 'red', fontSize: 16 },
  heroImage: { width: '100%', height: 300 },
  placeholderImage: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pillActive: {
    borderColor: BRAND.color,
    backgroundColor: BRAND.color,
  },
  pillText: { fontSize: 14, color: '#333' },
  pillPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  addedButton: {
    backgroundColor: '#2e7d32',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
})
