import { useEffect, useRef, type ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
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
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { wavePath } from '@/lib/motion/wave'
import { LOOPS, matrixAt, rotateAbout, tiltAngle, translate, waveOffset, type LoopName } from '@/lib/motion/category-art'
import type { CategoryArtKind } from '@/lib/menu/category-art'

// The eight category illustrations, drawn and alive. No people — the drink
// itself, in the Mini Cup's own cup (near-straight sides, flat lid, straw at
// eight degrees), ink lines and flat fills, the liquid colours of
// lib/cup-visual, and one signature motion per category on a slow loop:
// pearls rise, citrus spins, an orange slice floats, steam curls, frost
// twinkles, the cheese-tea cup tilts to sip, two colours swirl, a crown
// hops. Every moving part is a <G> whose native `matrix` / `opacity` props
// are driven from a phase 0→1 (see lib/motion/category-art), the same rule
// the launch cup and the cup preview follow. Reduce Motion: frame zero, still.
//
// Drawn on a 240×100 stage and cropped by preserveAspectRatio, so one
// drawing serves the Menu banner (≈2.3:1) and the Home tile (≈1.9:1).

const AnimG = Animated.createAnimatedComponent(G)
const INK = '#2A1E14'
const BODY = 'M12 18h36l-4 56a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z'
const AMP = 0.8
const WL = 12
let seq = 0

type Props = {
  kind: CategoryArtKind
  /** banner: the whole stage; tile: the centre-right, for the Home grid. */
  crop?: 'banner' | 'tile'
  style?: StyleProp<ViewStyle>
}

export function CategoryArt({ kind, crop = 'banner', style }: Props) {
  const reduced = useReducedMotion()
  const live = !reduced
  // A tile is small and carries its label bottom-left, so the drawing drops
  // the loose piece that would sit under the words.
  const tile = crop === 'tile'
  return (
    <Svg
      style={[StyleSheet.absoluteFill, style]}
      width="100%"
      height="100%"
      viewBox={crop === 'tile' ? '26 0 190 100' : '0 0 240 100'}
      // A banner band is wider than the stage, so the drawing keeps its height
      // and sits centred, whole (the name lives on the row above it). A tile is
      // the stage's own shape and simply fills.
      preserveAspectRatio={crop === 'tile' ? 'xMidYMid slice' : 'xMidYMid meet'}
      pointerEvents="none"
    >
      {kind === 'milk' && <Milk live={live} tile={tile} />}
      {kind === 'green' && <Green live={live} tile={tile} />}
      {kind === 'black' && <Black live={live} tile={tile} />}
      {kind === 'brew' && <Brew live={live} tile={tile} />}
      {kind === 'frozen' && <Frozen live={live} tile={tile} />}
      {kind === 'cheese' && <Cheese live={live} tile={tile} />}
      {kind === 'mix' && <Mix live={live} tile={tile} />}
      {kind === 'top10' && <Top10 live={live} tile={tile} />}
    </Svg>
  )
}

/* ------------------------------ motion plumbing ------------------------------ */

/** A phase 0→1 repeating every `period` ms, started after `delay`; frozen at 0 when not live. */
function useLoop(period: number, delay: number, live: boolean) {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = 0
    if (!live) return
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false))
    return () => cancelAnimation(p)
  }, [live, period, delay, p])
  return p
}

type MotionProps = {
  /** Where the shape's origin sits on the stage; the shape is drawn around (0, 0). */
  x: number
  y: number
  loop: LoopName
  period: number
  delay?: number
  live: boolean
  children: ReactNode
}

/** One moving part: a loop's frame, applied as a matrix about the shape's own origin. */
function Motion({ x, y, loop, period, delay = 0, live, children }: MotionProps) {
  const p = useLoop(period, delay, live)
  const frame = LOOPS[loop]
  const animatedProps = useAnimatedProps(() => {
    const f = frame(p.value)
    return { matrix: matrixAt(x, y, f.rot, f.scale, f.tx, f.ty), opacity: f.opacity }
  })
  return <AnimG animatedProps={animatedProps}>{children}</AnimG>
}

