import { useEffect } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { T } from '@/constants/theme'
import { FLY_DOT, FLY_MS, flightFrame, type Point } from '@/lib/motion/fly-path'
import { capsuleWidth, cartDockBagCenter } from '@/lib/motion/cart-dock'
import { FLOATING_BAR_H, FLOATING_BAR_MARGIN, floatingBarLift } from '@/components/ui/FloatingTabBar'
import { useCartStore } from '@/store/cart'
import { useFlyToBagStore, type Flight } from '@/store/flyToBag'
import { formatPrice } from '@/lib/utils'

// Mounted once at the root, above the bottom-sheet host, so a dot can leave
// the item sheet's "Add to cart" and arc down to the bag capsule in the dock
// under it. Touches pass straight through.

export function FlyToBagLayer() {
  const flights = useFlyToBagStore((s) => s.flights)
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // The capsule is as wide as its total, and the flight launches a beat
  // after the store has the new drink, so this is the width it will have.
  const total = useCartStore((s) => s.total())
  const to = cartDockBagCenter({
    windowWidth: width,
    windowHeight: height,
    margin: FLOATING_BAR_MARGIN,
    lift: floatingBarLift(insets.bottom),
    height: FLOATING_BAR_H,
    capsuleW: capsuleWidth(formatPrice(total)),
  })
  if (flights.length === 0) return null
  return (
    <View pointerEvents="none" style={styles.layer}>
      {flights.map((f) => (
        <FlyDot key={f.id} flight={f} to={to} />
      ))}
    </View>
  )
}

function FlyDot({ flight, to }: { flight: Flight; to: Point }) {
  const finish = useFlyToBagStore((s) => s.finish)
  const reduced = useReducedMotion()
  const p = useSharedValue(0)
  const from = flight.from

  useEffect(() => {
    if (reduced) {
      finish(flight.id)
      return
    }
    p.value = withTiming(
      1,
      { duration: FLY_MS, easing: Easing.bezier(0.4, 0, 0.55, 1) },
      (done) => {
        if (done) runOnJS(finish)(flight.id)
      },
    )
    // One flight per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => {
    const f = flightFrame(p.value, from, to)
    return {
      opacity: f.opacity,
      transform: [
        { translateX: f.x - FLY_DOT / 2 },
        { translateY: f.y - FLY_DOT / 2 },
        { scale: f.scale },
      ],
    }
  })

  if (reduced) return null
  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9980,
    elevation: 9980,
  },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FLY_DOT,
    height: FLY_DOT,
    borderRadius: FLY_DOT / 2,
    backgroundColor: T.brand,
    shadowColor: '#6B3E15',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
})
