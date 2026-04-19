import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { Icon } from '@/components/brand/Icon'
import { formatPrice } from '@/lib/utils'
import { T, FONT, SHADOW } from '@/constants/theme'

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export function MiniCartBar() {
  const itemCount = useCartStore((s) => s.itemCount())
  const total = useCartStore((s) => s.total())
  const show = useCartSheetStore((s) => s.show)
  const insets = useSafeAreaInsets()
  const tabBarHeight =
    Platform.OS === 'ios' ? 49 + insets.bottom + 8 : 56 + 8 + 8

  const barScale = useSharedValue(1)
  const badgeScale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  useAnimatedReaction(
    () => itemCount,
    (curr, prev) => {
      if (prev === null) return
      if (curr === 0) {
        opacity.value = withTiming(0, { duration: 160 })
        translateY.value = withTiming(30, { duration: 160 })
        return
      }
      if (prev === 0 && curr > 0) {
        translateY.value = 40
        opacity.value = 0
        translateY.value = withSpring(0, { damping: 14, stiffness: 180 })
        opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
      }
      if (curr > prev) {
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
    <View
      style={[styles.wrap, { bottom: tabBarHeight + 8 }]}
      pointerEvents="box-none"
    >
      <AnimatedTouchable style={[styles.bar, barStyle]} onPress={show} activeOpacity={0.85}>
        <View style={styles.bagWrap}>
          <Icon name="bag" size={20} color="#fff" />
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
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.brand,
    borderRadius: 28,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW.miniCart.shadowColor,
        shadowOpacity: SHADOW.miniCart.shadowOpacity,
        shadowRadius: SHADOW.miniCart.shadowRadius,
        shadowOffset: SHADOW.miniCart.shadowOffset,
      },
      android: { elevation: SHADOW.miniCart.elevation },
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
    top: -3,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FONT.sans,
    color: T.brand,
    fontSize: 10,
    fontWeight: '800',
  },
  total: {
    fontFamily: FONT.sans,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: { flex: 1 },
  checkoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
  },
  checkoutText: {
    fontFamily: FONT.sans,
    color: T.brand,
    fontSize: 13,
    fontWeight: '700',
  },
})
