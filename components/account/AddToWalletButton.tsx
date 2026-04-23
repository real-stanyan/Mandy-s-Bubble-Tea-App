import { memo, useCallback, useEffect, useState } from 'react'
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SPACING, SHADOW } from '@/constants/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://mandybubbletea.com'
const ADDED_KEY = 'mandy_wallet_added_v1'

interface Props {
  onAdded?: () => void
}

export const AddToWalletButton = memo(function AddToWalletButton({ onAdded }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'added' | 'error'>('idle')

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    AsyncStorage.getItem(ADDED_KEY).then((v) => {
      if (v === '1') setState('added')
    })
  }, [])

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
      await WebBrowser.openBrowserAsync(url, { showInRecents: false })

      await AsyncStorage.setItem(ADDED_KEY, '1')
      setState('added')
      onAdded?.()
    } catch (e) {
      console.warn('[AddToWalletButton]', e)
      setState('error')
      Alert.alert('Could not add card', 'Please try again.')
    }
  }, [onAdded])

  const openWallet = useCallback(() => {
    Linking.openURL('shoebox://').catch(() => Linking.openURL('wallet://'))
  }, [])

  if (Platform.OS !== 'ios') return null

  const added = state === 'added'
  const loading = state === 'loading'

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Icon name="card" color={T.ink2} size={22} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title}>Save your member card</Text>
        <Text style={styles.subtitle}>
          {added ? 'Added to Apple Wallet' : 'Scan at the counter — updates automatically'}
        </Text>
      </View>

      <Pressable
        onPress={added ? openWallet : onPress}
        disabled={loading}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityLabel={added ? 'Open in Wallet' : 'Add to Apple Wallet'}
      >
        {loading ? (
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
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
  },
  ctaPressed: {
    opacity: 0.8,
  },
  ctaText: {
    ...TYPE.bodyStrong,
    color: '#fff',
    fontSize: 13,
  },
})
