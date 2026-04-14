import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { formatPrice } from '@/lib/utils'
import { BRAND } from '@/lib/constants'
import { useCartStore } from '@/store/cart'
import { useItemSheetStore } from '@/store/itemSheet'
import type { CatalogItem } from '@/types/square'

interface Props {
  item: CatalogItem
}

export function ItemCard({ item }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const name = item.itemData?.name ?? 'Unknown'
  const firstVariation = item.itemData?.variations?.[0]
  const price = firstVariation?.itemVariationData?.priceMoney?.amount

  const handleAddToCart = () => {
    if (!firstVariation) return
    addItem({
      id: item.id,
      variationId: firstVariation.id,
      name,
      price: Number(price ?? 0),
      imageUrl: item.imageUrl,
      variationName: firstVariation.itemVariationData?.name,
      modifiers: [],
    })
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => useItemSheetStore.getState().open(item.id)}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>🧋</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {price != null ? (
        <Text style={styles.price}>{formatPrice(price)}</Text>
      ) : null}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={(e) => {
          e.stopPropagation?.()
          handleAddToCart()
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.addBtnText}>Add to Cart</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const CARD_WIDTH = 140

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 12,
    gap: 4,
  },
  image: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
  },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
  name: {
    fontSize: 13,
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
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: BRAND.color,
    fontSize: 12,
    fontWeight: '600',
  },
})
