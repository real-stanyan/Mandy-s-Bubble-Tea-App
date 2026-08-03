import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg'
import { useEffect } from 'react'
import { T } from '@/constants/theme'

const AnimatedSvg = Animated.createAnimatedComponent(Svg)

// A slow, quiet "breathing" glow — the brand's dark ink background with a
// peach radial glow that expands and softens on a loop. No logo, no spinner:
// stands in for both the entrance splash and the auth-hydration wait, so it
// reads as one continuous moment rather than a flash of logo followed by a
// flash of a loading indicator.
export function BreathingGlow() {
  const { width, height } = useWindowDimensions()
  const size = Math.max(width, height) * 1.4
  const breath = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [breath])

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + breath.value * 0.35,
    transform: [{ scale: 0.88 + breath.value * 0.18 }],
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
