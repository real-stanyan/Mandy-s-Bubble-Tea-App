import type { ComponentType } from 'react'
import { Platform, StyleSheet } from 'react-native'
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

/** True when this binary carries expo-blur and the platform blurs any surface
 *  natively — iOS. Large surfaces (the menu head) key off this. */
export const glassTabBarAvailable = BlurView !== null && Platform.OS === 'ios'

/** Whether a Frost with `small` will actually blur on this device. */
export function frostAvailable(small: boolean): boolean {
  if (BlurView === null) return false
  return Platform.OS === 'ios' || small
}

/** 80% paper over a 22px-ish blur: the board's "毛玻璃". */
const PAPER_TINT = IS_EVENING ? 'rgba(26,21,18,0.78)' : 'rgba(255,249,240,0.8)'

/** The frosted sheet on its own; the caller paints its own tint over it
 *  (FROST_TINT is the head's). `small` marks chrome small enough for the
 *  Android experimental blur; without it Android renders nothing here. */
export function Frost({ small = false, intensity = 70 }: { small?: boolean; intensity?: number }) {
  if (!BlurView) return null
  if (Platform.OS === 'android') {
    if (!small) return null
    return (
      <BlurView
        tint={IS_EVENING ? 'dark' : 'light'}
        intensity={intensity}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
    )
  }
  return (
    <BlurView tint={IS_EVENING ? 'dark' : 'light'} intensity={intensity} style={StyleSheet.absoluteFill} />
  )
}

export const FROST_TINT = PAPER_TINT
