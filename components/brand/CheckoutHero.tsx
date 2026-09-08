import { useMemo, useRef } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { wavePath } from '@/lib/motion/wave'
import type { CupVisual, ToppingVisual } from '@/lib/cup-visual'
import { flapFor, packFor } from '@/lib/motion/checkout-hero'
import { HERO_MAX_CUPS } from '@/lib/menu/order-cups'
import { AMP, BODY, INK, Motion, PEARLS, Surface, WL, light, nextId } from '@/components/brand/art-kit'

// The checkout's picture of what happens next, drawn and alive, with the
// customer's own order in it: for pickup, their cups made and waiting on
// the counter, the bell beside them; for delivery, their cups going one by
// one into the insulated bag on the doorstep while the doorbell chimes. Each
// cup is drawn from the same cup-visual the item sheet uses — liquid colour,
// ice, toppings, foam — always in the Mini Cup's cup with its lid and straw.
// Reduce Motion holds frame zero (bell idle, lid closed).

type Props = {
  kind: 'pickup' | 'delivery'
  /** One per cup in the order, in order; only the first HERO_MAX_CUPS are drawn. */
  cups: CupVisual[]
  /** Cups beyond the drawn ones — shown as "+N" on the pickup ticket. */
  extra?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The pickup scene's frame, cropped to what it actually draws.
 *
 * With the wall bare, the counter floated in dead space: nothing above y=25,
 * nothing below y=168. The frame starts under the old ceiling strip and ends
 * part-way down the counter front, so the drinks fill the picture.
 *
 * Delivery keeps the full 360×200 — its doorstep runs edge to edge, ground at
 * y=170 and the bag reaching 174, and the same crop would cut the floor out
 * from under it. So the frame is per-kind, and the card changes height when
 * the customer toggles fulfilment; next to the address form that branch
 * already reveals, that is noise.
 *
 * The aspect lives here rather than at the call site because only this
 * component knows which scene it is drawing.
 */
const FRAME = {
  pickup: { viewBox: '0 12 360 156', aspectRatio: 360 / 156 },
  delivery: { viewBox: '0 0 360 200', aspectRatio: 1.85 },
} as const

export function CheckoutHero({ kind, cups, extra = 0, style }: Props) {
  const reduced = useReducedMotion()
  const live = !reduced
  const shown = cups.slice(0, HERO_MAX_CUPS)
  const frame = FRAME[kind]
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: kind === 'pickup' ? '#F5E6D3' : '#EAF0E4', aspectRatio: frame.aspectRatio },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={
        kind === 'pickup'
          ? `Your ${shown.length === 1 ? 'drink' : 'drinks'} ready on the counter for pickup`
          : `Your ${shown.length === 1 ? 'drink' : 'drinks'} packed for delivery to your door`
      }
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={frame.viewBox}
        preserveAspectRatio="xMidYMid slice"
        pointerEvents="none"
      >
        {kind === 'pickup' ? <Pickup cups={shown} live={live} /> : <Delivery cups={shown} live={live} />}
      </Svg>
      {kind === 'pickup' && extra > 0 ? (
        <View style={styles.extra} pointerEvents="none">
          <Text style={styles.extraText}>{`+${extra}`}</Text>
        </View>
      ) : null}
    </View>
  )
}

/* ----------------------------- a cup from the order ----------------------------- */

const LIQ_TOP = 30
const CUBES: [number, number, number][] = [
  [16, 0, -10],
  [27, 2, 8],
  [38, 0, -5],
  [22, -8, 6],
  [33, -7, -8],
]

