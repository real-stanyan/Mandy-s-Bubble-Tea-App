import { useEffect, useRef, type ReactNode } from 'react'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { wavePath } from '@/lib/motion/wave'
import { LOOPS, matrixAt, rotateAbout, translate, waveOffset, type Frame, type LoopName } from '@/lib/motion/category-art'
import { HERO_LOOPS, type HeroLoopName } from '@/lib/motion/checkout-hero'

// The drawing kit the illustrations share (CategoryArt, CheckoutHero): the
// Mini Cup's cup, the moving-part plumbing, and the palette rules. A moving
// part is a <G> whose native `matrix` / `opacity` props follow a loop's
// frame from a phase 0→1 (lib/motion); nothing else is animated, which is
// the rule rn-svg groups impose on Fabric. The caller decides `live`
// (Reduce Motion → false → every part holds frame zero).

export const AnimG = Animated.createAnimatedComponent(G)
export const INK = '#2A1E14'
export const BODY = 'M12 18h36l-4 56a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z'
export const AMP = 0.8
export const WL = 12
let seq = 0
/** A unique id prefix for gradients and clips — a page draws many cups. */
export function nextId(): string {
  return `ak${++seq}`
}

/** A phase 0→1 repeating every `period` ms, started after `delay`; frozen at 0 when not live, and always under Reduce Motion. */
export function useLoop(period: number, delay: number, live: boolean) {
  const reduced = useReducedMotion()
  const on = live && !reduced
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = 0
    if (!on) return
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false))
    return () => cancelAnimation(p)
  }, [on, period, delay, p])
  return p
}

export type FrameFn = (p: number) => Frame
const TABLE = { ...LOOPS, ...HERO_LOOPS } as const
export type AnyLoopName = LoopName | HeroLoopName

type MotionProps = {
  /** Where the shape's origin sits; the shape is drawn around (0, 0). */
  x: number
  y: number
  /** A named loop from lib/motion, or a frame function of your own (a worklet). */
  loop?: AnyLoopName
  frame?: FrameFn
  period: number
  delay?: number
  /** Resting rotation in degrees; the loop's rotation is added to it. */
  rot?: number
  live: boolean
  children: ReactNode
}

/** One moving part: a loop's frame, applied as a matrix about the shape's own origin. */
export function Motion({ x, y, loop, frame, period, delay = 0, rot = 0, live, children }: MotionProps) {
  const p = useLoop(period, delay, live)
  const fn: FrameFn = frame ?? TABLE[loop ?? 'rise']
  const animatedProps = useAnimatedProps(() => {
    const f = fn(p.value)
    return { matrix: matrixAt(x, y, rot + f.rot, f.scale, f.tx, f.ty, f.sy ?? 1), opacity: f.opacity }
  })
  return <AnimG animatedProps={animatedProps}>{children}</AnimG>
}

/** The Mini Cup's surface: a lighter ribbon whose wavy edge is the surface, scrolling one wavelength every 2.2 s. */
export function Surface({ d, color, live }: { d: string; color: string; live: boolean }) {
  const p = useLoop(2200, 0, live)
  const animatedProps = useAnimatedProps(() => ({ matrix: translate(waveOffset(p.value, WL), 0), opacity: 1 }))
  return (
    <AnimG animatedProps={animatedProps}>
      <Path d={d} fill={color} />
    </AnimG>
  )
}

/** Two colours turning inside the cup (Special Mix). */
export function Swirl({ cx, cy, live, children }: { cx: number; cy: number; live: boolean; children: ReactNode }) {
  const p = useLoop(9000, 0, live)
  const animatedProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * p.value, cx, cy), opacity: 1 }))
  return <AnimG animatedProps={animatedProps}>{children}</AnimG>
}

