import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import type { CartDock } from '@/components/cart/CartCapsule'
import { useLoop } from '@/components/brand/art-kit'
import { GlowBlob } from '@/components/ui/Glow'
import { CTA_HALO as CAPSULE_HALO, GLASS_HALO as PILL_HALO } from '@/components/ui/Halo'
import { useFocusValue } from '@/components/ui/LoopScope'
import { ambientClock, loopKey, loopPhase, memoProps } from '@/lib/motion/ambient'
import { capsuleOpacity, capsuleSlide, pillWidth } from '@/lib/motion/cart-dock'
import { tabBarShrink } from '@/lib/motion/chrome'
import {
  CAPSULE_BREATH_MS,
  CAPSULE_FLOOR,
  HALO_BREATH_MS,
  HALO_FLOOR,
  POOL_REACH,
  POOL_SLOTS,
  breath,
  capsuleFlare,
  glowDim,
  poolCenter,
} from '@/lib/motion/glow'
import { SLIDE_MS } from '@/lib/motion/slide'
import { IS_EVENING } from '@/constants/theme'

// The light round the bottom dock (Rick, 2026-09-11): a halo round the tab
// pill that breathes, a brighter pool under the showing tab that follows
// the pages, and a warmer halo round the bag capsule that breathes and
// flares when a drink lands. It sits in the dock's row, under the pill and
// the capsule, so it shrinks with the dock, and it dims while the dock is
// shrunk. The arithmetic is lib/motion/glow.
//
// The halos are box shadows cast by views the exact shape of the pill and
// the capsule, with the pill's width and the capsule's slide: the light
// follows their outline, brightest at the edge and falling away outward.
// (A first cut put soft spots behind them, and the dock hid the bright
// middle of every spot: what showed was a faint rim and a blotch.) A box
// shadow is drawn outside its view only, so the glass pill is not flooded
// from inside; what lights the glass, on iOS, is the pool under the
// showing tab.
//
// What it costs: a halo is a shadow rendered once for its shape — iOS from
// a path, Android from a blur mask filter, Android 9 and later (older
// phones get no halo) — and redrawn only when the shape's width changes,
// which is the bag arriving or leaving. Its breath is the opacity of the
// view around it, on the ambient clock through memoProps: twenty steps a
// second at most, still while a list scrolls or the pager moves, nothing
// sent while a pushed route covers the tabs. The pool is a drawing made
// once (components/ui/Glow), moved as a transform. Reduce Motion holds the
// breath at frame zero and the pool steps between tabs.

// The halos' light is components/ui/Halo's, shared with the controls that
// float over the item sheet and checkout. `x y blur spread colour`.
/** The wider bloom round the capsule at the top of a flare. */
const CAPSULE_BURST = IS_EVENING ? '0px 0px 42px 8px rgba(246,198,112,0.75)' : '0px 0px 42px 8px rgba(255,158,88,0.8)'
const POOL = IS_EVENING ? { color: '#F2B64A', alpha: 0.55 } : { color: '#FFA868', alpha: 0.55 }

type Props = {
  /** The row's measured width — the pill's, while the bag is empty. */
  rowW: SharedValue<number>
  /** Its width before it is measured: the pool is laid out for it once. */
  rowW0: number
  dock: CartDock
  /** One tab's slot in the pill, as the pill narrows for the capsule. */
  slotW: DerivedValue<number>
  /** Where the pager is, in pages (components/navigation/SwipeTabs). */
  position?: SharedValue<number>
  index: number
  count: number
  /** The dock's height and the pill's inner padding. */
  height: number
  pad: number
}

export function DockGlow({ rowW, rowW0, dock, slotW, position, index, count, height, pad }: Props) {
  const reduced = useReducedMotion()
  // The loops stop while a pushed route covers the tabs: nothing to see.
  const focus = useFocusValue()
  // Without a pager position the pool moves on the Slide curve.
  const placed = useSharedValue(index)
  useEffect(() => {
    placed.value = reduced ? index : withTiming(index, { duration: SLIDE_MS, easing: Easing.out(Easing.exp) })
  }, [index, reduced, placed])
  const pos = position ?? placed

  const stage = useAnimatedStyle(() => ({ opacity: glowDim(tabBarShrink.value) }))

  const slot0 = Math.max(1, (rowW0 - pad * 2) / Math.max(1, count))
  const poolW = Math.round(slot0 * POOL_SLOTS)
  const poolH = height + POOL_REACH * 2

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, stage]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <PillHalo height={height} rowW={rowW} dock={dock} gate={focus} />
      <Pool w={poolW} h={poolH} height={height} pos={pos} slotW={slotW} slot0={slot0} pad={pad} />
      <CapsuleHalo height={height} rowW={rowW} dock={dock} gate={focus} />
    </Animated.View>
  )
}