function Bed({ t, y, rise, live }: { t: ToppingVisual; y: number; rise: boolean; live: boolean }) {
  const color = (i: number) => t.colors[i % t.colors.length] ?? t.colors[0]
  if (t.shape === 'cube') {
    return (
      <>
        {CUBES.map(([x, dy, r], i) =>
          rise ? (
            <Motion key={i} x={x + 4} y={y + dy - 2} loop="rise" period={3400 + (i % 2) * 500} delay={i * 500} live={live}>
              <Rect x={-4} y={-4} width={8} height={8} rx={2} fill={color(i)} rotation={r} />
            </Motion>
          ) : (
            <Rect key={i} x={x} y={y + dy - 6} width={8} height={8} rx={2} fill={color(i)} rotation={r} origin={`${x + 4}, ${y + dy - 2}`} />
          ),
        )}
      </>
    )
  }
  if (t.shape === 'crumb') {
    return (
      <>
        {[
          [18, -3, 20],
          [26, -6, -15],
          [34, -4, 40],
          [42, -6, 10],
        ].map(([x, dy, r], i) => (
          <Rect key={i} x={x} y={LIQ_TOP + dy} width={6} height={4} rx={1} fill={color(0)} rotation={r} origin={`${x}, ${LIQ_TOP + dy}`} />
        ))}
      </>
    )
  }
  const r = t.shape === 'sphere' ? 3.6 : 3.2
  const spots = t.shape === 'sphere' ? PEARLS.slice(0, 5) : PEARLS
  return (
    <>
      {spots.map(([x, py], i) =>
        rise ? (
          <Motion key={i} x={x} y={y + (py - 71)} loop="rise" period={3200 + (i % 3) * 500} delay={i * 450} live={live}>
            <Circle r={r} fill={color(i)} />
          </Motion>
        ) : (
          <Circle key={i} cx={x} cy={y + (py - 71)} r={r} fill={color(i)} />
        ),
      )}
    </>
  )
}

/** The customer's cup: cup-visual in, the Mini Cup's cup out — lid and straw on every one. */
function OrderCup({ v, x, y, s, live }: { v: CupVisual; x: number; y: number; s: number; live: boolean }) {
  const uid = useRef(nextId()).current
  const beds = v.toppings.filter((t) => t.placement === 'bottom').slice(0, 3)
  const floating = v.toppings.filter((t) => t.placement === 'top').slice(0, 1)
  const iceCount = v.ice === 'extra' || v.ice === 'normal' ? 3 : v.ice === 'less' ? 2 : 0
  const liquidOpacity = Math.min(1, 0.74 + Math.min(v.sugar, 1) * 0.26)
  return (
    <G x={x} y={y} scale={s}>
      <Defs>
        <ClipPath id={`${uid}c`}>
          <Path d={BODY} />
        </ClipPath>
        <LinearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={v.liquidLight} />
          <Stop offset="0.55" stopColor={v.liquid} />
          <Stop offset="1" stopColor={v.liquid} />
        </LinearGradient>
      </Defs>
      <Path d={BODY} fill="#FDFAF4" />
      <G clipPath={`url(#${uid}c)`}>
        <Rect x={0} y={LIQ_TOP + AMP} width={60} height={60} fill={`url(#${uid}l)`} opacity={liquidOpacity} />
        {!v.hasFoam ? (
          <Surface
            d={wavePath({ x0: 10, width: 40, top: LIQ_TOP, amplitude: AMP, wavelength: WL, depth: 4.5 })}
            color={light(v.liquid)}
            live={live}
          />
        ) : null}
        {iceCount > 0 ? (
          <G fill="#fff" opacity={0.55}>
            <Rect x={18} y={LIQ_TOP + 8} width={9} height={9} rx={2} rotation={-12} origin={`22, ${LIQ_TOP + 12}`} />
            <Rect x={33} y={LIQ_TOP + 12} width={9} height={9} rx={2} rotation={14} origin={`37, ${LIQ_TOP + 16}`} />
            {iceCount > 2 ? <Rect x={24} y={LIQ_TOP + 20} width={9} height={9} rx={2} rotation={-6} origin={`28, ${LIQ_TOP + 24}`} /> : null}
          </G>
        ) : null}
        {beds.map((t, i) => (
          <Bed key={`${t.name}-${i}`} t={t} y={71 - i * 9} rise={i === 0} live={live} />
        ))}
        {floating.map((t, i) => (
          <Bed key={`top-${i}`} t={t} y={LIQ_TOP} rise={false} live={live} />
        ))}
        {v.hasFoam ? (
          <>
            <Path
              d={`M8 ${LIQ_TOP + 4} C10 ${LIQ_TOP - 5} 22 ${LIQ_TOP - 7} 30 ${LIQ_TOP - 1} C38 ${LIQ_TOP - 8} 50 ${LIQ_TOP - 5} 52 ${LIQ_TOP + 4} Z`}
              fill="#FBF1DF"
            />
            <Rect x={0} y={LIQ_TOP + 3} width={60} height={9} fill="#FBF1DF" />
          </>
        ) : null}
        {v.hasBrulee ? <Rect x={10} y={LIQ_TOP + 1} width={40} height={5} fill="#C98A3C" /> : null}
      </G>
      <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={9} y={14} width={42} height={5} rx={2} fill={INK} />
      <Rect x={33} y={0} width={4.5} height={20} rx={1.6} fill={INK} rotation={8} origin="35, 10" />
    </G>
  )
}

