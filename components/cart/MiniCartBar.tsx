import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { useFlyToBagStore } from '@/store/flyToBag'
import { miniCartCue } from '@/lib/motion/mini-cart'
import { Icon } from '@/components/brand/Icon'
import { floatingTabBarClearance } from '@/components/ui/FloatingTabBar'
import { formatPrice } from '@/lib/utils'
import { T, FONT, SHADOW } from '@/constants/theme'

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export function MiniCartBar() {
  const itemCount = useCartStore((s) => s.itemCount())
  const total = useCartStore((s) => s.total())
  const show = useCartSheetStore((s) => s.show)
  const landed = useFlyToBagStore((s) => s.landed)
  const insets = useSafeAreaInsets()
  // Every bit of this bar's motion is decorative — an entrance spring, a bump
  // when a drink lands. With Reduce Motion on, the bar is furniture: it is
  // simply there or not. (It used to keep bouncing regardless; the invariant
  // in lib/motion/motion-invariants.test.ts is what surfaced that.)
  const reduced = useReducedMotion()
  // Sits just above the floating tab pill (which is why this is not
  // useBottomTabBarHeight: the bar is mounted beside the navigator, not in it).
  const tabBarHeight = floatingTabBarClearance(insets.bottom)

  const barScale = useSharedValue(1)
  const badgeScale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  // Both of these were useAnimatedReaction over `itemCount` / `landed`. Those
  // are plain JS numbers, not shared values, so the mapper had no shared input
  // to observe: it only ran when the effect was re-created by its dependency
  // array, and its `previous` lived in a shared value that outlived the
  // re-creation. Under churn — several adds in a row, an item sheet opened and
  // closed repeatedly — a mapper could run against a stale `previous`, which
  // is how the bar went missing while the cart still had items (2026-09-07):
  //
  //   count hits 0  → the old exit branch parked opacity at 0
  //   count returns → the entrance was gated on `prev === 0`; a stale `prev`
  //                   skipped it, and nothing else ever set opacity back
  //
  // A plain effect on the JS thread with a ref for the previous value is what
  // this always wanted: it runs exactly once per committed change, in order.
  // Which cue each change earns lives in lib/motion/mini-cart.ts, where the
  // "a full cart is never invisible" property is held down by a test.
  const prevCount = useRef<number | null>(null)

  useEffect(() => {
    const prev = prevCount.current
    prevCount.current = itemCount
    const cue = miniCartCue(prev, itemCount)
    if (cue.rest || reduced) {
      cancelAnimation(opacity)
      cancelAnimation(translateY)
      cancelAnimation(barScale)
      cancelAnimation(badgeScale)
      opacity.value = 1
      translateY.value = 0
      barScale.value = 1
      badgeScale.value = 1
      return
    }
    if (cue.enter) {
      translateY.value = 40
      opacity.value = 0
      translateY.value = withSpring(0, { damping: 14, stiffness: 180 })
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
    }
    if (cue.bump) {
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
  }, [itemCount, reduced, barScale, badgeScale, opacity, translateY])

  // Fly-to-bag: the dot has just landed on the bag, so the bar catches it —
  // a second, springier bump on arrival rather than only on the store change.
  // `landed` only ever counts up, and the ref starts at its mount value, so
  // the first run after mount is a no-op rather than a phantom bump.
  const prevLanded = useRef(landed)

  useEffect(() => {
    if (landed === prevLanded.current) return
    prevLanded.current = landed
    if (reduced) return
    cancelAnimation(barScale)
    cancelAnimation(badgeScale)
    barScale.value = withSequence(
      withTiming(1.05, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 260 }),
    )
    badgeScale.value = withSequence(
      withTiming(1.35, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 260 }),
    )
  }, [landed, reduced, barScale, badgeScale])

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
