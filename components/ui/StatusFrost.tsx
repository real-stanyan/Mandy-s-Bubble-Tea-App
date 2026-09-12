import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { Frost, FROST_TINT, glassTabBarAvailable } from '@/components/ui/GlassTabBar'
import { T } from '@/constants/theme'

// The strip under the clock on Account, the page that has no head of its
// own and still wants one. The page runs to the top edge of the screen and
// scrolls under the status bar; this is nothing at all while the page rests,
// and frosts up over the first few points of scroll so the time and battery
// stay legible over whatever slides beneath. The same sheet as the menu head:
// blur under paper where the binary can blur, paper where it cannot.
//
// Home and My Orders had one too, until it read as a band across the top of
// a scrolling page (Rick, 2026-09-12); they run clear to the edge now.

/** Scroll distance over which the strip comes in — about the gap the first
 *  card keeps from the clock, so it is whole by the time anything reaches it. */
export const STATUS_FROST_RANGE = 32

type Props = {
  scrollY: SharedValue<number>
  insetTop: number
}

export function StatusFrost({ scrollY, insetTop }: Props) {
  const progress = useDerivedValue(() =>
    interpolate(scrollY.value, [0, STATUS_FROST_RANGE], [0, 1], Extrapolation.CLAMP),
  )
  const groundStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  if (insetTop <= 0) return null
  return (
    <View
      style={[styles.strip, { height: insetTop }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Frost progress={progress} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.ground, groundStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  ground: {
    backgroundColor: glassTabBarAvailable ? FROST_TINT : T.paper,
  },
})
