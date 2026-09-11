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
import { useFocusValue } from '@/components/ui/LoopScope'
import { ambientClock, loopKey, loopPhase, memoProps } from '@/lib/motion/ambient'
import { capsuleOpacity, capsuleSlide, pillWidth } from '@/lib/motion/cart-dock'
import { tabBarShrink } from '@/lib/motion/chrome'
import {
  CAPSULE_BREATH_MS,
  CAPSULE_FLOOR,
  CAPSULE_SWELL,
  GLOW_DROP,
  GLOW_X,
  GLOW_Y,
  HALO_DELAYS,
  HALO_FLOOR,
  HALO_PERIODS,
  HALO_WIDTH,
  POOL_LIFT,
  POOL_SLOTS,
  breath,
  capsuleFlare,
  drift,
  glowDim,
  haloCenter,
  poolCenter,
} from '@/lib/motion/glow'
import { SLIDE_MS } from '@/lib/motion/slide'
import { IS_EVENING } from '@/constants/theme'

// The light behind the bottom dock (Rick, 2026-09-11): a halo along the tab
// pill that drifts and breathes, a brighter pool under the showing tab that
// follows the pages, and a glow behind the bag capsule that breathes and
// flares when a drink lands. It sits in the dock's row, under the pill and
// the capsule, so it shrinks with the dock, and it dims while the dock is
// shrunk. On iOS the pill's glass blurs it — the pill reads as lit from
// behind; on Android the pill is nearly solid and the light shows around
// its edges, a halo. The arithmetic is lib/motion/glow.
//
// What it costs: every spot is a drawing made once (components/ui/Glow).
// Where a spot sits follows the pill and the pager on the UI thread, as
// transforms; how it breathes reads the ambient clock through memoProps, so
// it moves twenty times a second at most, stands still while a list
// scrolls or the pager moves, and while a pushed route covers the tabs
// sends nothing at all. Reduce Motion holds every loop at frame zero and
// the pool steps between tabs.

type Light = { color: string; alpha: number }

// By day, fruit and honey on the cream page: the light has to be brighter
// than what it sits on or it reads as a stain. By night, brass and amber —
// the shop's lamps on the espresso ground.
const HALO: readonly Light[] = IS_EVENING
  ? [
      { color: '#E0913F', alpha: 0.34 },
      { color: '#D9A24E', alpha: 0.3 },
      { color: '#C9713E', alpha: 0.32 },
    ]
  : [
      { color: '#FFB380', alpha: 0.5 },
      { color: '#F2B64A', alpha: 0.4 },
      { color: '#FF9F7A', alpha: 0.46 },
    ]
const POOL: Light = IS_EVENING ? { color: '#F2B64A', alpha: 0.5 } : { color: '#FFA86B', alpha: 0.62 }
const CAPSULE: Light = IS_EVENING ? { color: '#E8B25C', alpha: 0.66 } : { color: '#FF9A52', alpha: 0.7 }

/** The capsule glow is laid out once, for a capsule this wide, and scaled
 *  to the capsule's real width (which follows its total). */
const CAPSULE_W0 = 120

type Props = {
  /** The row's measured width — the pill's, while the bag is empty. */
  rowW: SharedValue<number>
  /** Its width before it is measured: the spots are laid out for it once. */
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

  const cy = height / 2 + GLOW_DROP
  const haloW = Math.round(rowW0 * HALO_WIDTH)
  const haloH = height + GLOW_Y * 2
  const slot0 = Math.max(1, (rowW0 - pad * 2) / Math.max(1, count))
  const poolW = Math.round(slot0 * POOL_SLOTS)
  const poolH = haloH + POOL_LIFT * 2
  const capW = CAPSULE_W0 + GLOW_X * 2

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, stage]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {HALO.map((light, i) => (
        <HaloSpot
          key={i}
          i={i}
          light={light}
          w={haloW}
          h={haloH}
          cy={cy}
          rowW={rowW}
          rowW0={rowW0}
          dock={dock}
          gate={focus}
        />
      ))}
      <Pool light={POOL} w={poolW} h={poolH} cy={cy} pos={pos} slotW={slotW} slot0={slot0} pad={pad} />
      <CapsuleGlow light={CAPSULE} w={capW} h={haloH} cy={cy} rowW={rowW} dock={dock} gate={focus} />
    </Animated.View>
  )
}

/** A view the size of its drawing, centred on x = 0 of the row and on the
 *  light's line; transforms put it where it belongs. */
