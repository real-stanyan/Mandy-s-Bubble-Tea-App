import { useRef } from 'react'
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

// Settle — a Pressable that settles under the finger: a quick spring to
// `scaleTo` on press-in and a looser one back on release (it overshoots a
// hair past 1 and lands), with an optional selection haptic.
// The one press feel for buttons, tiles and cards across the app — the
// old per-screen `opacity: pressed ? 0.7 : 1` reads as a flicker next to
// it. Reduced-motion users get the haptic and the tap, no scale.
//
// Driven by React Native's own Animated on the native driver rather than a
// Reanimated worklet: a PressScale sits on every menu card, tile and button,
// and a Reanimated style costs a UI-thread mapper per mount — which a list
// scrolling through thirty cards paid for, three at a time, every few
// frames. An Animated value is a plain number until its first spring, and
// the spring itself runs natively once it starts.

type Props = Omit<PressableProps, 'style'> & {
  scaleTo?: number
  haptic?: boolean
  style?: StyleProp<ViewStyle>
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const PRESS_IN = { damping: 18, stiffness: 340, mass: 1, useNativeDriver: true } as const
const PRESS_OUT = { damping: 14, stiffness: 220, mass: 1, useNativeDriver: true } as const

export function PressScale({
  scaleTo = 0.965,
  haptic = false,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const reduced = useReducedMotion()

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e) => {
        if (!reduced && !disabled) {
          Animated.spring(scale, { ...PRESS_IN, toValue: scaleTo }).start()
        }
        if (haptic && !disabled) Haptics.selectionAsync()
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { ...PRESS_OUT, toValue: 1 }).start()
        onPressOut?.(e)
      }}
    />
  )
}