/* ----------------------------------- pickup ----------------------------------- */

function Bell({ x, y, live }: { x: number; y: number; live: boolean }) {
  return (
    <G x={x} y={y}>
      <Ellipse cx={0} cy={8} rx={17} ry={5} fill="#8D5524" stroke={INK} strokeWidth={2} />
      <Motion x={0} y={8} loop="ding" period={3600} live={live}>
        <Path d="M-13 0a13 13 0 0 1 26 0z" fill="#F2B64A" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Ellipse cx={-5} cy={-8} rx={3} ry={1.6} fill="#fff" opacity={0.6} />
        <Circle cy={-14} r={3} fill={INK} />
      </Motion>
      <Motion x={-20} y={8} loop="ringLeft" period={3600} live={live}>
        <Path d="M0 -14a12 12 0 0 0 0 20" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      </Motion>
      <Motion x={20} y={8} loop="ringRight" period={3600} live={live}>
        <Path d="M0 -14a12 12 0 0 1 0 20" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      </Motion>
    </G>
  )
}

function Plant({ x, y, live }: { x: number; y: number; live: boolean }) {
  return (
    <G x={x} y={y}>
      <Rect x={-9} y={0} width={18} height={16} rx={3} fill="#C9A16B" stroke={INK} strokeWidth={2} />
      <Motion x={0} y={0} loop="planted" period={3200} live={live}>
        <Path d="M0 0c-8-6-10-16-4-22 6 4 6 14 4 22z" fill="#7CB86B" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M0 0c8-6 10-16 4-22-6 4-6 14-4 22z" fill="#6E8F5E" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </Motion>
    </G>
  )
}

function Spark({ x, y, delay, live }: { x: number; y: number; delay: number; live: boolean }) {
  return (
    <Motion x={x} y={y} loop="twinkle" period={2600} delay={delay} live={live}>
      <Path d="M0 -5Q0 0 5 0Q0 0 0 5Q0 0 -5 0Q0 0 0 -5z" fill="#F2B64A" stroke={INK} strokeWidth={1.2} />
    </Motion>
  )
}

function Pickup({ cups, live }: { cups: CupVisual[]; live: boolean }) {
  return (
    <>
      {/* Bare wall above the counter (Stan, 2026-09-08). The shelf, the three
          lucky cats, the urns and their steam are gone — the scene is about
          the customer's own cups, and everything up there was competing with
          them. Cat and Urn went with their last use. Mirrors web #382. */}
      <Rect width={360} height={200} fill="#F5E6D3" />
      <Rect x={0} y={140} width={360} height={60} fill="#C9A16B" />
      <Rect x={0} y={136} width={360} height={9} fill="#E0BE8C" stroke={INK} strokeWidth={2} />
      {cups.map((v, i) => (
        <OrderCup key={i} v={v} x={56 + i * 50} y={80} s={0.72} live={live} />
      ))}
      {/* The order ticket, leaning on nothing much, stirring in the air-con. */}
      <Motion x={258} y={140} loop="flutter" period={2800} live={live}>
        <Path d="M0 0V-32H24V0Z" fill="#FFF9F0" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M5 -24h14M5 -18h10M5 -12h14M5 -6h8" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      </Motion>
      <Bell x={304} y={128} live={live} />
      <Plant x={344} y={122} live={live} />
      {/* Down beside the cups. Up where the shelf used to be it was the only
          mark left on a bare wall, which read as a smudge rather than shine. */}
      <Spark x={34} y={96} delay={800} live={live} />
    </>
  )
}

/* ---------------------------------- delivery ---------------------------------- */

