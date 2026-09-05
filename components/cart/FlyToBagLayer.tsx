import { useEffect } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
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
import { FLY_DOT, FLY_MS, flightFrame, miniCartBagCenter, type Point } from '@/lib/motion/fly-path'
import { useFlyToBagStore, type Flight } from '@/store/flyToBag'

// Mounted once at the root, above the bottom-sheet host, so a dot can leave
// the item sheet's "Add to cart" and arc down to the mini cart bar under
// it. Touches pass straight through.

export function FlyToBagLayer() {
  const flights = useFlyToBagStore((s) => s.flights)
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const to = miniCartBagCenter({ windowHeight: height, insetBottom: insets.bottom, platform: Platform.OS })
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
