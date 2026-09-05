import { useEffect, useMemo } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg'
import { resolveCupVisual, describeCup, type ToppingVisual } from '@/lib/cup-visual'
import { wavePath } from '@/lib/motion/wave'
import { T, TYPE } from '@/constants/theme'

// The drink the customer is building, drawn as they build it — the app port
// of the web's CupPreview (same geometry, same cup-visual mapping). Decoration
// for a form that stays the source of truth: the caption says the same build
// in words, and an unrecognised modifier simply doesn't draw.
//
// Toppings and ice drop in when picked, as on the web (CSS keyframes there).
// Each piece is keyed by what it is, so picking a topping MOUNTS its shapes
// and the drop runs once, on mount; changing something else re-renders the
// existing pieces in place without replaying it. react-native-svg elements
// don't take Animated styles, so the drop is an animated `translateY` /
// `opacity` prop on a wrapping <G> (Stan, 2026-09-05: "no motion in the app").

const LIQUID_TOP = 58
const CUP_FLOOR = 175
const BED_H = 9
const MAX_BEDS = 6

// The drink pours in (Rise) and its surface keeps moving (Wave). The ribbon
// replaces the old flat ellipse: its crests sit a hair above LIQUID_TOP, so
// the liquid rect starts one amplitude lower and the wavy edge IS the
// surface. Both are <G>s driven through rn-svg's native `matrix` prop.
const SURFACE_AMPLITUDE = 1.6
const SURFACE_WAVELENGTH = 24
const SURFACE = wavePath({
  x0: 25,
  width: 70,
  top: LIQUID_TOP,
  amplitude: SURFACE_AMPLITUDE,
  wavelength: SURFACE_WAVELENGTH,
  depth: 9,
})
/** The pour starts with the surface at the cup floor. */
const RISE_FROM = 187 - LIQUID_TOP

// Interior wall — matches the clip path so beds are cut to the cup's taper.
const HALF_AT_TOP = 31.5
const TAPER_PER_PX = (31.5 - 26) / (180.5 - 44)
function halfWidthAt(y: number): number {
  return HALF_AT_TOP - (y - 44) * TAPER_PER_PX
}

const AnimatedG = Animated.createAnimatedComponent(G)

/**
 * Drops its children into place from above, once, when mounted. Spring so it
 * lands with a small settle rather than a stop; the web's curve overshoots
 * the same way. Reduced-motion users get the pieces already in place.
 */
function Drop({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion()
  const ty = useSharedValue(reduced ? 0 : -34)
  const op = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    ty.value = withDelay(delay, withSpring(0, { damping: 11, stiffness: 190, mass: 0.7 }))
    op.value = withDelay(delay, withTiming(1, { duration: 140 }))
    // Mount only: the whole point is that a piece drops when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // `matrix` and `opacity` are the group's NATIVE props (rn-svg
  // GroupNativeComponent). translateY / x / y are JS-side sugar that rn-svg
  // folds into `matrix` while rendering, so setting them from a worklet does
  // nothing on the new architecture — the first cut of this drop never moved.
  const animatedProps = useAnimatedProps(() => ({
    matrix: [1, 0, 0, 1, 0, ty.value],
    opacity: op.value,
  }))
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>
}

/**
 * Lifts everything in the cup from the floor to its resting place once, on
 * mount — the drink pours in when the sheet opens. Toppings and ice keep
 * their own drops inside it. Reduced motion: already full.
 */
function Rise({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const ty = useSharedValue(reduced ? 0 : RISE_FROM)
  // Invisible until the first animation frame: a <G> takes its native matrix
  // from its own props on the first render, so the drink would flash in place
  // before jumping to the floor to pour (LiquidCup has the same guard).
  const shown = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    ty.value = withDelay(60, withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }))
    shown.value = withDelay(60, withTiming(1, { duration: 40 }))
    return () => {
      cancelAnimation(ty)
      cancelAnimation(shown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const animatedProps = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, 0, ty.value], opacity: shown.value }))
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>
}

/** The liquid's surface: one wavelength scrolls past every 2.2s, seamlessly. */
function Surface({ color, opacity }: { color: string; opacity: number }) {
  const reduced = useReducedMotion()
  const tx = useSharedValue(0)
  useEffect(() => {
    if (reduced) return
    tx.value = withRepeat(
      withTiming(-SURFACE_WAVELENGTH, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(tx)
  }, [reduced, tx])
  const animatedProps = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, tx.value, 0], opacity }))
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={SURFACE} fill={color} />
    </AnimatedG>
  )
}

