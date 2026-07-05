import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Application from 'expo-application'
import { supabase } from '@/lib/supabase'

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

// Build numbers are EAS-remote-managed (eas.json appVersionSource: "remote"
// + production autoIncrement): the REAL CFBundleVersion / versionCode is
// assigned by EAS at build time, and app.json's ios.buildNumber is a stale
// value baked into the bundle — do NOT maintain or trust it (1.1.3 shipped
// as build 23 while app.json still said 22). expo-application reads the
// installed binary's Info.plist / PackageInfo, so it always reflects the
// build the user is actually running; expoConfig is only a fallback for
// environments without the native module (Expo Go / tests).

/** Native build number of the RUNNING binary ("23" on iOS, versionCode on
 *  Android); falls back to the stale expoConfig value as a last resort. */
export function appBuildNumber(): string | number | null | undefined {
  return (
    Application.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode)
  )
}

/** "1.1.4+23" — marketing version + native build number. Attached to every
 *  API request so server logs / order metadata can attribute failures to a
 *  specific shipped binary (we had zero version observability before). */
export function appVersionString(): string {
  const version =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0'
  const build = appBuildNumber()
  return build != null ? `${version}+${build}` : version
}

let cachedToken: string | null = null
let hydratePromise: Promise<void> | null = null
let refreshPromise: Promise<string | null> | null = null

function hydrateOnce(): Promise<void> {
  if (hydratePromise) return hydratePromise
  hydratePromise = supabase.auth.getSession().then(({ data }) => {
    cachedToken = data.session?.access_token ?? null
  })
  return hydratePromise
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null
})

// Shared refresh promise so a burst of parallel 401s collapses into one
// network round-trip. Cleared on settle so the next stale-session window
// can refresh again.
function refreshTokenOnce(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) return null
      cachedToken = data.session.access_token
      return cachedToken
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

function buildHeaders(
  options: RequestInit | undefined,
  token: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }
  const appKey = process.env.EXPO_PUBLIC_SITE_ACCESS_APP_KEY
  if (appKey && !headers['x-mbt-app-key']) {
    headers['x-mbt-app-key'] = appKey
  }
  // Version + platform attribution. `x-client-platform: app` is read first
  // by the server's clientPlatformFrom() (metadata.source), the other two
  // feed the app_client order-metadata stamp and Vercel request logs.
  if (!headers['x-mbt-app-version']) {
    headers['x-mbt-app-version'] = appVersionString()
  }
  if (!headers['x-mbt-platform']) {
    headers['x-mbt-platform'] = Platform.OS
  }
  if (!headers['x-client-platform']) {
    headers['x-client-platform'] = 'app'
  }
  return headers
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (cachedToken === null && !hydratePromise) {
    await hydrateOnce()
  } else if (hydratePromise) {
    await hydratePromise
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options, cachedToken),
  })

  // If a previously-valid session has expired between hydration and now,
  // the server returns 401 before touching Square or any business logic.
  // Refresh once and retry — safe because auth-gated routes (`/api/payment`,
  // `/api/orders`, `/api/loyalty/redeem`, ...) reject in their auth check
  // ahead of any side-effecting call.
  if (res.status === 401 && cachedToken) {
    const refreshed = await refreshTokenOnce()
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: buildHeaders(options, refreshed),
      })
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}
