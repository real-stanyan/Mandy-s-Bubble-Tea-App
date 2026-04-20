import { useEffect } from 'react'
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

  useEffect(() => {
    if (loading) return
    if (needsAuth && !onLogin) {
      router.replace('/login')
    } else if (!needsAuth && onLogin) {
      router.replace('/(tabs)')
    }
  }, [loading, needsAuth, onLogin, router])

  return (
    <>
      {children}
      {loading && (
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
