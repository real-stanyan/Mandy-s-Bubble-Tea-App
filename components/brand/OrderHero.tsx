import { useRef } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg'
import { wavePath } from '@/lib/motion/wave'
import type { CupVisual } from '@/lib/cup-visual'
import { AMP, BODY, INK, Motion, PEARLS, Surface, WL, light, nextId } from '@/components/brand/art-kit'
import { CheckoutHero, FRAME } from '@/components/brand/CheckoutHero'
import { LoopScope, useSceneGate } from '@/components/ui/LoopScope'
import { SVG_MOTION } from '@/lib/motion/ambient'
import {
  COUNTER_Y,
  DONE_CUP,
  DONE_PERIOD,
  FILL_DEPTH,
  LIQ_TOP,
  MAKE,
  POUR_FLOOR,
  PREP,
  PREP_PERIOD,
  RECEIVED_PERIOD,
  STREAM_LEN,
  TIN,
  arrive,
  dropIn,
  fill,
  handoff,
  pour,
  press,
  shake,
  shakeArc,
  starDrift,
  ticketFeed,
} from '@/lib/motion/order-hero'

// What is happening to the customer's drinks, drawn on the order screen while
// they wait for them. The checkout hero shows the counter they are heading
// for; this one shows the drinks getting made, and it changes as the order
// moves — the only picture in the app telling the customer something they do
// not already know.
//
// Port of the web's src/components/brand/OrderHero.tsx: same drawing, same
// beats, same numbers (lib/motion/order-hero, which the two sides mirror).
// Only the plumbing differs — Reanimated worklets here, one rAF ticker there.
//
// Six scenes: four drawn here, and Ready / Delivered handed to the checkout
// hero, which already draws exactly those two moments.

import type { OrderScene } from '@/lib/order-scene'

export type { OrderScene }

// Built once at module scope. A frame handed to Motion has to be a stable
// worklet; rebuilding these per render would give Reanimated a new function
// every time and restart the animation with it.
const POUR = pour(POUR_FLOOR, STREAM_LEN)
const ARRIVE = arrive(-120)
const FILL = fill(FILL_DEPTH)
const HANDOFF = handoff(DONE_CUP.x - MAKE.x, DONE_CUP.y - MAKE.y, 1 - DONE_CUP.s / MAKE.s)
const SEAL = press(PREP.sealFrom, PREP.sealTo, -44)
const STRAW = press(PREP.strawFrom, PREP.strawTo, -30)
const PEARL_DROPS = PEARLS.map((_, i) =>
  dropIn(PREP.pearlFrom + i * PREP.pearlStagger, PREP.pearlFall, -46),
)
const ICE_DROPS = [0, 1].map((i) => dropIn(PREP.iceFrom + i * PREP.iceStagger, PREP.iceFall, -40))
const STARS = [0, 1].map((i) => starDrift(i * 0.34))