const ICE_SLOTS: Array<[number, number, number]> = [
  [50, 70, -12],
  [66, 66, 9],
  [74, 78, 18],
  [46, 84, -5],
  [62, 88, 13],
  [72, 96, -9],
]

interface Props {
  drinkName: string
  /** Every modifier currently on, with its count — unrecognised ones no-op. */
  picked: Array<{ name: string; count: number }>
}

export function CupPreview({ drinkName, picked }: Props) {
  const visual = useMemo(
    () => resolveCupVisual({ drinkName, picked }),
    [drinkName, picked],
  )

  const iceCount =
    visual.ice === 'extra' ? 6 : visual.ice === 'normal' ? 5 : visual.ice === 'less' ? 2 : 0
  const liquidOpacity = Math.min(1, 0.74 + Math.min(visual.sugar, 1) * 0.26)

  const sunken = visual.toppings.filter((t) => t.placement === 'bottom')
  const floating = visual.toppings.filter((t) => t.placement === 'top')

  const beds: Array<{ t: ToppingVisual; y: number }> = []
  let level = 0
  for (const t of sunken) {
    const depth = Math.min(t.count, 2)
    for (let d = 0; d < depth && level < MAX_BEDS; d++) {
      beds.push({ t, y: CUP_FLOOR - level * BED_H })
      level++
    }
  }

  const foamTop = LIQUID_TOP
  const foamHeight = 17
  const bruleeTop = visual.hasFoam ? foamTop - 5 : LIQUID_TOP - 3

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: T.line,
        backgroundColor: T.bg2,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Svg width={96} height={156} viewBox="0 0 120 196">
        <Defs>
          <ClipPath id="cupClip">
            <Path d="M28.5,44 L91.5,44 L87,176 Q86.5,180.5 81.5,180.5 L38.5,180.5 Q33.5,180.5 33,176 Z" />
          </ClipPath>
          <LinearGradient id="cupLiquid" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={visual.liquidLight} />
            <Stop offset="0.55" stopColor={visual.liquid} />
            <Stop offset="1" stopColor={visual.liquid} />
          </LinearGradient>
        </Defs>

        <G clipPath="url(#cupClip)">
          <Rect x={25} y={40} width={70} height={145} fill="#FDFAF4" />
          <Rise>
          <Rect
            x={25}
            y={LIQUID_TOP + SURFACE_AMPLITUDE}
            width={70}
            height={187 - LIQUID_TOP - SURFACE_AMPLITUDE}
            fill="url(#cupLiquid)"
            opacity={liquidOpacity}
          />
          <Surface color={visual.liquidLight} opacity={Math.min(1, liquidOpacity + 0.1)} />

          {beds.map((b, i) => (
            <Drop key={`${b.t.name}-${i}`} delay={i * 60}>
              <Bed topping={b.t} y={b.y} />
            </Drop>
          ))}

          {visual.hasFoam && (
            <G>
              <Rect x={25} y={foamTop} width={70} height={foamHeight} fill="#FBF1DF" />
              <Ellipse
                cx={60}
                cy={foamTop + foamHeight}
                rx={halfWidthAt(foamTop + foamHeight)}
                ry={3}
                fill="#F3E4CB"
              />
              <Ellipse cx={60} cy={foamTop} rx={halfWidthAt(foamTop)} ry={3.2} fill="#FFF9EE" />
            </G>
          )}

          {floating.map((t) => (
            <Drop key={t.name}>
              <CrumbLayer topping={t} y={visual.hasFoam ? foamTop - 2 : LIQUID_TOP - 2} />
            </Drop>
          ))}

          {visual.hasBrulee && (
            <G>
              <Rect x={25} y={bruleeTop} width={70} height={7} fill="#C98A3C" />
              <Ellipse cx={60} cy={bruleeTop} rx={halfWidthAt(bruleeTop)} ry={3} fill="#E0A557" />
              <Circle cx={51} cy={bruleeTop + 3} r={1.5} fill="#A96A26" />
              <Circle cx={65} cy={bruleeTop + 4} r={1.2} fill="#A96A26" />
              <Circle cx={72} cy={bruleeTop + 2.5} r={1} fill="#A96A26" />
            </G>
          )}

          {Array.from({ length: iceCount }).map((_, i) => {
            const [x, y, rot] = ICE_SLOTS[i]
            return (
              <Drop key={`ice-${i}`} delay={i * 40}>
                <Rect
                  x={x - 5.5}
                  y={y - 5.5}
                  width={11}
                  height={11}
                  rx={3}
                  fill="#FFFFFF"
                  opacity={0.42}
                  transform={`rotate(${rot} ${x} ${y})`}
                />
              </Drop>
            )
          })}
          </Rise>
        </G>

        <Path
          d="M26,41 L94,41 L89.5,177 Q89,183 83,183 L37,183 Q31,183 30.5,177 Z"
          fill="none"
          stroke="#2A1E14"
          strokeOpacity={0.17}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Straw behind the flat sealed lid, matching the web cup. */}
        <G transform="rotate(12 70 36)">
          <Rect
            x={65.5}
            y={5}
            width={9}
            height={33}
            rx={4.5}
            fill="#F4E4CB"
            stroke="#E0CDAE"
            strokeWidth={1.2}
          />
        </G>
        <Rect
          x={22}
          y={32}
          width={76}
          height={7}
          rx={3.5}
          fill="#F7EFE1"
          stroke="#2A1E14"
          strokeOpacity={0.17}
          strokeWidth={2}
        />
        <Rect
          x={24.5}
          y={38}
          width={71}
          height={5}
          rx={2}
          fill="#EFE3CE"
          stroke="#2A1E14"
          strokeOpacity={0.14}
          strokeWidth={1.4}
        />

        {visual.ice === 'warm' && (
          <G fill="none" stroke="#C9B79E" strokeWidth={2} strokeLinecap="round">
            <Path d="M48,27 q4,-6 0,-12" opacity={0.5} />
            <Path d="M60,24 q4,-7 0,-14" opacity={0.5} />
            <Path d="M72,27 q4,-6 0,-12" opacity={0.5} />
          </G>
        )}
      </Svg>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[TYPE.eyebrow, { color: T.brand }]}>YOUR CUP</Text>
        <Text
          style={{ fontFamily: 'ShantellSans_600SemiBold', fontSize: 14, color: T.ink, marginTop: 4 }}
          numberOfLines={2}
        >
          {drinkName}
        </Text>
        <Text
          style={{
            fontFamily: 'ShantellSans_400Regular',
            fontSize: 12.5,
            lineHeight: 18,
            color: T.ink3,
            marginTop: 4,
          }}
        >
          {describeCup(visual)}
        </Text>
      </View>
    </View>
  )
}

