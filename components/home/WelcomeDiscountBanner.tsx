import { useState } from 'react'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import Animated, { FadeOutUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { useAuth } from '@/components/auth/AuthProvider'

export function WelcomeDiscountBanner() {
  const { welcomeDiscount } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (!welcomeDiscount.available || dismissed) return null

  return (
    <Animated.View style={styles.wrap} exiting={FadeOutUp.duration(260)}>
      <View style={styles.row}>
        <Text style={styles.emoji}>🎁</Text>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Your Welcome Gift</Text>
          <Text style={styles.subtitle}>
            {welcomeDiscount.percentage}% off your first 2 drinks
            {welcomeDiscount.drinksRemaining < 2
              ? ` — ${welcomeDiscount.drinksRemaining} drink${welcomeDiscount.drinksRemaining === 1 ? '' : 's'} left, auto-applied at checkout`
              : ' — auto-applied at checkout'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: BRAND.color,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: { fontSize: 22 },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
})
