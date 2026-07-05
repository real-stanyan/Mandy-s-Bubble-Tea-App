import { memo, useEffect, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Icon } from '@/components/brand/Icon'
import { StarCupsRow } from '@/components/brand/StarCupsRow'
import { T, TYPE, RADIUS } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import type { MembershipTier } from '@/lib/membership-tier'
import type { LoyaltyAccount } from '@/types/square'

interface Props {
  account: LoyaltyAccount
  starsPerReward?: number
  tier: MembershipTier
  nextTier: Exclude<MembershipTier, 'silver'> | null
  starsToNext: number | null
  freeToppingsRemaining?: number | null
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Dark-luxe tier materials — a native port of the web card's layer stack
// (web src/components/account/LoyaltyCard.tsx TIER_VISUALS): metallic rim →
// key light → vignette → base metal, one breathing reflection band, diamond
// sparkles, embossed monogram. Conic holo + brushed-metal grain are the two
// web layers with no RN gradient primitive; the rest mirrors 1:1.
type TierVisual = {
  label: string
  gradient: [string, string, ...string[]]
  /** Metallic rim frame, web 155deg 4-stop. */
  rim: [string, string, string, string]
  /** Tint of the moving reflection band. */
  reflex: string
  /** Key-light tint (web's top radial). */
  keyLight: string
  keyLightOpacity: number
  shadowColor: string
  sparkles: boolean
}

const TIER_VISUALS: Record<MembershipTier, TierVisual> = {
  silver: {
    label: 'SILVER',
    gradient: ['#2c313d', '#485064', '#707a8c', '#414958', '#2d3340'],
    rim: ['rgba(255,255,255,0.75)', 'rgba(130,140,158,0.30)', 'rgba(18,22,32,0.85)', 'rgba(190,198,212,0.55)'],
    reflex: 'rgba(255,255,255,0.12)',
    keyLight: '#ffffff',
    keyLightOpacity: 0.18,
    shadowColor: '#0a0e18',
    sparkles: false,
  },
  gold: {
    label: 'GOLD',
    gradient: ['#392a0d', '#654c16', '#c2a045', '#574012', '#322307'],
    rim: ['rgba(255,238,180,0.9)', 'rgba(150,110,30,0.40)', 'rgba(38,24,2,0.9)', 'rgba(228,188,92,0.6)'],
    reflex: 'rgba(255,241,200,0.13)',
    keyLight: '#fff0c8',
    keyLightOpacity: 0.2,
    shadowColor: '#281a00',
    sparkles: false,
  },
  diamond: {
    label: 'DIAMOND',
    gradient: ['#04050a', '#10121d', '#04050a'],
    rim: ['rgba(175,205,255,0.55)', 'rgba(70,80,120,0.35)', 'rgba(0,0,0,0.95)', 'rgba(150,180,235,0.40)'],
    reflex: 'rgba(190,215,255,0.10)',
    keyLight: '#96b4ff',
    keyLightOpacity: 0.1,
    shadowColor: '#000000',
    sparkles: true,
  },
}

// Deterministic sparkle placement (mirrors web SPARKLES).
const SPARKLES: { left: `${number}%`; top: `${number}%`; size: number }[] = [
  { left: '8%', top: '20%', size: 9 },
  { left: '88%', top: '14%', size: 11 },
  { left: '72%', top: '40%', size: 8 },
  { left: '20%', top: '64%', size: 10 },
  { left: '56%', top: '82%', size: 9 },
  { left: '92%', top: '70%', size: 10 },
]

const sine = Easing.inOut(Easing.sin)

function Sparkle({
  left,
  top,
  size,
  index,
  animate,
}: (typeof SPARKLES)[number] & { index: number; animate: boolean }) {
  const glow = useSharedValue(0.08)

  useEffect(() => {
    if (!animate) return
    glow.value = withDelay(
      index * 400,
      withRepeat(withTiming(0.9, { duration: 900 + index * 140, easing: sine }), -1, true),
    )
    return () => cancelAnimation(glow)
  }, [animate, glow, index])

  const style = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.5 + glow.value * 0.55 }],
  }))

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left,
          top,
          fontSize: size,
          color: '#fff',
          textShadowColor: 'rgba(180,215,255,0.8)',
          textShadowRadius: 6,
        },
        style,
      ]}
    >
      ✦
    </Animated.Text>
  )
}