/** The Mini Cup's surface: a lighter ribbon whose wavy edge is the surface, scrolling one wavelength every 2.2 s. */
function Surface({ d, color, live }: { d: string; color: string; live: boolean }) {
  const p = useLoop(2200, 0, live)
  const animatedProps = useAnimatedProps(() => ({ matrix: translate(waveOffset(p.value, WL), 0), opacity: 1 }))
  return (
    <AnimG animatedProps={animatedProps}>
      <Path d={d} fill={color} />
    </AnimG>
  )
}

/** Two colours turning inside the cup (Special Mix). */
function Swirl({ cx, cy, live, children }: { cx: number; cy: number; live: boolean; children: ReactNode }) {
  const p = useLoop(9000, 0, live)
  const animatedProps = useAnimatedProps(() => ({ matrix: rotateAbout(360 * p.value, cx, cy), opacity: 1 }))
  return <AnimG animatedProps={animatedProps}>{children}</AnimG>
}

/* ---------------------------------- colour ---------------------------------- */

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(ar!, br!)}${c(ag!, bg!)}${c(ab!, bb!)}`
}
const light = (hex: string) => mix(hex, '#FFFFFF', 0.38)

/* ----------------------------------- the cup ----------------------------------- */

type CupProps = {
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

const PEARLS: [number, number][] = [
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

function Cup({
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
  const uid = useRef(`ca${++seq}`).current
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

/** Cheese tea, the way it is drunk: the cup tilts to 42° about its base corner and the tea and foam stay level, so the foam slides to the low rim. */
function CheeseCup({ live }: { live: boolean }) {
  const uid = useRef(`ca${++seq}`).current
  const X = 150
  const Y = 12
  const liq = '#D3BE95'
  const body = `M${X + 12} ${Y + 18}h36l-4 56a4 4 0 0 1-4 4H${X + 20}a4 4 0 0 1-4-4z`
  const px = X + 16
  const py = Y + 78
  const top = Y + 42
  const p = useLoop(7000, 0, live)
  const cupProps = useAnimatedProps(() => ({ matrix: rotateAbout(-tiltAngle(p.value), px, py), opacity: 1 }))
  const insideProps = useAnimatedProps(() => ({ matrix: rotateAbout(tiltAngle(p.value), px, py), opacity: 1 }))
  const foam = wavePath({ x0: X - 90, width: 240, top: top - 14, amplitude: 2.4, wavelength: 20, depth: 18 })
  const foamEdge = wavePath({ x0: X - 90, width: 240, top: top - 14, amplitude: 2.4, wavelength: 20, depth: 3 })
  return (
    <>
      <Defs>
        <ClipPath id={`${uid}c`}>
          <Path d={body} />
        </ClipPath>
        <LinearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light(liq)} />
          <Stop offset="0.6" stopColor={liq} />
        </LinearGradient>
      </Defs>
      <AnimG animatedProps={cupProps}>
        <Path d={body} fill="#FDFAF4" />
        <G clipPath={`url(#${uid}c)`}>
          <AnimG animatedProps={insideProps}>
            <Rect x={X - 90} y={top} width={240} height={140} fill={`url(#${uid}l)`} />
            <Path d={foam} fill="#FBF1DF" />
            <Path d={foamEdge} fill="#fff" opacity={0.7} />
          </AnimG>
        </G>
        <Path d={body} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </AnimG>
    </>
  )
}

/* --------------------------------- ingredients --------------------------------- */

function Blob({ d, fill }: { d: string; fill: string }) {
  return <Path d={d} fill={fill} />
}

