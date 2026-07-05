import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/**
 * Soft pulsing placeholder for a remote image that is still loading.
 * Absolute-fill: mount it *under* the image inside a relative wrapper, so
 * the image's fade-in transition covers it and unmounting never flashes.
 */
export function ImageSkeleton() {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(pulse)
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.block, animatedStyle]}
    />
  )
}

const styles = StyleSheet.create({
  // Lighter tone pulsing over the hero's sage background (T.sage #A2AD91).
  block: { backgroundColor: '#C3CCB5' },
})
