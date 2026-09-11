import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type FrameInfo,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { LiquidCup } from '@/components/brand/LiquidCup'
import { IS_EVENING, T, TYPE } from '@/constants/theme'
import { LAUNCH, launchDismissDelay, nextCalm, timelineMayStart } from '@/lib/motion/launch-timeline'

// The app's front door: the native splash colour lifts into the page
// ground, a cup pours itself, pearls drop, the wordmark rises. Stays up
// until auth has settled AND the pour has finished — but never past
// LAUNCH.maxShowMs, so a hung network can't hide a working app.
//
// Starts on the same #2A1E14 the native splash uses (app.json → expo-splash-
// screen backgroundColor) so the hand-off from native to JS has no seam;
// BreathingGlow did the same job before this screen existed.
//
// The timeline starts when frames flow, not at mount. The first mount and
// draw of everything underneath (the home page, its drawings, the tab bar)
// hold the UI thread for its first few hundred ms, and a timeline started
// at mount played its opening beats, the colour lifting and the first of
// the pour, in frames nobody saw, then jumped (Rick, 2026-09-11: the
// opening animation stutters on both platforms). Held, the screen is the
// splash's own colour and an empty cup: nothing there to be seen moving.

const NATIVE_SPLASH_BG = '#2A1E14'
const WORDMARK = require('@/assets/images/wordmark.webp')
/** The glow's drawing size; the view it sits in stretches it to the screen. */
const GLOW_BOX = 96

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
  /** 1 once the timeline has started; the cup's pour starts off it too. */
  const go = useSharedValue(0)
  const calm = useSharedValue(0)
  /** When the timeline started, for the minimum show; null while it holds. */
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  // Hold until frames come calm, then start the timeline on the UI thread,
  // on that very frame. The callback stays registered while the screen is
  // up, but after the start it returns at once.
  const onStart = useCallback(() => setStartedAt(Date.now()), [])
  const onFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet'
      if (go.value === 1) return
      calm.value = nextCalm(calm.value, frame.timeSincePreviousFrame)
      if (!timelineMayStart(calm.value, frame.timeSinceFirstFrame)) return
      go.value = 1
      bg.value = withTiming(1, { duration: LAUNCH.bgFadeMs, easing: Easing.out(Easing.quad) })
      if (!reduced) {
        mark.value = withDelay(
          LAUNCH.wordmarkDelayMs,
          withTiming(1, { duration: LAUNCH.wordmarkMs, easing: Easing.out(Easing.exp) }),
        )
      }
      runOnJS(onStart)()
    },
    [go, calm, bg, mark, reduced, onStart],
  )
  useFrameCallback(onFrame)

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
    const now = Date.now()
    // The cap counts from mount, whatever else happens; the minimum show
    // counts from the start of the timeline, so the pour is never cut short.
    const capLeft = Math.max(0, LAUNCH.maxShowMs - (now - mountedAt.current))
    const delay =
      startedAt === null
        ? null
        : launchDismissDelay({ elapsedMs: now - startedAt, ready, reducedMotion: reduced })
    // Still holding, or not ready yet: arm the cap instead, re-armed whenever either changes.
    const t = setTimeout(startExit, Math.min(capLeft, delay ?? capLeft))
    return () => clearTimeout(t)
  }, [ready, reduced, startExit, startedAt])

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
      {/* The glow is a soft wash, so it is drawn small and stretched to the
          screen by the view it sits in. Drawn at full size it was a whole-
          screen raster on the launch's first frame (a software bitmap on
          Android) for a gradient nobody can tell from this one. */}
      <View
        pointerEvents="none"
        style={[styles.glow, { transform: [{ scaleX: width / GLOW_BOX }, { scaleY: height / GLOW_BOX }] }]}
      >
        <Svg width={GLOW_BOX} height={GLOW_BOX}>
          <Defs>
            <RadialGradient id="launchGlow" cx="50%" cy="34%" r="52%">
              <Stop offset="0" stopColor={T.star} stopOpacity={IS_EVENING ? 0.14 : 0.26} />
              <Stop offset="1" stopColor={T.star} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#launchGlow)" />
        </Svg>
      </View>

      <View style={styles.center}>
        <LiquidCup width={150} animate={!reduced} go={go} />
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
  // Centred, so the stretch (about the view's centre) lands it on the screen.
  glow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: GLOW_BOX,
    height: GLOW_BOX,
    marginLeft: -GLOW_BOX / 2,
    marginTop: -GLOW_BOX / 2,
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
