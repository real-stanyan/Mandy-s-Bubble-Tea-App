import { memo, useCallback, useEffect, useState } from 'react'
import {
  Platform,
  Pressable,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

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

  if (state === 'added') {
    return (
      <Pressable onPress={openWallet} style={styles.addedRow}>
        <Text style={styles.addedText}>✓ Card added to Wallet  ·  Open</Text>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} disabled={state === 'loading'} style={styles.button}>
      {state === 'loading' ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('@/assets/add-to-apple-wallet.png')}
          style={styles.badge}
          resizeMode="contain"
        />
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  button: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { height: 44, width: 180 },
  addedRow: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  addedText: {
    fontSize: 13,
    color: '#18181b',
    fontWeight: '500',
  },
})
