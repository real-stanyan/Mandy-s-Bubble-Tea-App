import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { BRAND } from '@/lib/constants'

// Gate the whole app: unauthenticated (or session without a finished profile)
// lands on /login; authenticated users that stray onto /login are kicked back
// into the tabs (or wherever they were originally headed via a deep link).
// Stack stays mounted so expo-router is always happy — the splash just
// overlays while auth hydrates.

function safeNextPath(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  // Reject protocol-relative ("//evil"), absolute URLs, and self-loops.
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/login')) return null
  return v
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, fetchError, refresh } = useAuth()
  const segments = useSegments()
  const params = useGlobalSearchParams<{ next?: string | string[] }>()
  const router = useRouter()

  const onLogin = segments[0] === 'login'
  const needsAuth = !session || !profile
  const currentPath = '/' + segments.join('/')
  const nextPath = safeNextPath(params.next)
  // Show retry overlay (instead of redirecting to /login) when the user
  // already has a Supabase session but we just couldn't reach /api/me. A
  // transient outage shouldn't restart someone's signup flow.
  const showFetchError = !!session && !profile && fetchError && !loading
  const [settled, setSettled] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (loading) {
      setSettled(false)
      return
    }
    if (showFetchError) {
      setSettled(false)
      return
    }
    if (needsAuth && !onLogin) {
      setSettled(false)
      // Preserve the path the user was trying to reach (deep links from
      // emails, push notifications, etc) so post-auth we send them there
      // instead of dumping them on /(tabs).
      const next =
        currentPath !== '/' && !currentPath.startsWith('/login')
          ? `?next=${encodeURIComponent(currentPath)}`
          : ''
      router.replace(`/login${next}` as never)
    } else if (!needsAuth && onLogin) {
      setSettled(false)
      router.replace((nextPath ?? '/(tabs)') as never)
    } else {
      setSettled(true)
    }
  }, [loading, needsAuth, onLogin, router, currentPath, nextPath, showFetchError])

  const showOverlay = !showFetchError && !settled && (needsAuth ? !onLogin : onLogin)

  async function handleRetry() {
    setRetrying(true)
    try {
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      {children}
      {showOverlay && (
        <View style={styles.splash} pointerEvents="auto">
          <ActivityIndicator size="large" color={BRAND.color} />
        </View>
      )}
      {showFetchError && (
        <View style={styles.errorOverlay} pointerEvents="auto">
          <Text style={styles.errorTitle}>Trouble connecting</Text>
          <Text style={styles.errorBody}>
            We couldn&apos;t reach Mandy&apos;s server. Check your connection and try again.
          </Text>
          <Pressable
            style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
            onPress={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.retryText}>Retry</Text>
            )}
          </Pressable>
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEBE6',
    paddingHorizontal: 32,
    zIndex: 9999,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#141413',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#3A3A37',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 120,
    alignItems: 'center',
  },
  retryBtnDisabled: { opacity: 0.6 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
