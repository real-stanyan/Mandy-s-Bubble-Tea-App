import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { formatPrice } from '@/lib/utils'
import type { CatalogItem } from '@/types/square'

interface Props {
  item: CatalogItem
}

export function ItemCard({ item }: Props) {
  const router = useRouter()
  const name = item.itemData?.name ?? 'Unknown'
  const description = item.itemData?.description
  const firstVariation = item.itemData?.variations?.[0]
  const price = firstVariation?.itemVariationData?.priceMoney?.amount

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
          <Text style={styles.placeholderText}>🧋</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {price != null ? (
          <Text style={styles.price}>{formatPrice(price)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: '#666',
  },
  price: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
})
