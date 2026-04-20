import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useAuth } from '@/components/auth/AuthProvider'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

export const WelcomeDiscountCard = memo(function WelcomeDiscountCard() {
  const { welcomeDiscount } = useAuth()
  if (!welcomeDiscount.available) return null

  return (
    <View style={styles.card}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotPrimary]} />
        <View style={[styles.dot, styles.dotSecondary]} />
        <View style={[styles.dot, styles.dotTertiary]} />
      </View>
      <Text style={styles.label}>WELCOME GIFT</Text>
      <Text style={styles.badge}>{welcomeDiscount.percentage}% OFF</Text>
      <Text style={styles.hint}>
        {welcomeDiscount.drinksRemaining === 1
          ? '1 drink left — auto-applied at checkout'
          : `${welcomeDiscount.drinksRemaining} drinks left — auto-applied at checkout`}
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
    borderColor: T.line,
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
    color: T.ink3,
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
