import { useRef } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useAnimatedProps, useReducedMotion } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { wavePath } from '@/lib/motion/wave'
import { rotateAbout, tiltAngle } from '@/lib/motion/category-art'
import type { CategoryArtKind } from '@/lib/menu/category-art'
import { AnimG, Cup, INK, Motion, light, nextId, useLoop } from '@/components/brand/art-kit'

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
      {kind === 'specials' && <Specials live={live} tile={tile} />}
    </Svg>
  )
}

/** Cheese tea, the way it is drunk: the cup tilts to 42° about its base corner and the tea and foam stay level, so the foam slides to the low rim. */
function CheeseCup({ live }: { live: boolean }) {
  const uid = useRef(nextId()).current
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

/** A price tag on a string, drawn hanging from (0, 0): the swing pivots at the knot. */
function Tag() {
  return (
    <>
      <Path d="M0 0v9" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <Circle r={2} fill="#FFF3DE" stroke={INK} strokeWidth={1.4} />
      <Path d="M-9 13L0 8l9 5v22a3 3 0 0 1-3 3H-6a3 3 0 0 1-3-3z" fill="#8D5524" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Circle cy={14} r={1.6} fill="#FFF3DE" />
      <Circle cx={-3.2} cy={22} r={2.2} fill="none" stroke="#FFF3DE" strokeWidth={1.6} />
      <Circle cx={3.2} cy={30} r={2.2} fill="none" stroke="#FFF3DE" strokeWidth={1.6} />
      <Path d="M-4 31L4 21" stroke="#FFF3DE" strokeWidth={1.8} strokeLinecap="round" />
    </>
  )
}

/** This week's specials: the Thai milk tea on the shelf with its price tag swinging, a couple of sparkles. */
function Specials({ live, tile }: Live) {
  return (
    <>
      <Blob d="M112 12c36-14 100-8 118 24 14 26-4 62-44 66-40 4-70-4-86-26C86 54 86 26 112 12z" fill="#F6CBA3" />
      <Cup x={150} y={8} s={0.96} liq="#DF8A4C" pearls pearlsRise live={live} />
      {/* Tied to the rim's right corner and lying across the cup at an angle; the swing is a small sway about that rest. */}
      <Motion x={198} y={23} loop="swing" period={3200} rot={24} live={live}>
        <Tag />
      </Motion>
      <Motion x={122} y={30} loop="twinkle" period={2800} live={live}>
        <Spark r={5} />
      </Motion>
      {!tile && (
        <Motion x={126} y={70} loop="twinkle" period={3200} delay={1200} live={live}>
          <Spark r={3.5} />
        </Motion>
      )}
      <Motion x={222} y={74} loop="twinkle" period={2600} delay={600} live={live}>
        <Spark r={3} />
      </Motion>
    </>
  )
}
