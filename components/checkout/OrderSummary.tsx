import { View, Text, Image, StyleSheet } from 'react-native'
import { formatPrice } from '@/lib/utils'
import type { CartItem } from '@/types/square'

interface Props {
  items: CartItem[]
  total: number
  welcomeDiscount?: { amountCents: number; percentage: number } | null
}

export function OrderSummary({ items, total, welcomeDiscount }: Props) {
  const discountAmount = welcomeDiscount?.amountCents ?? 0
  const discountedTotal = Math.max(total - discountAmount, 0)
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Order Summary</Text>
      {items.map((item) => (
        <View key={item.lineId} style={styles.row}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderText}>🧋</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.variationName ? (
              <Text style={styles.variation}>{item.variationName}</Text>
            ) : null}
            {(item.modifiers ?? []).length > 0 ? (
              <Text style={styles.modifier} numberOfLines={2}>
                {(item.modifiers ?? []).map((m) => m.name).join(', ')}
              </Text>
            ) : null}
            <Text style={styles.qty}>x{item.quantity}</Text>
          </View>
          <Text style={styles.price}>
            {formatPrice(item.price * item.quantity)}
          </Text>
        </View>
      ))}
      <View style={styles.divider} />
      {welcomeDiscount && discountAmount > 0 ? (
        <>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Subtotal</Text>
            <Text style={styles.subValue}>{formatPrice(total)}</Text>
          </View>
          <View style={styles.subRow}>
            <Text style={styles.discountLabel}>
              Welcome {welcomeDiscount.percentage}% Off
            </Text>
            <Text style={styles.discountValue}>
              −{formatPrice(discountAmount)}
            </Text>
          </View>
        </>
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPrice(discountedTotal)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500' },
  variation: { fontSize: 13, color: '#888' },
  modifier: { fontSize: 12, color: '#888' },
  qty: { fontSize: 13, color: '#888' },
  price: { fontSize: 15, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: { flex: 1, fontSize: 18, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '700' },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  subLabel: { fontSize: 14, color: '#666' },
  subValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  discountLabel: { fontSize: 14, color: '#15803d', fontWeight: '600' },
  discountValue: { fontSize: 14, color: '#15803d', fontWeight: '700' },
})
