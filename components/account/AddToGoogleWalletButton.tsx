import { memo, useCallback, useEffect, useState } from 'react'
import { Alert, Platform, StyleSheet, Text, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SPACING, SHADOW } from '@/constants/theme'
import {
  AddToGoogleWalletButton as NativeAddButton,
  googleWalletAvailable,
  isGoogleWalletReady,
  saveToGoogleWallet,
} from '@/modules/google-wallet'

// Android twin of AddToWalletButton (Apple). Same card row, same copy, but
// the call-to-action is Google's own button, full-width under the text,
// because Google's guidelines fix its height at 48dp and its width at no
// less than any neighbouring button — it does not fit the Apple row's pill.
//
// Flow: POST /api/wallet/google/jwt → PayClient.savePassesJwt (Google's
// sheet) → on RESULT_OK, POST /api/wallet/google/saved so the backend knows
// without waiting for Google's hasUsers to flip.

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://mandybubbletea.com'

type State = 'checking' | 'unavailable' | 'idle' | 'loading' | 'added'

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function fetchStatus(): Promise<{ available: boolean; added: boolean }> {
  try {
    const jwt = await bearer()
    if (!jwt) return { available: false, added: false }
    const r = await fetch(`${API_BASE}/api/wallet/google/status`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!r.ok) return { available: false, added: false }
    const j = (await r.json()) as { available?: boolean; added?: boolean }
    return { available: Boolean(j.available), added: Boolean(j.added) }
  } catch {
    return { available: false, added: false }
  }
}

export const AddToGoogleWalletButton = memo(function AddToGoogleWalletButton() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    if (Platform.OS !== 'android' || !googleWalletAvailable) {
      setState('unavailable')
      return
    }
    let alive = true
    ;(async () => {
      const [ready, status] = await Promise.all([isGoogleWalletReady(), fetchStatus()])
      if (!alive) return
      if (!ready || !status.available) setState('unavailable')
      else setState(status.added ? 'added' : 'idle')
    })()
    return () => {
      alive = false
    }
  }, [])

  const onPress = useCallback(async () => {
    setState('loading')
    try {
      const jwt = await bearer()
      if (!jwt) throw new Error('no session')

      const r = await fetch(`${API_BASE}/api/wallet/google/jwt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (r.status === 503) {
        setState('unavailable')
        return
      }
      if (!r.ok) throw new Error(`jwt failed: ${r.status}`)
      const { jwt: saveJwt } = (await r.json()) as { jwt: string }

      const outcome = await saveToGoogleWallet(saveJwt)
      if (outcome.result === 'saved') {
        setState('added')
        fetch(`${API_BASE}/api/wallet/google/saved`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
        }).catch(() => {})
        return
      }
      setState('idle')
      if (outcome.result === 'error') {
        console.warn('[AddToGoogleWalletButton]', outcome.message)
        Alert.alert('Could not add card', 'Google Wallet did not accept the card. Please try again.')
      }
    } catch (e) {
      console.warn('[AddToGoogleWalletButton]', e)
      setState('idle')
      Alert.alert('Could not add card', 'Please try again.')
    }
  }, [])

  if (state === 'checking' || state === 'unavailable') return null

  const added = state === 'added'
  const subtitle = added
    ? 'Added to Google Wallet'
    : state === 'loading'
      ? 'Preparing your card…'
      : 'Scan at the counter — updates automatically'

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Icon name="card" color={T.ink2} size={22} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Save your member card</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {added ? (
          <View style={styles.addedBadge}>
            <Icon name="check" color={T.brand} size={16} />
          </View>
        ) : null}
      </View>
      {added ? null : (
        <NativeAddButton enabled={state === 'idle'} onPress={onPress} style={styles.button} />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    gap: SPACING.md,
    ...SHADOW.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.tile,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...TYPE.cardTitle,
    color: T.ink,
  },
  subtitle: {
    ...TYPE.body,
    color: T.ink3,
    marginTop: 2,
  },
  addedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Google: 48dp minimum height, 8dp clear space on every side.
  button: {
    height: 48,
    width: '100%',
    marginVertical: 8,
  },
})