function Delivery({ cups, live }: { cups: CupVisual[]; live: boolean }) {
  const n = cups.length
  const packs = useMemo(() => cups.map((_, i) => packFor(i)), [cups])
  const flap = useMemo(() => flapFor(n), [n])
  return (
    <>
      <Rect width={360} height={200} fill="#EAF0E4" />
      <Motion x={60} y={40} loop="drift" period={14000} live={live}>
        <Path d="M0 0c-10 0-14-8-8-13 2-10 18-12 22-3 8-4 18 2 14 9 6 3 2 8-4 7z" fill="#fff" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </Motion>
      <Rect x={150} y={14} width={150} height={160} fill="#FFF3DE" stroke={INK} strokeWidth={2} />
      <Rect x={180} y={40} width={90} height={134} rx={4} fill="#A2AD91" stroke={INK} strokeWidth={2} />
      <Rect x={192} y={52} width={66} height={44} rx={3} fill="#EAF0E4" stroke={INK} strokeWidth={1.6} />
      <Path d="M225 52v44M192 74h66" stroke={INK} strokeWidth={1.4} opacity={0.6} />
      <Circle cx={250} cy={120} r={4} fill="#F2B64A" stroke={INK} strokeWidth={1.6} />
      <Rect x={208} y={104} width={34} height={14} rx={3} fill="#FFF3DE" stroke={INK} strokeWidth={1.4} />
      <Path d="M215 111h20" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      {/* The doorbell, pressed at the top of each cycle, two chime rings. */}
      <G x={290} y={76}>
        <Rect x={-7} y={-10} width={14} height={20} rx={4} fill="#3B3633" stroke={INK} strokeWidth={1.6} />
        <Motion x={0} y={0} loop="bellwave" period={4000} live={live}>
          <Circle r={3.5} fill="#F2B64A" stroke={INK} strokeWidth={1} />
        </Motion>
        <Motion x={0} y={0} loop="chime" period={4000} live={live}>
          <Circle r={10} fill="none" stroke={INK} strokeWidth={1.6} />
        </Motion>
        <Motion x={0} y={0} loop="chime" period={4000} delay={500} live={live}>
          <Circle r={10} fill="none" stroke={INK} strokeWidth={1.6} />
        </Motion>
      </G>
      <Rect x={0} y={170} width={360} height={30} fill="#D9CBB3" />
      <Path d="M0 170h360" stroke={INK} strokeWidth={2} />
      <Rect x={160} y={160} width={130} height={14} rx={3} fill="#C9A16B" stroke={INK} strokeWidth={2} />
      <Path d="M172 167h106" stroke={INK} strokeWidth={1.6} strokeDasharray="4 4" opacity={0.5} />
      {/* The bag: opaque; the cups appear above it and go in one by one, hidden by the front once inside. */}
      <G x={226} y={126} scale={0.72}>
        <Rect x={-46} y={-8} width={92} height={12} rx={3} fill="#3B2317" />
        {cups.map((v, i) => (
          <Motion key={i} x={-18} y={-2} frame={packs[i]} period={6000} live={live}>
            <OrderCup v={v} x={0} y={0} s={0.6} live={live} />
          </Motion>
        ))}
        <Path d="M-52 -6h104v58a8 8 0 0 1 -8 8h-88a8 8 0 0 1 -8 -8z" fill="#8D5524" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Rect x={-22} y={22} width={44} height={14} rx={3} fill="#FFF3DE" />
        <Path d="M-15 29h30" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
        <Motion x={-52} y={-2} frame={flap} period={6000} live={live}>
          <Rect x={0} y={-12} width={104} height={12} rx={4} fill="#6B3E15" stroke={INK} strokeWidth={2} />
          <Path d="M36 -12v-6a16 16 0 0 1 32 0v6" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        </Motion>
      </G>
      <G x={92} y={150}>
        <Rect x={-11} y={0} width={22} height={20} rx={4} fill="#E9A87A" stroke={INK} strokeWidth={2} />
        <Motion x={0} y={0} loop="planted" period={3200} live={live}>
          <Path d="M0 0c-10-8-12-20-4-28 8 5 8 18 4 28z" fill="#7CB86B" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M0 0c10-8 12-20 4-28-8 5-8 18-4 28z" fill="#6E8F5E" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M0 0c-2-12 2-22 8-26" fill="none" stroke={INK} strokeWidth={1.6} />
        </Motion>
      </G>
      <Rect x={308} y={120} width={24} height={30} rx={2} fill="#C9A16B" stroke={INK} strokeWidth={2} />
      <Spark x={36} y={66} delay={300} live={live} />
    </>
  )
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  extra: {
    position: 'absolute',
    left: '69%',
    top: '48%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#2A1E14',
  },
  extraText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#FFF3DE' },
})
