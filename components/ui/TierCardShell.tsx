import { ReactNode, useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
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
import { RADIUS } from '@/constants/theme'
import type { MembershipTier } from '@/lib/membership-tier'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Android drops the continuous 3D tilt (perspective + rotateX/rotateY sway):
// re-compositing the layered gradient/SVG stack under a live perspective
// transform every frame janks hard enough to ANR on Android GPUs, while iOS
// composits it for free. The breathing reflection + sparkles (cheap single-view
// transforms) stay on both platforms.
const DISABLE_3D = Platform.OS === 'android'

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

export const TIER_VISUALS: Record<MembershipTier, TierVisual> = {
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

interface ShellProps {
  tier: MembershipTier
  onPress: () => void
  /** 3D reveal on mount (account page). Off for the always-visible Home hero. */
  entrance?: boolean
  children: ReactNode
}

/**
 * Shared dark-luxe member-card shell: tier materials, press scale, idle
 * reflection sweep + floating sway (web's no-gyro fallback), diamond
 * sparkles, embossed monogram. Content (rows, copy, CTA) comes as children.
 * Reduce-motion: materials render static, no loops, no entrance.
 */
export function TierCardShell({ tier, onPress, entrance = false, children }: ShellProps) {
  const [animate, setAnimate] = useState(false)
  const [cardW, setCardW] = useState(0)

  const scale = useSharedValue(1)
  const enter = useSharedValue(entrance ? 0 : 1)
  const swayY = useSharedValue(0)
  const swayX = useSharedValue(0)
  const reflex = useSharedValue(-0.22)

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
    enter.value = entrance
      ? withTiming(1, { duration: 1100, easing: Easing.out(Easing.poly(4)) })
      : 1
    // Idle: reflection breathes across the metal (web: xPercent -22 ↔ 22, 7s).
    reflex.value = withRepeat(withTiming(0.22, { duration: 7000, easing: sine }), -1, true)
    // Idle: gentle floating sway — web's no-gyro fallback timeline. Skipped on
    // Android (drives the 3D perspective tilt that ANRs there); values stay 0.
    if (!DISABLE_3D) {
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
    }
    return () => {
      cancelAnimation(reflex)
      cancelAnimation(swayY)
      cancelAnimation(swayX)
    }
  }, [animate, enter, entrance, reflex, swayX, swayY])

  const cardStyle = useAnimatedStyle(() => {
    // Android: flat 2D — no perspective, no rotateX/Y. Keeps the mount fade +
    // slide and the press scale, drops the per-frame 3D recomposite that ANRs.
    if (DISABLE_3D) {
      return {
        opacity: enter.value,
        transform: [
          { translateY: 20 * (1 - enter.value) },
          { scale: scale.value },
        ],
      }
    }
    return {
      opacity: enter.value,
      transform: [
        { perspective: 900 },
        { translateY: 20 * (1 - enter.value) },
        { rotateY: `${-42 * (1 - enter.value) + swayY.value}deg` },
        { rotateX: `${swayX.value}deg` },
        { scale: scale.value },
      ],
    }
  })

  const reflexStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reflex.value * cardW }],
  }))

  const visual = TIER_VISUALS[tier]

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withTiming(0.985, { duration: 160 }) }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 160 }) }}
      onPress={onPress}
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
                fontFamily: 'ShantellSans_700Bold',
                color: 'rgba(255,255,255,0.05)',
              }}
            >
              M
            </Text>

            {/* ── Card content ── */}
            {children}
          </LinearGradient>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  )
}
