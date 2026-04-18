import { View, Text, StyleSheet } from 'react-native'
import { BRAND } from '@/lib/constants'
import { useWelcomeDiscountStore } from '@/store/welcomeDiscount'

export function WelcomeDiscountCard() {
  const available = useWelcomeDiscountStore((s) => s.available)
  const percentage = useWelcomeDiscountStore((s) => s.percentage)

  if (!available) return null

  return (
    <View style={styles.card}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotPrimary]} />
        <View style={[styles.dot, styles.dotSecondary]} />
        <View style={[styles.dot, styles.dotTertiary]} />
      </View>
      <Text style={styles.label}>Welcome Gift</Text>
      <Text style={styles.badge}>{percentage}% OFF</Text>
      <Text style={styles.hint}>
        Your first order — auto-applied at checkout
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 6,
    position: 'relative',
  },
  dots: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPrimary: { backgroundColor: BRAND.color },
  dotSecondary: { backgroundColor: BRAND.secondaryColor },
  dotTertiary: { backgroundColor: BRAND.tertiaryColor },
  label: { fontSize: 13, color: '#8a8076', fontWeight: '600', letterSpacing: 0.5 },
  badge: {
    fontSize: 32,
    fontWeight: '800',
    color: BRAND.color,
    letterSpacing: 0.5,
  },
  hint: { fontSize: 13, color: '#555', textAlign: 'center' },
})