type HaloProps = {
  height: number
  rowW: SharedValue<number>
  dock: CartDock
  gate: SharedValue<number>
}

// The pill's halo: a view as wide as the pill, casting the light. Its width
// follows the pill as the bag comes and goes, off the clock; its breath is
// the opacity of the view around it, on the clock.
function PillHalo({ height, rowW, dock, gate }: HaloProps) {
  const loop = useLoop(HALO_BREATH_MS, 0, true)
  const life = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, gate.value > 0)
    return memoProps(loop.id, key, () => ({
      opacity: HALO_FLOOR + (1 - HALO_FLOOR) * breath(loopPhase(loop, key)),
    }))
  })
  const shape = useAnimatedStyle(() => ({
    width: pillWidth(rowW.value, dock.capsuleW.value, dock.open.value),
  }))
  return (
    <Animated.View style={[StyleSheet.absoluteFill, life]}>
      <Animated.View
        style={[styles.pill, { height, borderRadius: height / 2, boxShadow: PILL_HALO }, shape]}
      />
    </Animated.View>
  )
}

type PoolProps = {
  w: number
  h: number
  height: number
  pos: SharedValue<number>
  slotW: DerivedValue<number>
  slot0: number
  pad: number
}

// The pool under the showing tab. It follows the pager frame by frame —
// under the finger in a swipe, along the pages' own curve after a tap — so
// it is a transform off the clock, never frozen by it.
function Pool({ w, h, height, pos, slotW, slot0, pad }: PoolProps) {
  const place = useAnimatedStyle(() => {
    const slot = slotW.value
    return {
      opacity: slot > 0 ? 1 : 0,
      transform: [{ translateX: poolCenter(pos.value, slot, pad) }, { scaleX: slot / slot0 }],
    }
  })
  return (
    <Animated.View style={[styles.pool, { width: w, height: h, left: -w / 2, top: (height - h) / 2 }, place]}>
      <GlowBlob width={w} height={h} color={POOL.color} alpha={POOL.alpha} />
    </Animated.View>
  )
}

// The capsule's halo: slides in and out with the capsule and is as wide as
// it is; breathes on the clock; flares when a drink lands (the dock's
// `flare`, set by components/cart/CartCapsule) — the halo comes up to full
// and a wider burst blooms round the capsule and fades. The burst is its
// own shadow at the capsule's size, never the halo scaled: a box shadow is
// cut out of its own view, and a halo grown past the capsule leaves a ring
// of bare page between them. While the bag is empty the loop is off.
function CapsuleHalo({ height, dock, gate }: HaloProps) {
  const loop = useLoop(CAPSULE_BREATH_MS, 0, dock.count > 0)
  const life = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, gate.value > 0)
    return memoProps(loop.id, key, () => ({
      opacity: CAPSULE_FLOOR + (1 - CAPSULE_FLOOR) * breath(loopPhase(loop, key)),
    }))
  })
  const shape = useAnimatedStyle(() => {
    const cw = dock.capsuleW.value
    const open = dock.open.value
    return {
      width: cw,
      opacity: capsuleOpacity(open) * capsuleFlare(dock.flare.value).halo,
      transform: [{ translateX: capsuleSlide(open, cw) }],
    }
  })
  const bloom = useAnimatedStyle(() => {
    const cw = dock.capsuleW.value
    const open = dock.open.value
    return {
      width: cw,
      opacity: capsuleOpacity(open) * capsuleFlare(dock.flare.value).burst,
      transform: [{ translateX: capsuleSlide(open, cw) }],
    }
  })
  const round = { height, borderRadius: height / 2 }
  // The wrapper spans the row, so the halo sits against its right edge as
  // the capsule does. The burst does not breathe: it is the flare alone.
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, life]}>
        <Animated.View style={[styles.capsule, round, { boxShadow: CAPSULE_HALO }, shape]} />
      </Animated.View>
      <Animated.View style={[styles.capsule, round, { boxShadow: CAPSULE_BURST }, bloom]} />
    </>
  )
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', left: 0, top: 0 },
  pool: { position: 'absolute' },
  capsule: { position: 'absolute', right: 0, top: 0 },
})
