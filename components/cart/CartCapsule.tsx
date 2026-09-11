import { useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { useFlyToBagStore } from '@/store/flyToBag'
import { miniCartCue } from '@/lib/motion/mini-cart'
import { expandChrome } from '@/lib/motion/chrome'
import { capsuleOpacity, capsuleSlide, capsuleWidth } from '@/lib/motion/cart-dock'
import { FLARE_IN_MS, FLARE_OUT_MS, FLARE_WAIT_MS } from '@/lib/motion/glow'
import { Icon } from '@/components/brand/Icon'
import { formatPrice } from '@/lib/utils'
import { CTA, T } from '@/constants/theme'

// The bag, as the right-hand end of the bottom dock (lib/motion/cart-dock):
// a capsule the height of the tab pill, in the call-to-action colour, with
// the bag glyph, how many drinks are in it, and the total. A tap opens the
// cart sheet. While the bag is empty there is no capsule and the pill has
// the row; the first drink slides it in from the right edge as the pill
// makes room, another drink bumps it, and the fly-to-bag dot lands on the
// glyph. It replaces the mini cart bar, which was a second, wider, solid bar
// stacked above the glass pill (Rick, 2026-09-11: the two did not agree).
// Behind it glows a light of its own colour (components/ui/DockGlow), which
// this flares — through the dock's `flare` — when a drink goes in.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** The capsule's glow brightens and grows, then settles back to its breath. */
function flareUp(flare: SharedValue<number>) {
  cancelAnimation(flare)
  flare.value = withSequence(
    withTiming(1, { duration: FLARE_IN_MS, easing: Easing.out(Easing.quad) }),
    withTiming(0, { duration: FLARE_OUT_MS, easing: Easing.out(Easing.cubic) }),
  )
}

/** The capsule's entrance and exit: a spring with a little give, so the
 *  pill lands on its new width like something with weight. */
const DOCK_SPRING = { damping: 15, stiffness: 170, mass: 1 }

export type CartDock = {
  /** 0 = the bag is out of sight and the pill has the row; 1 = the capsule is in. */
  open: SharedValue<number>
  /** The capsule's width for its current total. */
  capsuleW: SharedValue<number>
  /** 0 at rest; 1 at the top of the flare its glow gives when a drink goes in. */
  flare: SharedValue<number>
  count: number
  label: string
}

/** The dock's shared state: the tab bar sizes its pill from it, the capsule draws from it. */
export function useCartDock(): CartDock {
  const count = useCartStore((s) => s.itemCount())
  const total = useCartStore((s) => s.total())
  const reduced = useReducedMotion()
  const label = formatPrice(total)
  const width = capsuleWidth(label)
  const open = useSharedValue(count > 0 ? 1 : 0)
  const capsuleW = useSharedValue(width)
  const flare = useSharedValue(0)
  const filled = count > 0
  useEffect(() => {
    // A total that grew a digit widens the capsule a touch; the pill follows.
    capsuleW.value = reduced ? width : withTiming(width, { duration: 200, easing: Easing.out(Easing.quad) })
  }, [width, reduced, capsuleW])
  useEffect(() => {
    const target = filled ? 1 : 0
    if (reduced) {
      open.value = target
      return
    }
    open.value = withSpring(target, DOCK_SPRING)
  }, [filled, reduced, open])
  return useMemo(() => ({ open, capsuleW, flare, count, label }), [open, capsuleW, flare, count, label])
}

export function CartCapsule({ dock }: { dock: CartDock }) {
  const show = useCartSheetStore((s) => s.show)
  const landed = useFlyToBagStore((s) => s.landed)
  const reduced = useReducedMotion()
  const { open, capsuleW, flare, count, label } = dock

  // The capsule's own scale: the press, and a bump when a drink joins.
  const scale = useSharedValue(1)
  const badge = useSharedValue(1)

  // Which cue each change in the count earns is lib/motion/mini-cart, where
  // the "a full bag is never invisible" property is held down by a test.
  const prevCount = useRef<number | null>(null)
  useEffect(() => {
    const prev = prevCount.current
    prevCount.current = count
    const cue = miniCartCue(prev, count)
    if (cue.rest || reduced) {
      cancelAnimation(scale)
      cancelAnimation(badge)
      cancelAnimation(flare)
      scale.value = 1
      badge.value = 1
      flare.value = 0
      return
    }
    // Something went into the bag: the dock comes back whole to show it.
    if (cue.enter || cue.bump) expandChrome()
    if (cue.bump) {
      scale.value = withSequence(
        withTiming(1.04, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      )
      badge.value = withSequence(
        withTiming(1.2, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
      )
    }
    if (!cue.enter && !cue.bump) return
    // …and its glow flares — unless a dot is on its way from the item
    // sheet, launched a beat after the store changed: then the glow flares
    // when the dot lands (below), once rather than twice.
    const wait = setTimeout(() => {
      if (useFlyToBagStore.getState().flights.length === 0) flareUp(flare)
    }, FLARE_WAIT_MS)
    return () => clearTimeout(wait)
  }, [count, reduced, scale, badge, flare])

  // Fly-to-bag: the dot has just landed on the glyph, so the capsule catches
  // it — a second, springier bump on arrival. `landed` only ever counts up,
  // and the ref starts at its mount value, so the first run is a no-op.
  const prevLanded = useRef(landed)
  useEffect(() => {
    if (landed === prevLanded.current) return
    prevLanded.current = landed
    if (reduced) return
    cancelAnimation(scale)
    cancelAnimation(badge)
    scale.value = withSequence(
      withTiming(1.05, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 260 }),
    )
    badge.value = withSequence(
      withTiming(1.35, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 10, stiffness: 260 }),
    )
    flareUp(flare)
  }, [landed, reduced, scale, badge, flare])

  const capsuleStyle = useAnimatedStyle(() => ({
    width: capsuleW.value,
    opacity: capsuleOpacity(open.value),
    transform: [{ translateX: capsuleSlide(open.value, capsuleW.value) }, { scale: scale.value }],
  }))
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }))

  return (
    <AnimatedPressable
      onPress={show}
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.965, { damping: 18, stiffness: 340 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 })
      }}
      pointerEvents={count > 0 ? 'auto' : 'none'}
      accessibilityRole="button"
      accessibilityLabel={`Bag, ${count} ${count === 1 ? 'drink' : 'drinks'}, ${label}. View cart.`}
      accessibilityElementsHidden={count === 0}
      importantForAccessibility={count === 0 ? 'no-hide-descendants' : 'auto'}
      style={[styles.capsule, capsuleStyle]}
    >
      <View style={styles.bagWell}>
        <Icon name="bag" size={20} color={CTA.on} />
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {count > 99 ? '99+' : count}
          </Text>
        </Animated.View>
      </View>
      <Text style={styles.total} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: CTA.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    // A solid ground, so iOS draws this from a path; the pill beside it is
    // glass and carries none — the capsule is the one object in the dock
    // that is meant to sit up off the page.
    shadowColor: T.brandDark,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bagWell: {
    width: 20,
    height: 20,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: CTA.on,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    lineHeight: 12,
    color: CTA.bg,
  },
  total: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 14,
    color: CTA.on,
  },
})
