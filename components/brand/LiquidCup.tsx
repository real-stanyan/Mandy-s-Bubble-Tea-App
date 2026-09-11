import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { PIN, T } from '@/constants/theme'
import { SVG_MOTION } from '@/lib/motion/ambient'
import { LAUNCH, pearlDelayMs } from '@/lib/motion/launch-timeline'
import { wavePath } from '@/lib/motion/wave'
import { LAUNCH_PEARLS, LAUNCH_PEARL_R } from '@/lib/motion/pearls'

// The cup that pours itself: liquid rises behind the cup wall with a moving
// wave on its surface, then pearls drop in. Launch screen today; the same
// component can stand in for a spinner anywhere a wait needs a face.
//
// Every moving part is a <G> driven through rn-svg's NATIVE props — `matrix`
// and `opacity`. translateX/Y on a group are JS-side sugar that rn-svg folds
// into `matrix` while rendering, so setting them from a worklet does nothing
// on the new architecture (CupPreview's drop learned this the hard way, #122).
//
// Two drawings, stacked: a small one of what moves (the liquid and the
// pearls, clipped to the cup), no bigger than the cup's inside, and over it
// one of what stands still (the straw, the catch of light, the cup and its
// lid). Every frame of the pour re-rasters the drawing that moves — a
// software bitmap on Android, a Core Graphics redraw on iOS — and the whole
// cup used to be that drawing, strokes and lid and all, twice the pixels.

const AnimatedG = Animated.createAnimatedComponent(G)

// Geometry in a 120×168 box.
const CUP = 'M22 44h76l-8 108a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8z'
const FLOOR = 160
/** Surface line inside the liquid group before any translate. */
const SURFACE_Y = 60
/** Group translateY when full → surface at 86, about two thirds up the cup. */
const FULL_OFFSET = 26
/** Group translateY when empty → surface just under the cup floor. */
const EMPTY_OFFSET = FLOOR + 10 - SURFACE_Y
const WAVELENGTH = 30
const WAVE = wavePath({
  x0: 0,
  width: 120,
  top: SURFACE_Y,
  amplitude: 4,
  wavelength: WAVELENGTH,
  depth: 200,
})
// Seven pearls in a tidy hex stack on the floor (lib/motion/pearls.ts):
// four along the bottom, three nested in the gaps. Floor row drops first.
const PEARLS: [number, number][] = LAUNCH_PEARLS.map((p) => [p.cx, p.cy])
const PEARL_DROP = -130
/** The cup's inside (x 22–98, y 44–160) with a unit or two to spare: the
 *  drawing that moves covers this much of the 120×168 box and no more. */
const INSIDE = { x: 20, y: 40, w: 80, h: 124 } as const

let seq = 0

type Props = {
  /** Rendered width; height follows the 120:168 box. */
  width?: number
  /** Top and bottom of the liquid gradient. Brown sugar by default. */
  liquid?: readonly [string, string]
  pearls?: boolean
  /** Play the pour on mount (false = drawn already full). */
  animate?: boolean
  /** Extra delay before the pour, on top of the launch timeline's own. */
  delayMs?: number
  /** When given, the pour waits for this to turn 1 (the launch screen holds
   *  it until its first frames are on the screen); without it the pour
   *  starts on mount. */
  go?: SharedValue<number>
}

