import type { ComponentType } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { IS_EVENING } from '@/constants/theme'

// Frosted tab bar: content scrolls under it and shows through as blur, the
// way paper laid over the page would. Blur is native (expo-blur), which
// the binaries in customers' hands may predate — this file must survive an
// OTA onto one of those: the require is guarded, and callers branch on
// `glassTabBarAvailable` to keep the solid bar (and the old layout) there.
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

export function GlassTabBarBackground() {
  if (!BlurView) return <View style={styles.solid} />
  return (
    <BlurView tint={IS_EVENING ? 'dark' : 'light'} intensity={70} style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: PAPER_TINT }]} />
    </BlurView>
  )
}

const styles = StyleSheet.create({
  solid: { ...StyleSheet.absoluteFillObject, backgroundColor: IS_EVENING ? '#1A1512' : '#FFF9F0' },
})
