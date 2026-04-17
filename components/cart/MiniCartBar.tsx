import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { formatPrice } from '@/lib/utils'
import { BRAND } from '@/lib/constants'

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export function MiniCartBar() {
  const itemCount = useCartStore((s) => s.itemCount())
  const total = useCartStore((s) => s.total())
  const show = useCartSheetStore((s) => s.show)

  const barScale = useSharedValue(1)
  const badgeScale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  // Run on UI thread, fires reliably on every itemCount change
  useAnimatedReaction(
    () => itemCount,
    (curr, prev) => {
      if (prev === null) return
      if (curr === 0) {
        // Leaving: fade/slide out
        opacity.value = withTiming(0, { duration: 160 })
        translateY.value = withTiming(30, { duration: 160 })
        return
      }
      if (prev === 0 && curr > 0) {
        // Entrance: slide up + fade in
        translateY.value = 40
        opacity.value = 0
        translateY.value = withSpring(0, { damping: 14, stiffness: 180 })
        opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
      }
      if (curr > prev) {
        // Pulse on add — subtle, cancel previous so rapid adds don't stack/freeze
        cancelAnimation(barScale)
        cancelAnimation(badgeScale)
        barScale.value = 1
        badgeScale.value = 1
        barScale.value = withSequence(
          withTiming(1.04, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        )
        badgeScale.value = withSequence(
          withTiming(1.2, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        )
      }
    },
    [itemCount],
  )

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: barScale.value }],
    opacity: opacity.value,
  }))

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }))

  if (itemCount === 0) return null

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <AnimatedTouchable
        style={[styles.bar, barStyle]}
        onPress={show}
        activeOpacity={0.85}
      >
        <View style={styles.bagWrap}>
          <Ionicons name="bag-handle" size={22} color="#fff" />
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </Animated.View>
        </View>
        <Text style={styles.total}>{formatPrice(total)}</Text>
        <View style={styles.spacer} />
        <View style={styles.checkoutBtn}>
          <Text style={styles.checkoutText}>View Cart</Text>
        </View>
      </AnimatedTouchable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.color,
    borderRadius: 28,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  bagWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: BRAND.color,
    fontSize: 11,
    fontWeight: '800',
  },
  total: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  checkoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  checkoutText: {
    color: BRAND.color,
    fontSize: 14,
    fontWeight: '700',
  },
})
