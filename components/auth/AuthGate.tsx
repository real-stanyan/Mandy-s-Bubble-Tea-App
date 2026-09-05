import { Component, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import Animated, { FadeOut } from 'react-native-reanimated'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@/components/auth/AuthProvider'
import { BreathingGlow } from '@/components/ui/BreathingGlow'
import { LaunchScreen } from '@/components/launch/LaunchScreen'
import { T } from '@/constants/theme'

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
  // Cold start wears the launch screen (the cup pours, the wordmark rises)
  // instead of the glow; once it has left, any later overlay — a sign-out,
  // a sign-in — is the quick glow as before.
  const [launchDone, setLaunchDone] = useState(false)

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
      {/* Both overlays sit on dark ink, so the status bar has to invert with
          them — the app's own `style="dark"` is unreadable against it. */}
      {launchDone && (showOverlay || showFetchError) && <StatusBar style="light" />}
      {launchDone && showOverlay && (
        // Fade out rather than cutting: the app underneath is cream, and a hard
        // dark-to-light swap at the end of the entrance undoes the calm the
        // glow just spent five seconds building.
        <Animated.View
          style={styles.splash}
          pointerEvents="auto"
          exiting={FadeOut.duration(420)}
        >
          <BreathingGlow />
        </Animated.View>
      )}
      {showFetchError && (
        <View style={styles.errorOverlay} pointerEvents="auto">
          <BreathingGlow />
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
              <ActivityIndicator color={T.ink} />
            ) : (
              <Text style={styles.retryText}>Retry</Text>
            )}
          </Pressable>
        </View>
      )}
      {!launchDone && (
        <LaunchBoundary onFail={() => setLaunchDone(true)}>
          {/* Ready = nothing left to hide: auth settled, or the retry card is
              showing underneath (it renders before this, so it's covered
              until the launch fades). */}
          <LaunchScreen ready={!showOverlay} onDone={() => setLaunchDone(true)} />
        </LaunchBoundary>
      )}
    </>
  )
}

// The launch screen reaches every installed app the moment it ships. If it
// ever throws — a missing asset, a native prop the binary doesn't know — the
// app must still open: drop the screen and carry on as if it had finished.
class LaunchBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  // Sits on the same glow as the splash — a connection failure is still part of
  // the entrance, so it shouldn't hard-cut from dark ink to a cream error card.
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 9999,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: T.cream,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: 'rgba(255,243,222,0.72)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: T.peach,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 120,
    alignItems: 'center',
  },
  retryBtnDisabled: { opacity: 0.6 },
  retryText: { color: T.ink, fontWeight: '600', fontSize: 14 },
})