export function LiquidCup({
  width = 150,
  liquid = ['#9A6640', '#5E3A1E'],
  pearls = true,
  animate = true,
  delayMs = 0,
  go,
}: Props) {
  const reduced = useReducedMotion()
  const playing = animate && !reduced
  const ids = useRef({ clip: `lcClip${++seq}`, grad: `lcLiquid${seq}` }).current

  const fill = useSharedValue(playing ? EMPTY_OFFSET : FULL_OFFSET)
  // rn-svg's <G> derives its native `matrix` from its own props on the first
  // render, so an animated matrix only lands with the first animation frame.
  // Until the pour starts the liquid would sit at the identity transform —
  // a full cup for half a second, then a jump to empty (seen on the
  // emulator, 2026-09-06). Hold it invisible until that first frame instead.
  const shown = useSharedValue(playing ? 0 : 1)
  const wave = useSharedValue(0)

  // The pour starts on the UI thread the moment `go` turns 1, or on the
  // first frame when there is no `go` — once per appearance either way.
  const waving = !reduced && SVG_MOTION
  const start = delayMs + LAUNCH.pourDelayMs
  useAnimatedReaction(
    () => (go ? go.value : 1),
    (now, before) => {
      if (now !== 1 || before === 1) return
      if (playing) {
        fill.value = withDelay(
          start,
          withTiming(FULL_OFFSET, { duration: LAUNCH.pourMs, easing: Easing.inOut(Easing.cubic) }),
        )
        shown.value = withDelay(start, withTiming(1, { duration: 60 }))
      }
      // The pour and the pearls play everywhere; the wave that rides on
      // through the launch does not on Android, where every frame of it was
      // a software bitmap of the cup while the app was still starting
      // (lib/motion/ambient SVG_MOTION).
      if (waving) {
        // One wavelength per loop, so the restart lands on an identical frame.
        wave.value = withRepeat(
          withTiming(-WAVELENGTH, { duration: LAUNCH.waveMs, easing: Easing.linear }),
          -1,
          false,
        )
      }
    },
    [],
  )
  useEffect(
    () => () => {
      cancelAnimation(fill)
      cancelAnimation(shown)
      cancelAnimation(wave)
    },
    [fill, shown, wave],
  )

  const liquidProps = useAnimatedProps(() => ({
    matrix: [1, 0, 0, 1, 0, fill.value],
    opacity: shown.value,
  }))
  const waveProps = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, wave.value, 0], opacity: 1 }))

  const height = (width * 168) / 120
  const s = width / 120
  return (
    <View style={{ width, height }}>
      {/* What moves, on a drawing the size of the cup's inside. */}
      <Svg
        style={{ position: 'absolute', left: INSIDE.x * s, top: INSIDE.y * s }}
        width={INSIDE.w * s}
        height={INSIDE.h * s}
        viewBox={`${INSIDE.x} ${INSIDE.y} ${INSIDE.w} ${INSIDE.h}`}
      >
        <Defs>
          <ClipPath id={ids.clip}>
            <Path d={CUP} />
          </ClipPath>
          <LinearGradient id={ids.grad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={liquid[0]} />
            <Stop offset="1" stopColor={liquid[1]} />
          </LinearGradient>
        </Defs>
        <G clipPath={`url(#${ids.clip})`}>
          <AnimatedG animatedProps={liquidProps}>
            <AnimatedG animatedProps={waveProps}>
              <Path d={WAVE} fill={`url(#${ids.grad})`} />
            </AnimatedG>
          </AnimatedG>
          {pearls
            ? PEARLS.map(([cx, cy], i) => (
                <Pearl key={i} cx={cx} cy={cy} index={i} delayMs={delayMs} animate={playing} go={go} />
              ))
            : null}
        </G>
      </Svg>

      {/* What stands still, drawn once, over it. The liquid never reaches the
          straw (it fills to 82 at its crest; the straw ends at 56), and the
          catch of light sits inside the walls, so neither needs the clip. */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox="0 0 120 168">
        {/* Straw sits behind the sealed lid. */}
        <Rect x={70} y={2} width={9} height={54} rx={4} fill={T.ink} opacity={0.85} transform="rotate(8 74 28)" />
        {/* A catch of light down the wall of the cup. */}
        <Path d="M34 54v96" stroke="#fff" strokeWidth={4} opacity={0.22} strokeLinecap="round" />
        <Path d={CUP} fill="none" stroke={T.ink} strokeWidth={3} strokeLinejoin="round" />
        <Rect x={16} y={36} width={88} height={11} rx={4} fill={T.ink} />
      </Svg>
    </View>
  )
}

function Pearl({
  cx,
  cy,
  index,
  delayMs,
  animate,
  go,
}: {
  cx: number
  cy: number
  index: number
  delayMs: number
  animate: boolean
  go?: SharedValue<number>
}) {
  const ty = useSharedValue(animate ? PEARL_DROP : 0)
  const op = useSharedValue(animate ? 0 : 1)
  const delay = delayMs + pearlDelayMs(index)

  // Drops off the same `go` as the pour, so the stagger holds with it.
  useAnimatedReaction(
    () => (go ? go.value : 1),
    (now, before) => {
      if (!animate || now !== 1 || before === 1) return
      ty.value = withDelay(delay, withSpring(0, { damping: 11, stiffness: 190, mass: 0.7 }))
      op.value = withDelay(delay, withTiming(1, { duration: 140 }))
    },
    [],
  )
  useEffect(
    () => () => {
      cancelAnimation(ty)
      cancelAnimation(op)
    },
    [ty, op],
  )

  const props = useAnimatedProps(() => ({
    matrix: [1, 0, 0, 1, 0, ty.value],
    opacity: op.value,
  }))

  return (
    <AnimatedG animatedProps={props}>
      <Circle cx={cx} cy={cy} r={LAUNCH_PEARL_R} fill={PIN.ink} />
    </AnimatedG>
  )
}
