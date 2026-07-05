import { useEffect, useState } from 'react'
import { AccessibilityInfo, Dimensions, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import type { MembershipTier } from '@/lib/membership-tier'
import { LAST_TIER_STORAGE_KEY, shouldCelebrate } from '@/lib/tier-up'

// RN port of web src/components/account/TierUpCelebration.tsx:
// AsyncStorage replaces localStorage, Reanimated confetti replaces the
// CSS keyframe animation. Copy and palette are identical to the web.

const CELEBRATION_MS = 2800
const REDUCED_MS = 1800
const CONFETTI_COUNT = 40
const PALETTE = ['#FFB380', '#e9c25c', '#8ec5ff', '#ffffff', '#9dffce']

const TOAST: Record<
  Exclude<MembershipTier, 'silver'>,
  { text: string; colors: [string, string, ...string[]] }
> = {
  gold: {
    text: 'Welcome to Gold! 🎉',
    colors: ['#b98a2c', '#8a5f14', '#e9c25c', '#a47620', '#9c6f1d'],
  },
  diamond: {
    text: 'Welcome to Diamond! 💎',
    colors: ['#11131a', '#1d2030', '#11131a'],
  },
}

/** Deterministic pseudo-random in [0, 1) from an index — keeps render stable. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function ConfettiPiece({ index }: { index: number }) {
  const screenHeight = Dimensions.get('window').height
  const progress = useSharedValue(0)

  const size = 6 + Math.round(jitter(index, 2) * 6) // 6–12px
  const height = size * (jitter(index, 3) > 0.5 ? 0.45 : 1)
  const leftPct = (index / CONFETTI_COUNT) * 100 + jitter(index, 1) * 2
  const delayMs = jitter(index, 5) * 900
  const spinDeg = 360 + jitter(index, 4) * 540

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: CELEBRATION_MS - 400, easing: Easing.in(Easing.quad) }),
    )
  }, [progress, delayMs])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -20 + progress.value * (screenHeight + 40) },
      { rotate: `${progress.value * spinDeg}deg` },
    ],
    opacity: progress.value < 0.8 ? 1 : Math.max(0, 1 - (progress.value - 0.8) * 5),
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: `${leftPct}%`,
          width: size,
          height,
          borderRadius: jitter(index, 4) > 0.6 ? size / 2 : 2,
          backgroundColor: PALETTE[index % PALETTE.length],
        },
        animatedStyle,
      ]}
    />
  )
}

type TierUpCelebrationProps = {
  tier: MembershipTier
}

export function TierUpCelebration({ tier }: TierUpCelebrationProps) {
  const [celebrating, setCelebrating] = useState<'gold' | 'diamond' | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const toastScale = useSharedValue(0.9)
  const toastOpacity = useSharedValue(0)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    ;(async () => {
      let prev: string | null = null
      try {
        prev = await AsyncStorage.getItem(LAST_TIER_STORAGE_KEY)
        // Always record the tier this device just saw.
        await AsyncStorage.setItem(LAST_TIER_STORAGE_KEY, tier)
      } catch {
        return // storage unavailable — skip celebration
      }
      if (!active) return
      if (!shouldCelebrate(prev, tier) || tier === 'silver') return

      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
      if (!active) return
      setReducedMotion(reduce)
      setCelebrating(tier)
      timer = setTimeout(() => setCelebrating(null), reduce ? REDUCED_MS : CELEBRATION_MS)
    })()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [tier])

  useEffect(() => {
    if (!celebrating) return
    toastOpacity.value = 0
    toastScale.value = 0.9
    toastOpacity.value = withTiming(1, { duration: 260 })
    toastScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.4)) })
  }, [celebrating, toastOpacity, toastScale])

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ scale: toastScale.value }],
  }))

  if (!celebrating) return null
  const toast = TOAST[celebrating]

  return (
    <View style={styles.overlay} pointerEvents="none">
      {!reducedMotion &&
        Array.from({ length: CONFETTI_COUNT }, (_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      <View style={styles.center}>
        <Animated.View style={toastStyle}>
          <LinearGradient
            colors={toast.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toast}
          >
            <Text style={styles.toastTitle}>{toast.text}</Text>
            <Text style={styles.toastSub}>New member perks unlocked</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  toast: {
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  toastTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#fff',
    textAlign: 'center',
  },
  toastSub: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
})
