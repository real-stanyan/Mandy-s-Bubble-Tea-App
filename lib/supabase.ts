import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY — set them in .env',
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Supabase recommends tying refresh scheduling to app state so the JWT
// doesn't go stale when the app is backgrounded for hours. Without this
// the next API call after resume hits a 401 before the client notices.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

// Detox e2e auth fixture backdoor.
//
// Off-by-default — only fires when EXPO_PUBLIC_DETOX_FIXTURE_URL is
// set at build time, which only happens in local .env.production.local
// for Detox-targeted Release builds. EAS prod builds (App Store /
// TestFlight) never see this env so the fetch never runs.
//
// Hard safety constraints:
//   1. URL must start with http://localhost: or http://127.0.0.1:
//      — refuses to call out to the public internet.
//   2. Session payload must be a valid Supabase session JSON;
//      setSession itself validates the JWT against the project.
const detoxFixtureUrl = process.env.EXPO_PUBLIC_DETOX_FIXTURE_URL
if (
  detoxFixtureUrl &&
  (detoxFixtureUrl.startsWith('http://localhost:') ||
    detoxFixtureUrl.startsWith('http://127.0.0.1:'))
) {
  // Write the session straight into AsyncStorage under Supabase's
  // own key, then call setSession to update the in-memory client.
  // The direct AsyncStorage write makes the session survive a JS
  // reload even if setSession's async chain (token refresh, event
  // dispatch) hasn't fully landed by the time the next reload fires.
  const supabaseRef =
    SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] ?? 'unknown'
  const storageKey = `sb-${supabaseRef}-auth-token`
  fetch(detoxFixtureUrl)
    .then((r) => (r.ok ? r.json() : null))
    .then(async (s) => {
      if (!s?.access_token || !s?.refresh_token) return
      // 1. Direct AsyncStorage write — restored on next reload.
      const payload = {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
      }
      await AsyncStorage.setItem(storageKey, JSON.stringify(payload))
      // 2. In-memory setSession for the current process.
      await supabase.auth.setSession({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
      })
      console.log('[detox-fixture] session injected (AsyncStorage + setSession)')
    })
    .catch(() => undefined) // Test server not running — silently no-op
}
