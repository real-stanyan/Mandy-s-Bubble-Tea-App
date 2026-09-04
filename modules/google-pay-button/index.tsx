import type { StyleProp, ViewStyle } from 'react-native'
import { Platform } from 'react-native'
import { requireNativeViewManager } from 'expo-modules-core'
import type { ComponentType } from 'react'

// Google's own payment button (Android). See the Kotlin module for why we
// don't draw our own.
//
// The native view only exists in a binary built after 2026-09-04. This file
// must therefore survive being loaded by an OLDER binary over OTA: the
// require is wrapped, a miss yields null, and the checkout falls back to its
// ordinary CTA. Without that guard an OTA to v1.2.0 would crash the moment
// the checkout mounted.

export type GooglePayButtonProps = {
  /** DARK = black button, for light backgrounds. LIGHT = white button. */
  theme?: 'dark' | 'light'
  /** Wordmark: "Pay with G Pay", "Buy with…", "Book with…" etc. */
  type?: 'pay' | 'buy' | 'checkout' | 'order' | 'plain'
  /** dp. Google clamps this to its own permitted range. */
  cornerRadius?: number
  enabled?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

type NativeProps = Omit<GooglePayButtonProps, 'onPress'> & {
  onPress?: (event: unknown) => void
}

function loadNativeView(): ComponentType<NativeProps> | null {
  if (Platform.OS !== 'android') return null
  try {
    return requireNativeViewManager<NativeProps>('GooglePayButton')
  } catch {
    return null
  }
}

const NativeGooglePayButton = loadNativeView()

/** True when this binary can draw Google's button. Callers must branch on
 *  it — never render the component blind. */
export const googlePayButtonAvailable = NativeGooglePayButton !== null

export function GooglePayButton({
  theme = 'dark',
  type = 'pay',
  cornerRadius = 26,
  enabled = true,
  onPress,
  style,
}: GooglePayButtonProps) {
  if (!NativeGooglePayButton) return null
  return (
    <NativeGooglePayButton
      theme={theme}
      type={type}
      cornerRadius={cornerRadius}
      enabled={enabled}
      onPress={() => onPress?.()}
      style={style}
    />
  )
}
