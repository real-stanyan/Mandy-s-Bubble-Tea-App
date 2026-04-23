import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SPACING, SHADOW } from '@/constants/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://mandybubbletea.com'

type State = 'idle' | 'loading' | 'polling' | 'added'

interface Props {
  onAdded?: () => void
}

async function fetchAdded(): Promise<boolean> {
  try {
    const { data: sess } = await supabase.auth.getSession()
    const jwt = sess.session?.access_token
    if (!jwt) return false
    const r = await fetch(`${API_BASE}/api/wallet/pass/status`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!r.ok) return false
    const j = (await r.json()) as { added?: boolean }
    return Boolean(j.added)
  } catch {
    return false
  }
}

export const AddToWalletButton = memo(function AddToWalletButton({ onAdded }: Props) {
  const [state, setState] = useState<State>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    setState('polling')
    const startedAt = Date.now()
    pollRef.current = setInterval(async () => {
      const added = await fetchAdded()
      if (added) {
        stopPolling()
        setState('added')
        onAdded?.()
        return
      }
      if (Date.now() - startedAt > 30_000) {
        stopPolling()
        setState('idle')
      }
    }, 2000)
  }, [stopPolling, onAdded])

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    fetchAdded().then((added) => {
      if (added) setState('added')
    })
    return () => stopPolling()
  }, [stopPolling])

  const onPress = useCallback(async () => {
    if (Platform.OS !== 'ios') return
    setState('loading')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) throw new Error('no session')

      const r = await fetch(`${API_BASE}/api/wallet/pass/exchange`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (!r.ok) throw new Error(`exchange failed: ${r.status}`)
      const { token } = (await r.json()) as { token: string }

      const url = `${API_BASE}/api/wallet/pass?token=${encodeURIComponent(token)}`
      // Browser closes when the user dismisses the Wallet sheet (added OR
      // cancelled). We can't tell from this side — server-side device
      // registration is the only truth, so poll.
      await WebBrowser.openBrowserAsync(url, { showInRecents: false })
      startPolling()
    } catch (e) {
      console.warn('[AddToWalletButton]', e)
      setState('idle')
      Alert.alert('Could not add card', 'Please try again.')
    }
  }, [startPolling])

  const openWallet = useCallback(() => {
    Linking.openURL('shoebox://').catch(() => Linking.openURL('wallet://'))
  }, [])

  if (Platform.OS !== 'ios') return null

  const added = state === 'added'
  const busy = state === 'loading' || state === 'polling'

  const subtitle = added
    ? 'Added to Apple Wallet'
    : state === 'polling'
      ? 'Waiting for Wallet to confirm…'
      : state === 'loading'
        ? 'Preparing your card…'
        : 'Scan at the counter — updates automatically'

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Icon name="card" color={T.ink2} size={22} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title}>Save your member card</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Pressable
        onPress={added ? openWallet : onPress}
        disabled={busy}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, busy && styles.ctaBusy]}
        accessibilityLabel={added ? 'Open in Wallet' : 'Add to Apple Wallet'}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name="apple" color="#fff" size={14} />
            <Text style={styles.ctaText}>{added ? 'Open' : 'Add to Wallet'}</Text>
          </>
        )}
      </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOW.card,
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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    minWidth: 90,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
  },
  ctaPressed: {
    opacity: 0.8,
  },
  ctaBusy: {
    opacity: 0.7,
  },
  ctaText: {
    ...TYPE.bodyStrong,
    color: '#fff',
    fontSize: 13,
  },
})
