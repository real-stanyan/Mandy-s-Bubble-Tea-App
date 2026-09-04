import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

// A Pressable that settles under the finger: a quick spring to `scaleTo`
// on press-in and back on release, with an optional selection haptic.
// The one press feel for buttons, tiles and cards across the app — the
// old per-screen `opacity: pressed ? 0.7 : 1` reads as a flicker next to
// it. Reduced-motion users get the haptic and the tap, no scale.

type Props = Omit<PressableProps, 'style'> & {
  scaleTo?: number
  haptic?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressScale({
  scaleTo = 0.965,
  haptic = false,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useSharedValue(1)
  const reduced = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animated]}
      onPressIn={(e) => {
        if (!reduced && !disabled) {
          scale.value = withSpring(scaleTo, { damping: 18, stiffness: 340 })
        }
        if (haptic && !disabled) Haptics.selectionAsync()
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 260 })
        onPressOut?.(e)
      }}
    />
  )
}