function Slice({ r, rind, flesh, seg = '#fff' }: { r: number; rind: string; flesh: string; seg?: string }) {
  return (
    <>
      <Circle r={r} fill={rind} />
      <Circle r={r * 0.82} fill={flesh} />
      {[0, 45, 90, 135].map((a) => (
        <Path key={a} d={`M${-r * 0.78} 0h${r * 1.56}`} stroke={seg} strokeWidth={1.6} rotation={a} />
      ))}
      <Circle r={r} fill="none" stroke={INK} strokeWidth={2} />
    </>
  )
}

function Leaf({ w, h, fill }: { w: number; h: number; fill: string }) {
  return (
    <>
      <Path
        d={`M0 ${h} C${-w} ${h * 0.5} ${-w * 0.6} ${-h * 0.4} 0 ${-h} C${w * 0.6} ${-h * 0.4} ${w} ${h * 0.5} 0 ${h}z`}
        fill={fill}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d={`M0 ${h * 0.8}V${-h * 0.7}`} stroke={INK} strokeWidth={1.5} opacity={0.7} />
    </>
  )
}

function Pearl({ r }: { r: number }) {
  return (
    <>
      <Circle r={r} fill="#3B2317" stroke={INK} strokeWidth={1.5} />
      <Ellipse cx={-r * 0.35} cy={-r * 0.4} rx={r * 0.3} ry={r * 0.18} fill="#fff" opacity={0.6} rotation={-25} />
    </>
  )
}

function Cube({ s, fill }: { s: number; fill: string }) {
  return (
    <>
      <Rect x={-s / 2} y={-s / 2} width={s} height={s} rx={3} fill={fill} stroke={INK} strokeWidth={2} />
      <Rect x={-s / 2 + 2.5} y={-s / 2 + 2.5} width={s - 5} height={s * 0.3} rx={1.5} fill="#fff" opacity={0.4} />
    </>
  )
}

function Flake({ r }: { r: number }) {
  return (
    <G stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none">
      {[0, 60, 120].map((a) => (
        <Path
          key={a}
          d={`M${-r} 0h${r * 2}M${-r * 0.5} ${-r * 0.35}l${r * 0.5} ${r * 0.35}l${-r * 0.5} ${r * 0.35}M${r * 0.5} ${-r * 0.35}l${-r * 0.5} ${r * 0.35}l${r * 0.5} ${r * 0.35}`}
          rotation={a}
        />
      ))}
    </G>
  )
}

function Spark({ r }: { r: number }) {
  return (
    <Path
      d={`M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}z`}
      fill="#F2B64A"
      stroke={INK}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  )
}

function Crown() {
  return (
    <>
      <Path d="M-13 7V-6L-6 1 0-10 6 1 13-6V7Z" fill="#F2B64A" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={-6.5} cy={3} r={1.5} fill="#E2645F" />
      <Circle cx={6.5} cy={3} r={1.5} fill="#5FA8D6" />
      <Circle cy={-10} r={1.8} fill="#E2645F" stroke={INK} strokeWidth={1} />
    </>
  )
}

function Passion({ r }: { r: number }) {
  return (
    <>
      <Circle r={r} fill="#7A3B5E" />
      <Circle r={r * 0.72} fill="#F2B64A" />
      {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => (
        <Ellipse key={a} cx={r * 0.45} rx={r * 0.14} ry={r * 0.1} fill={INK} rotation={a} />
      ))}
      <Circle r={r} fill="none" stroke={INK} strokeWidth={2} />
    </>
  )
}

function Wedge({ s }: { s: number }) {
  return (
    <>
      <Path
        d={`M${-s} ${s * 0.5} L${s} ${s * 0.5} L${s * 0.6} ${-s * 0.5} L${-s * 0.6} ${-s * 0.5}z`}
        fill="#F4CE6A"
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={-s * 0.25} cy={0} r={s * 0.16} fill="#E0A557" />
      <Circle cx={s * 0.3} cy={s * 0.15} r={s * 0.12} fill="#E0A557" />
    </>
  )
}

