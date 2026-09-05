import { useEffect } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// "Live" for a state that is happening right now — open, kitchen busy,
// order in progress: a ring leaves the dot every 1.7s and fades as it
// grows. Off (a plain dot) when the state isn't live, and under Reduce
// Motion, where a pulsing ring is exactly the thing being asked not to see.

export const PULSE_MS = 1700

type RingProps = {
  color: string
  /** Diameter of the dot the ring leaves from. */
  size: number
  active?: boolean
}

/** The ring alone — absolutely positioned around whatever it's placed inside. */
export function PulseRing({ color, size, active = true }: RingProps) {
  const reduced = useReducedMotion()
  const on = active && !reduced
  const t = useSharedValue(0)

  useEffect(() => {
    if (!on) {
      cancelAnimation(t)
      t.value = 0
      return
    }
    t.value = 0
    t.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    )
    return () => cancelAnimation(t)
  }, [on, t])

  const style = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ scale: 0.5 + t.value * 1.1 }],
  }))

  if (!on) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          borderWidth: 1.2,
          borderColor: color,
        },
        style,
      ]}
    />
  )
}

type DotProps = RingProps & { style?: StyleProp<ViewStyle> }

export function PulseDot({ color, size = 7, active = true, style }: DotProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <PulseRing color={color} size={size} active={active} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  )
}
