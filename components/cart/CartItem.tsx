import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import type { CartItem as CartItemType } from '@/types/square'

interface Props {
  item: CartItemType
}

export function CartItemRow({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)

  return (
    <View style={styles.row}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={{ fontSize: 24 }}>🧋</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.variationName ? (
          <Text style={styles.variation}>{item.variationName}</Text>
        ) : null}
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => updateQuantity(item.variationId, item.quantity - 1)}
          style={styles.qtyBtn}
        >
          <Ionicons name="remove-circle-outline" size={28} color="#666" />
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() => updateQuantity(item.variationId, item.quantity + 1)}
          style={styles.qtyBtn}
        >
          <Ionicons name="add-circle-outline" size={28} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  image: { width: 60, height: 60, borderRadius: 8 },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500' },
  variation: { fontSize: 13, color: '#888' },
  price: { fontSize: 14, fontWeight: '500', color: '#333' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { padding: 4 },
  qty: { fontSize: 18, fontWeight: '600', minWidth: 24, textAlign: 'center' },
})