function Ring({ r }: { r: number }) {
  return <Circle r={r} fill="none" stroke={INK} strokeWidth={1.6} />
}

/* ---------------------------------- the eight ---------------------------------- */

type Live = { live: boolean; tile: boolean }

function Milk({ live, tile }: Live) {
  return (
    <>
      <Blob d="M120 8c40-14 92-6 112 26 18 30-6 70-46 70-36 0-64-6-80-28C92 58 96 16 120 8z" fill="#EBCFA6" />
      <Cup x={152} y={6} s={0.98} liq="#C8A681" pearls pearlsRise live={live} />
      {!tile && (
        <Motion x={118} y={62} loop="bob" period={4400} live={live}>
          <Pearl r={6} />
        </Motion>
      )}
      <Motion x={214} y={40} loop="bob" period={5000} delay={1200} live={live}>
        <Pearl r={5} />
      </Motion>
      <Motion x={206} y={78} loop="bob" period={3800} delay={500} live={live}>
        <Pearl r={4} />
      </Motion>
    </>
  )
}

function Green({ live, tile }: Live) {
  return (
    <>
      <Blob d="M110 14c30-16 100-10 118 20 16 26 0 62-38 66-40 4-72-2-88-26C86 52 84 28 110 14z" fill="#CFDFB2" />
      <Cup x={150} y={8} s={0.96} liq="#AFC58C" ice bubbles live={live} />
      <Motion x={216} y={30} loop="spin" period={14000} live={live}>
        <Slice r={15} rind="#E9D257" flesh="#F4EEA3" />
      </Motion>
      {!tile && (
        <Motion x={112} y={78} loop="spin" period={18000} live={live}>
          <Slice r={10} rind="#8FC24A" flesh="#CFE58F" />
        </Motion>
      )}
      <Motion x={120} y={32} loop="sway" period={3200} live={live}>
        <Leaf w={6} h={11} fill="#7CB86B" />
      </Motion>
    </>
  )
}

function Black({ live, tile }: Live) {
  return (
    <>
      <Blob d="M114 10c36-14 100-8 118 24 14 26-4 64-44 68-38 4-68-4-84-26C90 54 88 22 114 10z" fill="#E8B990" />
      <Cup x={150} y={8} s={0.96} liq="#B08A63" ice live={live} />
      <Motion x={197} y={30} loop="bob" period={3600} live={live}>
        <Slice r={11} rind="#F27D45" flesh="#FFB067" seg="#FFE0C0" />
      </Motion>
      {!tile && (
        <Motion x={114} y={70} loop="bob" period={5000} delay={800} live={live}>
          <Passion r={13} />
        </Motion>
      )}
      <Motion x={126} y={38} loop="ripple" period={2600} live={live}>
        <Ring r={6} />
      </Motion>
      <Motion x={126} y={38} loop="ripple" period={2600} delay={1300} live={live}>
        <Ring r={6} />
      </Motion>
    </>
  )
}

function Brew({ live, tile }: Live) {
  return (
    <>
      <Blob d="M112 12c34-14 96-8 116 22 16 28-6 66-46 68-40 2-70-6-84-28C86 52 86 24 112 12z" fill="#D6C2A2" />
      <Cup x={150} y={10} s={0.96} liq="#C0A176" liqTop={34} straw={false} steam wave={false} live={live} />
      <Motion x={118} y={26} loop="fall" period={6500} live={live}>
        <Leaf w={5} h={10} fill="#6E8F5E" />
      </Motion>
      <Motion x={214} y={22} loop="fall" period={7000} delay={2500} live={live}>
        <Leaf w={5} h={10} fill="#6E8F5E" />
      </Motion>
      {!tile && (
        <Motion x={126} y={60} loop="fall" period={5500} delay={4000} live={live}>
          <Leaf w={4} h={8} fill="#6E8F5E" />
        </Motion>
      )}
    </>
  )
}