function box(w: number, h: number, cy: number) {
  return { width: w, height: h, left: -w / 2, top: cy - h / 2 }
}

type SpotProps = {
  i: number
  light: Light
  w: number
  h: number
  cy: number
  rowW: SharedValue<number>
  rowW0: number
  dock: CartDock
  gate: SharedValue<number>
}

// One spot of the halo. Its place follows the pill as the bag comes and
// goes — off the clock, so a capsule sliding in mid-scroll still moves it —
// and inside that, its breath and drift run on the clock.
function HaloSpot({ i, light, w, h, cy, rowW, rowW0, dock, gate }: SpotProps) {
  const loop = useLoop(HALO_PERIODS[i] ?? HALO_PERIODS[0], HALO_DELAYS[i] ?? 0, true)
  const place = useAnimatedStyle(() => {
    const pillW = pillWidth(rowW.value, dock.capsuleW.value, dock.open.value)
    return { transform: [{ translateX: haloCenter(i, pillW) }, { scaleX: pillW / rowW0 }] }
  })
  const life = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, gate.value > 0)
    return memoProps(loop.id, key, () => {
      const p = loopPhase(loop, key)
      return {
        opacity: HALO_FLOOR + (1 - HALO_FLOOR) * breath(p),
        transform: [{ translateX: drift(p, w) }],
      }
    })
  })
  return (
    <Animated.View style={[styles.spot, box(w, h, cy), place]}>
      <Animated.View style={[StyleSheet.absoluteFill, life]}>
        <GlowBlob width={w} height={h} color={light.color} alpha={light.alpha} />
      </Animated.View>
    </Animated.View>
  )
}

type PoolProps = {
  light: Light
  w: number
  h: number
  cy: number
  pos: SharedValue<number>
  slotW: DerivedValue<number>
  slot0: number
  pad: number
}

// The pool under the showing tab. It follows the pager frame by frame —
// under the finger in a swipe, along the pages' own curve after a tap — so
// it is a transform off the clock, never frozen by it.
function Pool({ light, w, h, cy, pos, slotW, slot0, pad }: PoolProps) {
  const place = useAnimatedStyle(() => {
    const slot = slotW.value
    return {
      opacity: slot > 0 ? 1 : 0,
      transform: [{ translateX: poolCenter(pos.value, slot, pad) }, { scaleX: slot / slot0 }],
    }
  })
  return (
    <Animated.View style={[styles.spot, box(w, h, cy), place]}>
      <GlowBlob width={w} height={h} color={light.color} alpha={light.alpha} />
    </Animated.View>
  )
}

type CapsuleGlowProps = {
  light: Light
  w: number
  h: number
  cy: number
  rowW: SharedValue<number>
  dock: CartDock
  gate: SharedValue<number>
}

// The glow behind the bag capsule: slides in and out with it, is as wide as
// it is plus its reach, breathes on the clock, and flares when a drink
// lands (the dock's `flare`, set by components/cart/CartCapsule). While the
// bag is empty its loop is off.
function CapsuleGlow({ light, w, h, cy, rowW, dock, gate }: CapsuleGlowProps) {
  const loop = useLoop(CAPSULE_BREATH_MS, 0, dock.count > 0)
  const place = useAnimatedStyle(() => {
    const cw = dock.capsuleW.value
    const open = dock.open.value
    const flare = capsuleFlare(dock.flare.value)
    return {
      opacity: capsuleOpacity(open) * flare.opacity,
      transform: [
        { translateX: rowW.value - cw / 2 + capsuleSlide(open, cw) },
        { scaleX: ((cw + GLOW_X * 2) / w) * flare.grow },
        { scaleY: flare.grow },
      ],
    }
  })
  const life = useAnimatedStyle(() => {
    const key = loopKey(loop, ambientClock.value, gate.value > 0)
    return memoProps(loop.id, key, () => {
      const b = breath(loopPhase(loop, key))
      return {
        opacity: CAPSULE_FLOOR + (1 - CAPSULE_FLOOR) * b,
        transform: [{ scale: 1 - CAPSULE_SWELL + 2 * CAPSULE_SWELL * b }],
      }
    })
  })
  return (
    <Animated.View style={[styles.spot, box(w, h, cy), place]}>
      <Animated.View style={[StyleSheet.absoluteFill, life]}>
        <GlowBlob width={w} height={h} color={light.color} alpha={light.alpha} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  spot: { position: 'absolute' },
})
