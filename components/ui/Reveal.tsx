import { useContext, useState, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { NavigationContext } from '@react-navigation/native'
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated'
import { launchCovered } from '@/lib/launch'

// Pour-in — the entrance for a block of a screen: rises and fades in over
// 700ms on an expo-out curve (all the travel happens early, then it settles),
// siblings staggered by `index`. Web's Reveal uses the viewport; on a phone the
// screen IS the viewport, so this fires on mount, which is what a screen
// change or a pull-to-refresh feels like it should do. Capped stagger so
// the tenth card never waits a second for its turn. Reduced motion → no
// entrance at all.
//
// Nor is there one where nobody would see it, and that is decided once, at
// mount, the only moment an entrance can play. Under the launch screen,
// Home's blocks used to pour in and settle before the cover lifted, on the
// very frames the cup was pouring; and a tab page the pager lays out to the
// side, ahead of a swipe, is off the screen.

type Props = {
  children: ReactNode
  /** Position among siblings; stagger = min(index, 6) × 70ms. */
  index?: number
  /** Override the computed delay (ms). */
  delay?: number
  style?: StyleProp<ViewStyle>
}

export function Reveal({ children, index = 0, delay, style }: Props) {
  const reduced = useReducedMotion()
  const navigation = useContext(NavigationContext)
  const [seen] = useState(() => !launchCovered() && (navigation?.isFocused() ?? true))
  const ms = delay ?? Math.min(index, 6) * 70
  return (
    <Animated.View
      entering={
        reduced || !seen ? undefined : FadeInDown.delay(ms).duration(700).easing(Easing.out(Easing.exp))
      }
      style={style}
    >
      {children}
    </Animated.View>
  )
}
