import type { StyleProp, ViewStyle } from 'react-native'
import { Platform } from 'react-native'
import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core'
import type { ComponentType } from 'react'

// Google Wallet member card (Android). See the Kotlin module for why the
// button and the save both have to be Google's.
//
// Like google-pay-button, this file must survive an OTA onto a binary that
// predates the native module: every require is guarded, and callers branch on
// `googleWalletAvailable` before rendering anything.

type NativeModule = {
  isAvailable(): Promise<boolean>
  savePassJwt(jwt: string): Promise<string>
}

type NativeButtonProps = {
  enabled?: boolean
  onPress?: (event: unknown) => void
  style?: StyleProp<ViewStyle>
}

function loadModule(): NativeModule | null {
  if (Platform.OS !== 'android') return null
  try {
    return requireNativeModule<NativeModule>('GoogleWallet')
  } catch {
    return null
  }
}

function loadButton(): ComponentType<NativeButtonProps> | null {
  if (Platform.OS !== 'android') return null
  try {
    return requireNativeViewManager<NativeButtonProps>('GoogleWallet')
  } catch {
    return null
  }
}

const native = loadModule()
const NativeButton = loadButton()

/** True when this binary carries the Google Wallet module. */
export const googleWalletAvailable = native !== null && NativeButton !== null

/** Google Wallet is installed and can save passes for the signed-in account. */
export async function isGoogleWalletReady(): Promise<boolean> {
  if (!native) return false
  try {
    return await native.isAvailable()
  } catch {
    return false
  }
}

export type SaveToGoogleWalletResult =
  | { result: 'saved' }
  | { result: 'canceled' }
  | { result: 'error'; message: string }

/** Opens Google's save sheet for a backend-signed "savetowallet" JWT. */
export async function saveToGoogleWallet(jwt: string): Promise<SaveToGoogleWalletResult> {
  if (!native) return { result: 'error', message: 'Google Wallet module unavailable' }
  const raw = await native.savePassJwt(jwt)
  if (raw === 'saved') return { result: 'saved' }
  if (raw === 'canceled') return { result: 'canceled' }
  return { result: 'error', message: raw.replace(/^error:/, '') }
}

export type AddToGoogleWalletButtonProps = {
  enabled?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

/** Google's own "Add to Google Wallet" button (48dp tall, full width). */
export function AddToGoogleWalletButton({ enabled = true, onPress, style }: AddToGoogleWalletButtonProps) {
  if (!NativeButton) return null
  return <NativeButton enabled={enabled} onPress={() => onPress?.()} style={style} />
}
