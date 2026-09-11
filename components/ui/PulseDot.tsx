import { View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated'
import { useLoop } from '@/components/brand/art-kit'
import { useFocusValue } from '@/components/ui/LoopScope'
import { ambientClock, loopKey, loopPhase, memoProps } from '@/lib/motion/ambient'

// "Live" for a state that is happening right now — open, kitchen busy,
// order in progress: a ring leaves the dot every 1.7s and fades as it
// grows. Off (a plain dot) when the state isn't live, and under Reduce
// Motion, where a pulsing ring is exactly the thing being asked not to see.
//
// The ring rides the ambient clock (lib/motion/ambient) like every other
// loop that decorates: it steps at the clock's rate, holds still while a
// list scrolls or the pager moves, and sleeps on a page that is not in
// front. As a loop of its own it ran at the display rate on every page that
// showed the shop open — the home header, the store card, the menu head on
// its page off to the side — and on Android each of those frames was a
// shadow-tree commit, at rest, for as long as the app was open (2026-09-11).

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
  const loop = useLoop(PULSE_MS, 0, on)
  // Awake only while its screen is in front (components/ui/LoopScope).
  const focus = useFocusValue()
  const style = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, focus.value > 0)
    return memoProps(loop.id, key, () => {
      // Out, quadratic: the ring leaves fast and slows as it fades.
      const p = loopPhase(loop, key)
      const t = 1 - (1 - p) * (1 - p)
      return { opacity: 0.85 * (1 - t), transform: [{ scale: 0.5 + t * 1.1 }] }
    })
  })

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