export const LoyaltyCard = memo(function LoyaltyCard({
  account,
  starsPerReward = LOYALTY.starsForReward,
  tier,
  nextTier,
  starsToNext,
  freeToppingsRemaining,
}: Props) {
  const router = useRouter()
  const [animate, setAnimate] = useState(false)
  const [cardW, setCardW] = useState(0)

  const scale = useSharedValue(1)
  const enter = useSharedValue(0)
  const swayY = useSharedValue(0)
  const swayX = useSharedValue(0)
  const reflex = useSharedValue(-0.22)

  // One-shot reduce-motion check (same pattern as TierUpCelebration): loops
  // and the 3D entrance only run when motion is OK; the material layers
  // themselves are static and always render.
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!active) return
        if (reduce) {
          enter.value = 1
        } else {
          setAnimate(true)
        }
      })
      .catch(() => {
        if (active) setAnimate(true)
      })
    return () => {
      active = false
    }
  }, [enter])

  useEffect(() => {
    if (!animate) return
    // Entrance: smooth 3D reveal (web: rotationY -42 → 0, y 20 → 0).
    enter.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.poly(4)) })
    // Idle: reflection breathes across the metal (web: xPercent -22 ↔ 22, 7s).
    reflex.value = withRepeat(withTiming(0.22, { duration: 7000, easing: sine }), -1, true)
    // Idle: gentle floating sway — web's no-gyro fallback timeline.
    swayY.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 3200, easing: sine }),
        withTiming(-4, { duration: 3200, easing: sine }),
      ),
      -1,
      true,
    )
    swayX.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 3200, easing: sine }),
        withTiming(2.5, { duration: 3200, easing: sine }),
      ),
      -1,
      true,
    )
    return () => {
      cancelAnimation(reflex)
      cancelAnimation(swayY)
      cancelAnimation(swayX)
    }
  }, [animate, enter, reflex, swayX, swayY])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { perspective: 900 },
      { translateY: 20 * (1 - enter.value) },
      { rotateY: `${-42 * (1 - enter.value) + swayY.value}deg` },
      { rotateX: `${swayX.value}deg` },
      { scale: scale.value },
    ],
  }))

  const reflexStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reflex.value * cardW }],
  }))

  const goal = starsPerReward > 0 ? starsPerReward : 1
  const currentStars = account.balance % goal
  const toGo = Math.max(0, goal - currentStars)
  const reached = account.balance >= goal

  const visual = TIER_VISUALS[tier]
  const tierSubline =
    tier === 'diamond' && freeToppingsRemaining != null
      ? `${freeToppingsRemaining} free toppings left this month`
      : starsToNext != null
        ? `${starsToNext} stars to ${nextTier === 'gold' ? 'Gold' : 'Diamond'}`
        : 'Top tier member'

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <AnimatedPressable
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 160 }) }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 160 }) }}
        onPress={() => router.push('/promotions')}
        onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
        style={[
          cardStyle,
          {
            borderRadius: RADIUS.card,
            shadowColor: visual.shadowColor,
            shadowOpacity: 0.55,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 14 },
            elevation: 10,
          },
        ]}
      >
        {/* Metallic rim: 1.5px gradient frame around the card body. */}
        <LinearGradient
          colors={visual.rim}
          locations={[0, 0.3, 0.68, 1]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={{ borderRadius: RADIUS.card, padding: 1.5 }}
        >
          <View style={{ borderRadius: RADIUS.card - 1.5, overflow: 'hidden' }}>
            <LinearGradient
              colors={visual.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ padding: 22 }}
            >
              {/* ── Decorative layers (behind content, never intercept taps) ── */}
              {/* Key light + vignette (web's two radial washes). */}
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <RadialGradient id="keylight" cx="20%" cy="-10%" r="80%">
                    <Stop offset="0" stopColor={visual.keyLight} stopOpacity={visual.keyLightOpacity} />
                    <Stop offset="0.36" stopColor={visual.keyLight} stopOpacity={visual.keyLightOpacity * 0.22} />
                    <Stop offset="0.58" stopColor={visual.keyLight} stopOpacity="0" />
                  </RadialGradient>
                  <RadialGradient id="vignette" cx="50%" cy="130%" r="95%">
                    <Stop offset="0" stopColor="#000" stopOpacity="0.45" />
                    <Stop offset="0.38" stopColor="#000" stopOpacity="0.16" />
                    <Stop offset="0.62" stopColor="#000" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#keylight)" />
                <Rect width="100%" height="100%" fill="url(#vignette)" />
              </Svg>
              {/* Breathing reflection: one wide soft light sweeping the metal. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: 'absolute', top: 0, bottom: 0, left: '-30%', width: '160%' },
                  reflexStyle,
                ]}
              >
                <LinearGradient
                  colors={['transparent', visual.reflex, visual.reflex, 'transparent']}
                  locations={[0.3, 0.48, 0.52, 0.7]}
                  start={{ x: 0, y: 0.35 }}
                  end={{ x: 1, y: 0.65 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              {visual.sparkles
                ? SPARKLES.map((s, i) => (
                    <Sparkle key={i} {...s} index={i} animate={animate} />
                  ))
                : null}
              {/* Embossed brand monogram. */}
              <Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: 16,
                  bottom: -20,
                  fontSize: 96,
                  lineHeight: 96,
                  fontFamily: 'Fraunces_500Medium',
                  color: 'rgba(255,255,255,0.05)',
                }}
              >
                M
              </Text>

              {/* ── Card content ── */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: T.peach }} />
                    <Text style={[TYPE.eyebrow, { color: 'rgba(255,255,255,0.7)' }]}>
                      MANDY&apos;S REWARDS
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                    <Text
                      style={{
                        fontFamily: 'Fraunces_500Medium',
                        fontSize: 36,
                        lineHeight: 36,
                        letterSpacing: -0.8,
                        color: '#fff',
                      }}
                    >
                      {account.balance}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Fraunces_500Medium',
                        fontSize: 24,
                        color: 'rgba(255,255,255,0.45)',
                        marginLeft: 6,
                      }}
                    >
                      {` / ${goal} stars`}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.22)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Icon
                    name={tier === 'diamond' ? 'gem' : 'star'}
                    color={tier === 'diamond' ? '#8ec5ff' : T.peach}
                    size={12}
                  />
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 10.5,
                      letterSpacing: 1.6,
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {visual.label}
                  </Text>
                </View>
              </View>

              <StarCupsRow value={currentStars} total={goal} />

              <View
                style={{
                  marginTop: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)' }]}>
                    {reached ? (
                      '🎉 Free drink ready to redeem'
                    ) : (
                      <>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fff' }}>{toGo}</Text>
                        {` stars until a free drink`}
                      </>
                    )}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: 'Inter_400Regular',
                      fontSize: 11,
                      lineHeight: 15,
                      letterSpacing: 0.3,
                      color: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {tierSubline}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: reached ? T.peach : 'rgba(255,255,255,0.18)',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 12.5,
                      color: reached ? T.brandDark : '#fff',
                    }}
                  >
                    {reached ? 'Redeem' : 'View'}
                  </Text>
                  <Icon name="arrow" color={reached ? T.brandDark : '#fff'} size={12} />
                </View>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  )
})
