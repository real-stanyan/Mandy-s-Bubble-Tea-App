import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated'
import { useLoop } from '@/components/brand/art-kit'
import { useFocusValue } from '@/components/ui/LoopScope'
import { ambientClock, loopKey, loopPhase, memoProps } from '@/lib/motion/ambient'
import { CAPSULE_BREATH_MS, CAPSULE_FLOOR, HALO_BREATH_MS, HALO_FLOOR, breath } from '@/lib/motion/glow'
import { IS_EVENING } from '@/constants/theme'

// The bottom dock's light (components/ui/DockGlow), for anything else that
// floats over a page the way the dock floats over the tabs: the item
// sheet's stepper and Add to cart, checkout's Place order (Rick,
// 2026-09-11: no strip under them, floating, lit from behind like the tab
// bar). A halo is the box shadow of a view the exact shape of the thing it
// sits behind, so the light follows the outline, brightest at the edge, and
// none of it falls inside to flood glass from within. It breathes as that
// view's opacity, on the ambient clock through memoProps: twenty steps a
// second at most, still while a list scrolls, nothing sent while its screen
// is covered, and held under Reduce Motion.
//
// Put it first in a wrapper the shape of the thing, and the thing after it.

// By day, apricot and amber on the cream page — the light has to be
// brighter than what it sits on, or it reads as a stain. By night, brass
// and gold: the shop's lamps on the espresso ground. No offset: light
// spreads evenly from its source; a shadow is what falls one way.
// `x y blur spread colour`.
/** Round glass: the tab pill, a stepper. */
export const GLASS_HALO = IS_EVENING
  ? '0px 0px 30px 2px rgba(232,168,84,0.6)'
  : '0px 0px 30px 2px rgba(255,166,102,0.7)'
/** Round a call to action: the bag capsule, Add to cart, Place order. Warmer. */
export const CTA_HALO = IS_EVENING
  ? '0px 0px 24px 2px rgba(242,186,96,0.62)'
  : '0px 0px 24px 2px rgba(255,140,70,0.7)'

type Props = {
  /** Glass takes the pill's light; a call to action takes the capsule's. */
  kind: 'glass' | 'cta'
  /** The corner radius of the thing it sits behind. */
  radius: number
  /** A button that cannot be pressed does not glow. */
  on?: boolean
}

export function Halo({ kind, radius, on = true }: Props) {
  const reduced = useReducedMotion()
  const cta = kind === 'cta'
  const floor = cta ? CAPSULE_FLOOR : HALO_FLOOR
  const loop = useLoop(cta ? CAPSULE_BREATH_MS : HALO_BREATH_MS, 0, on && !reduced)
  // Still while another screen covers this one (components/ui/LoopScope).
  const focus = useFocusValue()
  const life = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, focus.value > 0)
    return memoProps(loop.id, key, () => ({
      opacity: floor + (1 - floor) * breath(loopPhase(loop, key)),
    }))
  })
  if (!on) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, life]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: cta ? CTA_HALO : GLASS_HALO }]}
      />
    </Animated.View>
  )
}
