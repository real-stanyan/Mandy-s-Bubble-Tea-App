import { View, Text, StyleSheet } from 'react-native'
import { formatPrice } from '@/lib/utils'
import type { CartItem } from '@/types/square'

interface Props {
  items: CartItem[]
  total: number
}

export function OrderSummary({ items, total }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Order Summary</Text>
      {items.map((item) => (
        <View key={item.variationId} style={styles.row}>
          <Text style={styles.qty}>{item.quantity}x</Text>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
            {item.variationName ? ` (${item.variationName})` : ''}
          </Text>
          <Text style={styles.price}>
            {formatPrice(item.price * item.quantity)}
          </Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPrice(total)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  qty: { fontSize: 14, color: '#888', width: 30 },
  name: { flex: 1, fontSize: 15 },
  price: { fontSize: 15, fontWeight: '500' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalLabel: { flex: 1, fontSize: 18, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '700' },
})
