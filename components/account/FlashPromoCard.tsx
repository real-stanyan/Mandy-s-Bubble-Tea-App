import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useAuth } from '@/components/auth/AuthProvider'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

// Store-wide one-day flash promo (e.g. 20% off the whole order, today only).
// Server-driven: /api/me returns flashPromo.available only while a promo is
// active for today AND this customer hasn't used it yet — so the card
// disappears on its own after redemption or at midnight (Brisbane).
export const FlashPromoCard = memo(function FlashPromoCard() {
  const { flashPromo } = useAuth()
  if (!flashPromo.available) return null

  return (
    <View style={styles.card}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotPrimary]} />
        <View style={[styles.dot, styles.dotSecondary]} />
        <View style={[styles.dot, styles.dotTertiary]} />
      </View>
      <Text style={styles.label}>⚡ FLASH SALE — TODAY ONLY</Text>
      <Text style={styles.badge}>{flashPromo.percentage}% OFF</Text>
      <Text style={styles.hint}>
        Your whole order, auto-applied at checkout. One order per customer —
        ends midnight tonight.
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.paper,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.brand,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    ...SHADOW.card,
  },
  dots: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPrimary: { backgroundColor: T.brand },
  dotSecondary: { backgroundColor: T.sage },
  dotTertiary: { backgroundColor: T.peach },
  label: {
    ...TYPE.eyebrow,
    color: T.brand,
  },
  badge: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 32,
    letterSpacing: -0.5,
    color: T.brand,
  },
  hint: {
    ...TYPE.body,
    color: T.ink2,
    textAlign: 'center',
  },
})
