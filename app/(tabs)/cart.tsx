import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/utils'
import { CartItemRow } from '@/components/cart/CartItem'
import { EmptyCart } from '@/components/cart/EmptyCart'
import { BRAND } from '@/lib/constants'
import type { CartItem } from '@/types/square'

export default function CartScreen() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())

  if (items.length === 0) {
    return <EmptyCart />
  }

  return (
    <View style={styles.container}>
      <FlatList<CartItem>
        data={items}
        keyExtractor={(item) => item.variationId}
        renderItem={({ item }) => <CartItemRow item={item} />}
      />
      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={() => router.push('/checkout')}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '700', color: BRAND.color },
  checkoutButton: {
    backgroundColor: BRAND.color,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
