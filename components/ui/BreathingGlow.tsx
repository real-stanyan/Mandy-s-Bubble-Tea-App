import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg'
import { useEffect } from 'react'
import { T } from '@/constants/theme'

const AnimatedSvg = Animated.createAnimatedComponent(Svg)

// withRepeat(..., reverse) plays the timing forwards and then backwards, so one
// full breath in-and-out is twice this. 2.6s each way ≈ a 5.2s breath, which is
// about a resting human one.
const HALF_BREATH_MS = 2600

const OPACITY_MIN = 0.55
const OPACITY_RANGE = 0.35
const SCALE_MIN = 0.88
const SCALE_RANGE = 0.18

// A slow, quiet "breathing" glow — the brand's dark ink background with a
// peach radial glow that expands and softens on a loop. No logo, no spinner:
// stands in for both the entrance splash and the auth-hydration wait, so it
// reads as one continuous moment rather than a flash of logo followed by a
// flash of a loading indicator.
//
// The orb is deliberately narrower than the screen: the radial falloff has to
// land *on* the screen for this to read as a glowing orb sitting in ink. Size
// it past the viewport and the falloff goes off-screen, leaving a flat wash
// whose scale animation nothing can be seen moving against.
export function BreathingGlow() {
  const { width, height } = useWindowDimensions()
  const size = Math.min(width, height) * 0.9
  const reducedMotion = useReducedMotion()
  const breath = useSharedValue(reducedMotion ? 0.5 : 0)

  useEffect(() => {
    // Under Reduce Motion the orb holds still at the midpoint of the breath
    // rather than pulsing the whole screen's brightness on a loop.
    if (reducedMotion) {
      breath.value = 0.5
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: HALF_BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [breath, reducedMotion])

  const style = useAnimatedStyle(() => ({
    opacity: OPACITY_MIN + breath.value * OPACITY_RANGE,
    transform: [{ scale: SCALE_MIN + breath.value * SCALE_RANGE }],
  }))

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <AnimatedSvg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={style}
      >
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={T.peach} stopOpacity={0.9} />
            <Stop offset="55%" stopColor={T.peach} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={T.peach} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
      </AnimatedSvg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.ink,
    overflow: 'hidden',
  },
})
