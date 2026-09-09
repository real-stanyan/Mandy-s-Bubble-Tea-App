import type { ComponentType } from 'react'
import { Platform, StyleSheet } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { requireOptionalNativeModule } from 'expo'
import { IS_EVENING } from '@/constants/theme'

// Native blur, guarded: the binaries in customers' hands may predate
// expo-blur, and this file must survive an OTA onto one of those. The require
// is wrapped, and callers branch on the availability flags to paint a solid
// surface where blur is not there.
//
// iOS blurs anything. expo-blur's Android blur is an experimental, expensive
// path (it re-renders what is behind the view every frame), so only small
// chrome — the floating tab pill — opts into it; the menu head, a full-width
// band, stays solid on Android until that is worth the frames.

type BlurProps = {
  tint?: 'light' | 'dark' | 'default'
  intensity?: number
  experimentalBlurMethod?: 'none' | 'dimezisBlurView'
  style?: object
  children?: React.ReactNode
}

function loadBlurView(): ComponentType<BlurProps> | null {
  // The JS half of expo-blur rides in every OTA bundle, so require() alone
  // proves nothing: on a binary built before expo-blur was added, the view
  // mounts as an unknown native component and the screen under it goes
  // blank (the emulator's dev client, 2026-09-09). Ask for the native module
  // itself; null means this binary cannot blur.
  if (requireOptionalNativeModule('ExpoBlurView') == null) return null
  try {
    return (require('expo-blur') as { BlurView: ComponentType<BlurProps> }).BlurView
  } catch {
    return null
  }
}

const BlurView = loadBlurView()
// Reanimated drives the blur's intensity straight on the UI thread. That is
// the one supported way to fade a UIVisualEffectView — expo-blur runs it as a
// paused UIViewPropertyAnimator and intensity is its fraction; alpha on the
// effect view (or any view above it) breaks the effect, per Apple.
const AnimatedBlurView = BlurView ? Animated.createAnimatedComponent(BlurView) : null

/** True when this binary carries expo-blur and the platform blurs any surface
 *  natively — iOS. Large surfaces (the menu head) key off this. */
export const glassTabBarAvailable = BlurView !== null && Platform.OS === 'ios'

/** expo-blur's Android blur is experimental (dimezis): unverified on a real
 *  device with a binary that carries it, so it ships off. Flip this once the
 *  floating pill has been seen on an Android phone; until then Android gets
 *  the near-solid surface. */
const ANDROID_EXPERIMENTAL_BLUR = false

/** Whether a Frost with `small` will actually blur on this device. */
export function frostAvailable(small: boolean): boolean {
  if (BlurView === null) return false
  return Platform.OS === 'ios' || (small && ANDROID_EXPERIMENTAL_BLUR)
}

/** Paper over the blur: the board's "毛玻璃", denser than the tab pill's
 *  glass because these are full-width bands with the clock over them. By
 *  night the page sits at ~19/255 and a product photo at ~240; at 78% paper
 *  a row of photos passing under the head lit the strip under the status bar
 *  a clear step brighter than the rest of the head (Rick's phone,
 *  2026-09-09), so night is nearly opaque — the glass survives as a breath
 *  of light, not a band. Day's photos are as light as its paper. */
const PAPER_TINT = IS_EVENING ? 'rgba(26,21,18,0.94)' : 'rgba(255,249,240,0.9)'

type FrostProps = {
  /** Chrome small enough for the Android experimental blur; without it
   *  Android renders nothing here. */
  small?: boolean
  intensity?: number
  /** 0 → 1, how far in the frost is; the blur follows it, so a sheet can be
   *  nothing at all while its page rests and frost up as content slides
   *  under. Absent, the frost is simply on. */
  progress?: SharedValue<number>
}

/** The frosted sheet on its own; the caller paints its own tint over it
 *  (FROST_TINT is the head's). */
export function Frost({ small = false, intensity = 70, progress }: FrostProps) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: progress ? intensity * progress.value : intensity,
  }))
  if (!AnimatedBlurView) return null
  if (Platform.OS === 'android' && (!small || !ANDROID_EXPERIMENTAL_BLUR)) return null
  return (
    <AnimatedBlurView
      tint={IS_EVENING ? 'dark' : 'light'}
      animatedProps={animatedProps}
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      style={StyleSheet.absoluteFill}
    />
  )
}

export const FROST_TINT = PAPER_TINT
