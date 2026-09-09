import type { ComponentType } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { IS_EVENING } from '@/constants/theme'

// Native blur, guarded: the binaries in customers' hands may predate
// expo-blur, and this file must survive an OTA onto one of those. The require
// is wrapped, and callers (the floating tab bar, the menu head) branch on
// `glassTabBarAvailable` to paint a solid surface where blur is not there.
//
// iOS only. expo-blur's Android blur is an experimental, expensive path;
// Android keeps the solid paper bar until that is worth the frames.

type BlurProps = {
  tint?: 'light' | 'dark' | 'default'
  intensity?: number
  style?: object
  children?: React.ReactNode
}

function loadBlurView(): ComponentType<BlurProps> | null {
  if (Platform.OS !== 'ios') return null
  try {
    // Throws on a binary without the native module — that is the fallback.
    return (require('expo-blur') as { BlurView: ComponentType<BlurProps> }).BlurView
  } catch {
    return null
  }
}

const BlurView = loadBlurView()

/** True when this binary carries expo-blur and the platform blurs natively. */
export const glassTabBarAvailable = BlurView !== null

/** 80% paper over a 22px-ish blur: the board's "毛玻璃". */
const PAPER_TINT = IS_EVENING ? 'rgba(26,21,18,0.78)' : 'rgba(255,249,240,0.8)'

/** The frosted sheet on its own, for other floating chrome (the menu header):
 *  native blur where the binary has it, nothing where it does not — the
 *  caller paints its own tint over it (FROST_TINT is the bar's). */
export function Frost() {
  if (!BlurView) return null
  return (
    <BlurView tint={IS_EVENING ? 'dark' : 'light'} intensity={70} style={StyleSheet.absoluteFill} />
  )
}

export const FROST_TINT = PAPER_TINT