function Frozen({ live, tile }: Live) {
  return (
    <>
      <Blob d="M112 12c36-16 98-8 116 22 16 28-4 66-44 68-40 2-70-4-86-28C86 52 86 26 112 12z" fill="#BFD3DA" />
      <Cup x={150} y={12} s={0.96} liq="#EFA53A" slush lid={false} liqTop={22} strawWide live={live} />
      <Motion x={118} y={30} loop="twinkle" period={2400} live={live}>
        <Flake r={9} />
      </Motion>
      <Motion x={214} y={26} loop="twinkle" period={2400} delay={800} live={live}>
        <Flake r={7} />
      </Motion>
      {!tile && (
        <Motion x={124} y={74} loop="twinkle" period={2400} delay={1600} live={live}>
          <Flake r={6} />
        </Motion>
      )}
      <Motion x={218} y={70} loop="twinkle" period={2400} delay={400} live={live}>
        <Flake r={8} />
      </Motion>
    </>
  )
}

function Cheese({ live, tile }: Live) {
  return (
    <>
      <Blob d="M112 12c36-14 100-8 118 24 14 26-4 62-44 66-40 4-70-4-86-26C86 54 86 26 112 12z" fill="#F6DDA8" />
      <CheeseCup live={live} />
      {!tile && (
        <Motion x={112} y={66} loop="bob" period={5000} live={live}>
          <Wedge s={14} />
        </Motion>
      )}
      <Motion x={122} y={30} loop="twinkle" period={2400} delay={300} live={live}>
        <Circle r={2.2} fill="#E0A557" />
      </Motion>
      <Motion x={212} y={34} loop="twinkle" period={2400} delay={1100} live={live}>
        <Circle r={2} fill="#E0A557" />
      </Motion>
    </>
  )
}
function Mix({ live, tile }: Live) {
  return (
    <>
      <Blob d="M112 12c36-14 100-8 118 24 14 26-4 62-44 66-40 4-70-4-86-26C86 54 86 26 112 12z" fill="#CDBBDB" />
      <Cup x={150} y={8} s={0.96} liq="#A48BC4" marble={['#A48BC4', '#F1E3D3', '#C9B4DE']} live={live} />
      <Motion x={116} y={34} loop="bob" period={4200} live={live}>
        <Cube s={12} fill="#E2645F" />
      </Motion>
      {!tile && (
        <Motion x={120} y={72} loop="bob" period={5000} delay={1000} live={live}>
          <Cube s={11} fill="#7CC47F" />
        </Motion>
      )}
      <Motion x={216} y={62} loop="bob" period={4600} delay={2000} live={live}>
        <Cube s={12} fill="#5FA8D6" />
      </Motion>
    </>
  )
}

function Top10({ live, tile }: Live) {
  return (
    <>
      <Blob d="M104 14c40-16 108-8 126 24 14 26-6 64-46 68-44 4-76-6-92-30C78 52 78 26 104 14z" fill="#F3D27A" />
      <Cup x={150} y={14} s={1.02} liq="#7A4E2D" pearls pearlsRise live={live} />
      <Motion x={166} y={22} loop="crownHop" period={4000} live={live}>
        <Crown />
      </Motion>
      <Motion x={136} y={30} loop="twinkle" period={2800} live={live}>
        <Spark r={5} />
      </Motion>
      <Motion x={214} y={24} loop="twinkle" period={3200} delay={700} live={live}>
        <Spark r={4} />
      </Motion>
      <Motion x={210} y={68} loop="twinkle" period={2600} delay={1400} live={live}>
        <Spark r={3.5} />
      </Motion>
      {!tile && (
        <Motion x={128} y={64} loop="twinkle" period={3000} delay={2000} live={live}>
          <Spark r={3} />
        </Motion>
      )}
    </>
  )
}
