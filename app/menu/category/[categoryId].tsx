import { useMemo } from 'react'
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useMenu } from '@/hooks/use-menu'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { BRAND } from '@/lib/constants'
import type { CatalogItem } from '@/types/square'
import { useEffect } from 'react'

export default function CategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>()
  const navigation = useNavigation()
  const router = useRouter()
  const { items, categories, loading } = useMenu()
  const addItem = useCartStore((s) => s.addItem)

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  )

  const categoryItems = useMemo(
    () =>
      items.filter((item) =>
        item.itemData?.categories?.some((c) => c.id === categoryId),
      ),
    [items, categoryId],
  )

  useEffect(() => {
    if (category) {
      navigation.setOptions({ title: category.name })
    }
  }, [category, navigation])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  const handleAddToCart = (item: CatalogItem) => {
    const firstVariation = item.itemData?.variations?.[0]
    if (!firstVariation) return
    addItem({
      id: item.id,
      variationId: firstVariation.id,
      name: item.itemData?.name ?? 'Unknown',
      price: Number(firstVariation.itemVariationData?.priceMoney?.amount ?? 0),
      imageUrl: item.imageUrl,
      variationName: firstVariation.itemVariationData?.name,
    })
  }

  return (
    <FlatList
      data={categoryItems}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => {
        const name = item.itemData?.name ?? 'Unknown'
        const price = item.itemData?.variations?.[0]?.itemVariationData?.priceMoney?.amount
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/menu/${item.id}`)}
            activeOpacity={0.7}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={[styles.image, styles.placeholder]}>
                <Text style={styles.placeholderEmoji}>🧋</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {price != null && <Text style={styles.price}>{formatPrice(price)}</Text>}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                handleAddToCart(item)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.addBtnText}>Add to Cart</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  card: {
    width: '48%',
    gap: 4,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: { fontSize: 40 },
  name: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  price: {
    fontSize: 13,
    color: '#666',
  },
  addBtn: {
    borderWidth: 1,
    borderColor: BRAND.color,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: BRAND.color,
    fontSize: 12,
    fontWeight: '600',
  },
})
