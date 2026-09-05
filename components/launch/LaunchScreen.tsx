import { useCallback, useEffect, useRef } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { LiquidCup } from '@/components/brand/LiquidCup'
import { IS_EVENING, T, TYPE } from '@/constants/theme'
import { LAUNCH, launchDismissDelay } from '@/lib/motion/launch-timeline'

// The app's front door: the native splash colour lifts into the page
// ground, a cup pours itself, pearls drop, the wordmark rises. Stays up
// until auth has settled AND the pour has finished — but never past
// LAUNCH.maxShowMs, so a hung network can't hide a working app.
//
// Starts on the same #2A1E14 the native splash uses (app.json → expo-splash-
// screen backgroundColor) so the hand-off from native to JS has no seam;
// BreathingGlow did the same job before this screen existed.

const NATIVE_SPLASH_BG = '#2A1E14'
const WORDMARK = require('@/assets/images/wordmark.webp')

type Props = {
  /** Auth has settled (or failed) — whatever is underneath is ready to be seen. */
  ready: boolean
  onDone: () => void
}

export function LaunchScreen({ ready, onDone }: Props) {
  const reduced = useReducedMotion()
  const { width, height } = useWindowDimensions()
  const mountedAt = useRef(Date.now())
  const doneRef = useRef(false)

  const bg = useSharedValue(0)
  const mark = useSharedValue(reduced ? 1 : 0)
  const exit = useSharedValue(0)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  useEffect(() => {
    bg.value = withTiming(1, { duration: LAUNCH.bgFadeMs, easing: Easing.out(Easing.quad) })
    if (!reduced) {
      mark.value = withDelay(
        LAUNCH.wordmarkDelayMs,
        withTiming(1, { duration: LAUNCH.wordmarkMs, easing: Easing.out(Easing.exp) }),
      )
    }
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startExit = useCallback(() => {
    exit.value = withTiming(
      1,
      { duration: reduced ? 200 : LAUNCH.exitMs, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(finish)()
      },
    )
  }, [exit, finish, reduced])

  useEffect(() => {
    const elapsedMs = Date.now() - mountedAt.current
    const delay = launchDismissDelay({ elapsedMs, ready, reducedMotion: reduced })
    // Not ready yet: arm the hard cap instead, re-armed whenever `ready` flips.
    const wait = delay ?? Math.max(0, LAUNCH.maxShowMs - elapsedMs)
    const t = setTimeout(startExit, wait)
    return () => clearTimeout(t)
  }, [ready, reduced, startExit])

  const shell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(bg.value, [0, 1], [NATIVE_SPLASH_BG, T.bg]),
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.04 }],
  }))
  const wordmark = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ translateY: (1 - mark.value) * 12 }],
  }))

  return (
    <Animated.View style={[styles.shell, shell]} pointerEvents="auto" testID="launch-screen">
      <StatusBar style={IS_EVENING ? 'light' : 'dark'} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="launchGlow" cx="50%" cy="34%" r="52%">
            <Stop offset="0" stopColor={T.star} stopOpacity={IS_EVENING ? 0.14 : 0.26} />
            <Stop offset="1" stopColor={T.star} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#launchGlow)" />
      </Svg>

      <View style={styles.center}>
        <LiquidCup width={150} animate={!reduced} />
        <Animated.View style={[styles.mark, wordmark]}>
          <Image source={WORDMARK} style={styles.wordmark} contentFit="contain" accessibilityLabel="Mandy's Bubble Tea" />
          <Text style={styles.tag}>SOUTHPORT · GOLD COAST</Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  mark: {
    marginTop: 26,
    alignItems: 'center',
  },
  wordmark: {
    width: 190,
    height: 90,
  },
  tag: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginTop: 12,
  },
})