export function OrderHero({
  scene,
  cups,
  extra = 0,
  style,
}: {
  scene: OrderScene
  /** The customer's own cups, from lib/menu/order-cups. */
  cups: CupVisual[]
  extra?: number
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useReducedMotion()
  // Still under Reduce Motion, and still on Android (lib/motion/ambient SVG_MOTION).
  const live = !reduced && SVG_MOTION
  // Moves only while its screen is focused (components/ui/LoopScope).
  const sceneGate = useSceneGate()

  // Two of the six ARE the checkout hero. At checkout those pictures are a
  // promise — this is the counter you'll come to, this is the bag going to
  // your door; at these two steps they are simply true, and drawing a second
  // counter or a second doorstep to say the same thing would be the app
  // talking to itself.
  if (scene === 'ready') {
    return <CheckoutHero kind="pickup" cups={cups} extra={extra} style={style} />
  }
  if (scene === 'delivered' || scene === 'packed') {
    return <CheckoutHero kind="delivery" cups={cups} extra={extra} style={style} />
  }

  const one = cups.length === 1
  return (
    <View
      ref={sceneGate.ref}
      onLayout={sceneGate.onLayout}
      // The scene's own daylight, the same in both themes — the PIN rule for
      // illustrations, as on CheckoutHero. Same frame as that hero's pickup
      // scene, so the card does not jump as the order advances into Ready.
      style={[styles.box, style]}
      accessibilityRole="image"
      accessibilityLabel={
        scene === 'received'
          ? 'Your order printing at the counter'
          : scene === 'preparing'
            ? `Your ${one ? 'drink being' : 'drinks being'} shaken and poured`
            : `Your ${one ? 'drink' : 'drinks'} collected — thanks for visiting`
      }
    >
      <LoopScope gate={sceneGate.gate}>
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox={FRAME.pickup.viewBox}
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
        >
          {scene === 'received' ? (
            <Received cups={cups} live={live} />
          ) : scene === 'preparing' ? (
            <Preparing cups={cups} live={live} />
          ) : (
            <PickedUp live={live} />
          )}
        </Svg>
      </LoopScope>
      {/* THANK YOU! as a real RN <Text> over the drawing — the same trick the
          checkout hero uses for its "+N" badge, and the only text rendering in
          this file already proven on device. The note spans y 92..136 of the
          360×156 frame, so 58% down lands inside it. */}
      {scene === 'done' ? (
        <View style={styles.noteText} pointerEvents="none">
          <Text style={styles.noteWords}>THANK YOU!</Text>
        </View>
      ) : null}
    </View>
  )
}

/* --------------------------------- the room -------------------------------- */

/** The room these scenes stand in: the checkout hero's counter, and a bare
 *  wall above it. */
function Counter() {
  return (
    <>
      <Rect width={360} height={200} fill="#F5E6D3" />
      <Rect x={0} y={COUNTER_Y + 4} width={360} height={60} fill="#C9A16B" />
      <Rect x={0} y={COUNTER_Y} width={360} height={9} fill="#E0BE8C" stroke={INK} strokeWidth={2} />
    </>
  )
}

/** An empty cup, waiting — what one looks like before anything goes in. */
function EmptyCup({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G x={x} y={y} scale={s}>
      <Path d={BODY} fill="#FDFAF4" />
      <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
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

/* ------------------------------- 1 · received ------------------------------ */

/** The ticket printing. Nothing is being made yet — for a scheduled order that
 *  is the whole point, and saying "Preparing" there would be a lie. */
function Received({ cups, live }: { cups: CupVisual[]; live: boolean }) {
  return (
    <>
      <Counter />
      {cups.slice(0, 3).map((_, i) => (
        <EmptyCup key={i} x={44 + i * 44} y={COUNTER_Y - 78 * 0.62} s={0.62} />
      ))}
      <G>
        <Rect x={236} y={COUNTER_Y - 72} width={64} height={72} rx={8} fill="#D8D3CA" stroke={INK} strokeWidth={2} />
        <Rect x={244} y={COUNTER_Y - 64} width={48} height={5} rx={2.5} fill={INK} opacity={0.75} />
        <Circle cx={290} cy={COUNTER_Y - 12} r={3.4} fill="#3CA96E" stroke={INK} strokeWidth={1.4} />
      </G>
      <Motion x={268} y={COUNTER_Y - 62} frame={ticketFeed} period={RECEIVED_PERIOD} live={live}>
        <Rect x={-21} y={0} width={42} height={46} rx={3} fill="#FFFDF6" stroke={INK} strokeWidth={1.8} />
        <Path
          d="M-13 12h26M-13 20h26M-13 28h18M-13 36h12"
          stroke={INK}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.5}
        />
      </Motion>
      <Spark x={318} y={98} delay={0} live={live} />
    </>
  )
}

/* ------------------------------ 2 · preparing ------------------------------ */

/** The shop is 手摇. The tin is the centre of this scene and takes a third of
 *  the loop, because shaking by hand is the thing being sold. */
function Preparing({ cups, live }: { cups: CupVisual[]; live: boolean }) {
  const v = cups[0]
  return (
    <>
      <Counter />
      {v ? <DoneCup v={v} /> : null}

      {/* The shake read as speed: an arc flicking on each beat, one a side. */}
      {[-1, 1].map((side) => (
        <Motion key={side} x={TIN.x + side * 26} y={60} frame={shakeArc} period={PREP_PERIOD} live={live}>
          <Path
            d={side < 0 ? 'M0-11a10 10 0 0 0 0 22' : 'M0-11a10 10 0 0 1 0 22'}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Motion>
      ))}

      {/* Drawn before the cup, so the cup's front hides the end of the pour. */}
      <Motion x={0} y={0} frame={POUR} period={PREP_PERIOD} live={live}>
        <Rect x={-2.8} y={0} width={5.6} height={STREAM_LEN} rx={2.8} fill={v ? v.liquidLight : '#DDA96F'} />
      </Motion>

      <Tin live={live} />
      <MakingCup v={v} live={live} />

      {/* The next empty cup, arriving as the finished one leaves. At the end of
          the cycle it stands exactly where the cup being made stands at the
          start — which is what closes the loop. */}
      <Motion x={MAKE.x} y={MAKE.y} frame={ARRIVE} period={PREP_PERIOD} live={live}>
        <G x={0} y={0} scale={MAKE.s}>
          <Path d={BODY} fill="#FDFAF4" />
          <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        </G>
      </Motion>

      <Spark x={56} y={102} delay={0} live={live} />
      <Spark x={328} y={92} delay={1300} live={live} />
    </>
  )
}

function Tin({ live }: { live: boolean }) {
  return (
    <Motion x={TIN.x} y={TIN.y} frame={shake} period={PREP_PERIOD} live={live}>
      <Path
        d="M-11-24h22l3 40a5 5 0 0 1-5 5h-18a5 5 0 0 1-5-5z"
        fill="#D8D3CA"
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M-9-14h18" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <Rect x={-13} y={-33} width={26} height={10} rx={3} fill="#8D5524" stroke={INK} strokeWidth={2} />
      <Rect x={-5} y={-39} width={10} height={7} rx={2.5} fill={INK} />
    </Motion>
  )
}

/** A finished cup on the done side. Deliberately still: it is the thing the
 *  cup being made fades onto, so anything moving here would show at the seam. */
function DoneCup({ v }: { v: CupVisual }) {
  const uid = useRef(nextId()).current
  return (
    <G x={DONE_CUP.x} y={DONE_CUP.y} scale={DONE_CUP.s}>
      <Defs>
        <ClipPath id={`${uid}c`}>
          <Path d={BODY} />
        </ClipPath>
      </Defs>
      <Path d={BODY} fill="#FDFAF4" />
      <G clipPath={`url(#${uid}c)`}>
        <Rect x={0} y={LIQ_TOP + AMP} width={60} height={64} fill={v.liquid} />
        {PEARLS.map(([px, py], i) => (
          <Circle key={i} cx={px} cy={py} r={3.4} fill="#3B2317" />
        ))}
      </G>
      <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={9} y={14} width={42} height={5} rx={2} fill={INK} />
      <Rect x={33} y={0} width={4.5} height={20} rx={1.6} fill={INK} rotation={8} origin="35, 10" />
    </G>
  )
}

/** The cup being built: pearls down, tea poured over, lid pressed, straw
 *  through — then it slides onto the finished cup's exact spot and fades out
 *  there, with that cup already drawn underneath. */
function MakingCup({ v, live }: { v: CupVisual | undefined; live: boolean }) {
  const uid = useRef(nextId()).current
  const liquid = v?.liquid ?? '#C98A4B'
  const iceCount = v?.ice === 'extra' || v?.ice === 'normal' ? 2 : v?.ice === 'less' ? 1 : 0
  return (
    <Motion x={MAKE.x} y={MAKE.y} frame={HANDOFF} period={PREP_PERIOD} live={live}>
      <G x={0} y={0} scale={MAKE.s}>
        <Defs>
          <ClipPath id={`${uid}m`}>
            <Path d={BODY} />
          </ClipPath>
        </Defs>
        <Path d={BODY} fill="#FDFAF4" />
        <G clipPath={`url(#${uid}m)`}>
          <Motion x={0} y={0} frame={FILL} period={PREP_PERIOD} live={live}>
            <Rect x={0} y={LIQ_TOP + AMP} width={60} height={64} fill={liquid} />
            <Surface
              d={wavePath({ x0: 10, width: 40, top: LIQ_TOP, amplitude: AMP, wavelength: WL, depth: 4.5 })}
              color={light(liquid)}
              live={live}
            />
          </Motion>

          {PEARLS.map(([px, py], i) => (
            <Motion key={i} x={px} y={py} frame={PEARL_DROPS[i]} period={PREP_PERIOD} live={live}>
              <Circle r={3.4} fill="#3B2317" />
            </Motion>
          ))}

          {/* Ice comes down WITH the tea: it was shaken in the tin, not added
              after. Count follows the customer's own ice choice. */}
          {(
            [
              [20, LIQ_TOP + 8, -12],
              [34, LIQ_TOP + 13, 14],
            ] as [number, number, number][]
          )
            .slice(0, iceCount)
            .map(([ix, iy, rot], i) => (
              <Motion
                key={ix}
                x={ix + 4.5}
                y={iy + 4.5}
                rot={rot}
                frame={ICE_DROPS[i]}
                period={PREP_PERIOD}
                live={live}
              >
                <Rect x={-4.5} y={-4.5} width={9} height={9} rx={2} fill="#fff" opacity={0.55} />
              </Motion>
            ))}
        </G>
        <Path d={BODY} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />

        <Motion x={30} y={16.5} frame={SEAL} period={PREP_PERIOD} live={live}>
          <Rect x={-21} y={-2.5} width={42} height={5} rx={2} fill={INK} />
        </Motion>
        <Motion x={35} y={10} rot={8} frame={STRAW} period={PREP_PERIOD} live={live}>
          <Rect x={-2.25} y={-10} width={4.5} height={20} rx={1.6} fill={INK} />
        </Motion>
      </G>
    </Motion>
  )
}

/* ------------------------------- 4 · picked up ------------------------------ */

/** The counter after. This is the state a customer comes back to most — every
 *  order in their history lands here. */
function PickedUp({ live }: { live: boolean }) {
  return (
    <>
      <Counter />
      {/* The note sits still and the words ride on top of it as a real RN
          <Text> (see the overlay in OrderHero), rather than an SVG <Text>
          inside a moving <G>.
          Two reasons, both learned the hard way in #163: SVG text is the one
          API in this scene that the shipping CheckoutHero never uses, so it is
          the least proven thing here; and a swaying card would need the words
          to sway with it, which an overlay can't do. The sway goes, the words
          stay legible, and the stars and sparkles still carry the motion. */}
      <G x={180} y={COUNTER_Y}>
        <Rect x={-47} y={-44} width={94} height={44} rx={4} fill="#FFFDF6" stroke={INK} strokeWidth={1.8} />
        <Path d="M-11-14q11 9 22 0" fill="none" stroke="#E2645F" strokeWidth={2.4} strokeLinecap="round" />
      </G>
      {[0, 1].map((i) => (
        <Motion key={i} x={134 + i * 92} y={COUNTER_Y - 56} frame={STARS[i]} period={DONE_PERIOD} live={live}>
          <Path
            d="M0-9 2.8-3 9-2.4 4.4 2.1 5.6 8.6 0 5.5-5.6 8.6-4.4 2.1-9-2.4-2.8-3z"
            fill="#F2B64A"
            stroke={INK}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </Motion>
      ))}
      <Spark x={300} y={100} delay={0} live={live} />
      <Spark x={70} y={106} delay={1400} live={live} />
    </>
  )
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#F5E6D3',
    aspectRatio: FRAME.pickup.aspectRatio,
  },
  noteText: {
    ...StyleSheet.absoluteFillObject,
    top: '58%',
    alignItems: 'center',
  },
  noteWords: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 13,
    letterSpacing: 0.3,
    color: '#2A1E14',
  },
})
