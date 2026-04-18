import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import Animated, { FadeOutUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { useWelcomeDiscountStore } from '@/store/welcomeDiscount'

export function WelcomeDiscountBanner() {
  const available = useWelcomeDiscountStore((s) => s.available)
  const percentage = useWelcomeDiscountStore((s) => s.percentage)
  const dismissed = useWelcomeDiscountStore((s) => s.dismissed)
  const dismiss = useWelcomeDiscountStore((s) => s.dismiss)

  if (!available || dismissed) return null

  return (
    <Animated.View style={styles.wrap} exiting={FadeOutUp.duration(260)}>
      <View style={styles.row}>
        <Text style={styles.emoji}>🎁</Text>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Your Welcome Gift</Text>
          <Text style={styles.subtitle}>
            {percentage}% off your first order — auto-applied at checkout
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={8} style={styles.close}>
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