export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(ar!, br!)}${c(ag!, bg!)}${c(ab!, bb!)}`
}
export const light = (hex: string) => mix(hex, '#FFFFFF', 0.38)

/* ----------------------------------- the cup ----------------------------------- */

export type CupProps = {
  x: number
  y: number
  s?: number
  liq: string
  liqTop?: number
  pearls?: boolean
  pearlsRise?: boolean
  ice?: boolean
  bubbles?: boolean
  marble?: [string, string, string]
  slush?: boolean
  lid?: boolean
  straw?: boolean
  strawWide?: boolean
  steam?: boolean
  wave?: boolean
  live: boolean
}

export const PEARLS: [number, number][] = [
  [20, 71],
  [27, 74],
  [34, 72],
  [41, 74],
  [23, 65],
  [31, 66],
  [38, 65],
]
const BUBBLES: [number, number, number, number][] = [
  [20, 70, 1.6, 0],
  [30, 74, 1.2, 1100],
  [39, 68, 1.8, 2200],
  [26, 60, 1.1, 600],
]

/** The Mini Cup's cup on a 60×90 stage: near-straight sides, flat lid, straw at eight degrees. */
export function Cup({
  x,
  y,
  s = 1,
  liq,
  liqTop = 30,
  pearls,
  pearlsRise,
  ice,
  bubbles,
  marble,
  slush,
  lid = true,
  straw = true,
  strawWide,
  steam,
  wave = true,
  live,
}: CupProps) {
  const uid = useRef(nextId()).current
  const surface = light(marble ? marble[1] : liq)
  return (
    <G x={x} y={y} scale={s}>
      <Defs>
        <ClipPath id={`${uid}c`}>
          <Path d={BODY} />
        </ClipPath>
        <LinearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light(liq)} />
          <Stop offset="0.55" stopColor={liq} />
          <Stop offset="1" stopColor={liq} />
        </LinearGradient>
      </Defs>
      <Path d={BODY} fill="#FDFAF4" />
      <G clipPath={`url(#${uid}c)`}>
        {marble ? (
          <>
            <Rect x={0} y={liqTop + AMP} width={60} height={60} fill={marble[0]} />
            <Swirl cx={30} cy={liqTop + 28} live={live}>
              <Ellipse cx={18} cy={liqTop + 16} rx={16} ry={9} fill={marble[1]} />
              <Ellipse cx={42} cy={liqTop + 40} rx={18} ry={9} fill={marble[1]} />
              <Ellipse cx={44} cy={liqTop + 12} rx={8} ry={5} fill={marble[2]} opacity={0.8} />
            </Swirl>
          </>
        ) : (
          <Rect x={0} y={liqTop + AMP} width={60} height={60} fill={`url(#${uid}l)`} />
        )}
        {wave && !slush ? (
          <Surface
            d={wavePath({ x0: 10, width: 40, top: liqTop, amplitude: AMP, wavelength: WL, depth: 4.5 })}
            color={surface}
            live={live}
          />
        ) : null}
        {ice ? (
          <G fill="#fff" opacity={0.55}>
            <Rect x={18} y={liqTop + 6} width={9} height={9} rx={2} rotation={-12} origin={`22, ${liqTop + 10}`} />
            <Rect x={33} y={liqTop + 10} width={9} height={9} rx={2} rotation={14} origin={`37, ${liqTop + 14}`} />
            <Rect x={24} y={liqTop + 18} width={9} height={9} rx={2} rotation={-6} origin={`28, ${liqTop + 22}`} />
          </G>
        ) : null}
        {bubbles
          ? BUBBLES.map(([bx, by, r, dl], i) => (
              <Motion key={i} x={bx} y={by} loop="bubble" period={3400} delay={dl} live={live}>
                <Circle r={r} fill="#fff" opacity={0.8} />
              </Motion>
            ))
          : null}
        {pearls
          ? PEARLS.map(([px, py], i) =>
              pearlsRise ? (
                <Motion key={i} x={px} y={py} loop="rise" period={3200 + (i % 3) * 500} delay={i * 450} live={live}>
                  <Circle r={3.4} fill="#3B2317" />
                </Motion>
              ) : (
                <Circle key={i} cx={px} cy={py} r={3.4} fill="#3B2317" />
              ),
            )
          : null}
      </G>
      <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {lid ? <Rect x={9} y={14} width={42} height={5} rx={2} fill={INK} /> : null}
      {slush ? (
        <>
          {/* No lid: the slush is heaped above the rim, breathing, with frost and a passing cold sheen. */}
          <Motion x={30} y={19} loop="breathe" period={5000} live={live}>
            <Path d="M-20 0C-19-11-10-17-1-12C5-19 19-16 20 0Z" fill={liq} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          </Motion>
          <Path d="M15 15c3-5 8-7 13-6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
          <Motion x={31} y={10.5} loop="sweep" period={3600} live={live}>
            <Path d="M-13 2.5c6-6 16-7 26-3" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          </Motion>
          <Circle cx={40} cy={8} r={1.4} fill="#fff" />
          <Circle cx={22} cy={6} r={1.1} fill="#fff" />
        </>
      ) : null}
      {straw ? (
        strawWide ? (
          <Rect x={31} y={-4} width={7} height={22} rx={2.5} fill={INK} rotation={8} origin="35, 8" />
        ) : (
          <Rect x={33} y={0} width={4.5} height={20} rx={1.6} fill={INK} rotation={8} origin="35, 10" />
        )
      ) : null}
      {steam
        ? [
            [22, 0],
            [31, 900],
            [40, 1800],
          ].map(([sx, dl]) => (
            <Motion key={sx} x={sx} y={10} loop="wisp" period={3200} delay={dl} live={live}>
              <Path d="M0 0c-4-5 4-8 0-13" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
            </Motion>
          ))
        : null}
    </G>
  )
}
