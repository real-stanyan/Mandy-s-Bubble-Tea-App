import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { BRAND } from '@/lib/constants'

// Gate the whole app: unauthenticated (or session without a finished profile)
// lands on /login; authenticated users that stray onto /login are kicked back
// into the tabs. Stack stays mounted so expo-router is always happy — the
// splash just overlays while auth hydrates.

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  const onLogin = segments[0] === 'login'
  const needsAuth = !session || !profile
  // Keep the overlay up until we're actually on the correct screen for the
  // current auth state — otherwise the brief frame between useEffect firing
  // router.replace and the Stack transitioning exposes the initial (tabs)
  // route to unauthenticated users.
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (loading) {
      setSettled(false)
      return
    }
    if (needsAuth && !onLogin) {
      setSettled(false)
      router.replace('/login')
    } else if (!needsAuth && onLogin) {
      setSettled(false)
      router.replace('/(tabs)')
    } else {
      setSettled(true)
    }
  }, [loading, needsAuth, onLogin, router])

  const showOverlay = !settled && (needsAuth ? !onLogin : onLogin)

  return (
    <>
      {children}
      {showOverlay && (
        <View style={styles.splash} pointerEvents="auto">
          <ActivityIndicator size="large" color={BRAND.color} />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEBE6',
    zIndex: 9999,
  },
})
