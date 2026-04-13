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
import type { CatalogItem, CatalogItemVariation } from '@/types/square'

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const addItem = useCartStore((s) => s.addItem)

  const [item, setItem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<CatalogItemVariation | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    async function fetch() {
      try {
        const data = await apiFetch<{ item: CatalogItem }>(`/api/catalog/${id}`)
        setItem(data.item)
        if (data.item.itemData?.variations?.length) {
          setSelectedVariation(data.item.itemData.variations[0])
        }
        navigation.setOptions({ title: data.item.itemData?.name ?? '' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load item')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, navigation])

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
            <View style={styles.variationsSection}>
              <Text style={styles.sectionTitle}>Size</Text>
              <View style={styles.variationRow}>
                {variations.map((v) => {
                  const active = v.id === selectedVariation?.id
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.variationBtn, active && styles.variationBtnActive]}
                      onPress={() => setSelectedVariation(v)}
                    >
                      <Text style={[styles.variationText, active && styles.variationTextActive]}>
                        {v.itemVariationData?.name ?? 'Regular'}
                      </Text>
                      {v.itemVariationData?.priceMoney?.amount != null ? (
                        <Text
                          style={[styles.variationPrice, active && styles.variationTextActive]}
                        >
                          {formatPrice(v.itemVariationData.priceMoney.amount)}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ) : null}

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
          <Text style={styles.addButtonText}>
            {added ? 'Added!' : 'Add to Cart'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
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
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  variationsSection: { marginTop: 8 },
  variationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  variationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  variationBtnActive: {
    borderColor: '#C43A10',
    backgroundColor: '#C43A1010',
  },
  variationText: { fontSize: 14, color: '#333' },
  variationPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  variationTextActive: { color: '#C43A10', fontWeight: '600' },
  price: { fontSize: 22, fontWeight: '700', color: '#C43A10' },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  addButton: {
    backgroundColor: '#C43A10',
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