/** One packed layer of a topping — count deepens the bed, never scatters. */
function Bed({ topping, y }: { topping: ToppingVisual; y: number }) {
  const half = halfWidthAt(y) - 2
  const size = topping.shape === 'pearl' ? 9.5 : 8.5
  const per = Math.max(3, Math.floor((half * 2) / (size + 0.5)))
  const step = (half * 2) / per
  const startX = 60 - half + step / 2

  return (
    <G>
      {Array.from({ length: per }).map((_, i) => {
        const cx = startX + i * step
        const color = topping.colors[i % topping.colors.length]
        if (topping.shape === 'cube') {
          return (
            <Rect
              key={i}
              x={cx - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rx={2}
              fill={color}
              opacity={0.94}
              transform={`rotate(${i % 2 === 0 ? -9 : 8} ${cx} ${y})`}
            />
          )
        }
        return (
          <Circle
            key={i}
            cx={cx}
            cy={y}
            r={size / 2}
            fill={color}
            opacity={topping.shape === 'pearl' ? 1 : 0.94}
          />
        )
      })}
    </G>
  )
}

/** Crushed cookie floating on the surface. */
function CrumbLayer({ topping, y }: { topping: ToppingVisual; y: number }) {
  const half = halfWidthAt(y) - 2.5
  const color = topping.colors[0]
  const crumbs = [
    [-0.82, 0, 2.3],
    [-0.5, 2.3, 1.6],
    [-0.16, -0.6, 2.7],
    [0.18, 1.8, 1.8],
    [0.5, -0.2, 2.4],
    [0.8, 2.0, 1.6],
    [-0.66, 3.3, 1.4],
    [0.34, 3.4, 1.5],
  ] as const

  return (
    <G>
      <Rect x={60 - half} y={y} width={half * 2} height={4} rx={2} fill={color} opacity={0.9} />
      {crumbs.map(([fx, dy, r], i) => (
        <Circle key={i} cx={60 + fx * half} cy={y + dy} r={r} fill={color} opacity={0.92} />
      ))}
    </G>
  )
}
