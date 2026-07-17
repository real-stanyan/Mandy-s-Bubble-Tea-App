import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { revokeCurrentPushToken } from '@/lib/push-registration'

// RN counterpart of the web AuthProvider. Persists the Supabase session
// in AsyncStorage (via lib/supabase.ts) and hydrates profile/loyalty/
// welcome discount from /api/me. Components read state via useAuth().

export type AuthProfile = {
  user_id: string
  square_customer_id: string
  phone_e164: string
  first_name: string | null
  last_name: string | null
}

export type LoyaltyInfo = {
  accountId: string
  balance: number
  lifetimePoints: number
}

export type WelcomeDiscountInfo = {
  available: boolean
  percentage: number
  drinksRemaining: number
}

export type IgFollowDiscountInfo = {
  available: boolean
  percentage: number
  drinksRemaining: number
}

export type FlashPromoInfo = {
  available: boolean
  key: string | null
  percentage: number
}

export type MeResponse = {
  ok: true
  authed: boolean
  profile: AuthProfile | null
  email?: string | null
  phone?: string | null
  loyalty: LoyaltyInfo | null
  welcomeDiscount: WelcomeDiscountInfo
  igFollowDiscount: IgFollowDiscountInfo
  flashPromo?: FlashPromoInfo
  starsPerReward: number
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  loyalty: LoyaltyInfo | null
  welcomeDiscount: WelcomeDiscountInfo
  igFollowDiscount: IgFollowDiscountInfo
  flashPromo: FlashPromoInfo
  starsPerReward: number
  loading: boolean
  // True when the latest /api/me call threw (network / 5xx) — distinct
  // from the server explicitly returning authed=false. AuthGate uses
  // this to keep authenticated users from being bounced to /login on a
  // transient outage.
  fetchError: boolean
  signInWithPhone: (phoneE164: string) => Promise<void>
  verifyOtp: (phoneE164: string, token: string) => Promise<void>
  completeSignup: (args: { firstName: string; lastName?: string }) => Promise<AuthProfile>
  claimIgFollowDiscount: () => Promise<{ alreadyClaimed: boolean }>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

const DEFAULT_WELCOME: WelcomeDiscountInfo = { available: false, percentage: 0, drinksRemaining: 0 }
const DEFAULT_IG_FOLLOW: IgFollowDiscountInfo = { available: false, percentage: 0, drinksRemaining: 0 }
const DEFAULT_FLASH_PROMO: FlashPromoInfo = { available: false, key: null, percentage: 0 }

function shallowEqual<T extends Record<string, unknown> | null>(a: T, b: T): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null)
  const [welcomeDiscount, setWelcomeDiscount] = useState<WelcomeDiscountInfo>(DEFAULT_WELCOME)
  const [igFollowDiscount, setIgFollowDiscount] = useState<IgFollowDiscountInfo>(DEFAULT_IG_FOLLOW)
  const [flashPromo, setFlashPromo] = useState<FlashPromoInfo>(DEFAULT_FLASH_PROMO)
  const [starsPerReward, setStarsPerReward] = useState(9)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const inFlight = useRef<Promise<void> | null>(null)

  const fetchMe = useCallback(async () => {
    if (inFlight.current) return inFlight.current
    const p = (async () => {
      try {
        const json = await apiFetch<MeResponse>('/api/me')
        if (!json.ok) return
        // Server told us we're not authed (e.g. Square Dashboard deleted
        // the customer, or our token is stale) but we may still hold a
        // valid-looking Supabase session locally. Sign out so the UI
        // lands on /login's landing stage instead of limping into 'name'.
        if (!json.authed) {
          const { data } = await supabase.auth.getSession()
          // Detox fixture race guard. When EXPO_PUBLIC_DETOX_FIXTURE_URL
          // is set (only in local test builds — see lib/supabase.ts
          // backdoor), an in-flight session injection may land between
          // apiFetch sending /api/me without bearer (hydrateOnce found
          // empty storage) and this getSession() read. The original
          // signOut() then wipes the fresh fixture write before the
          // next fetchMe can use it. Skip the signOut + leave state
          // alone — the onAuthStateChange listener fires another
          // fetchMe with bearer and resolves authed:true on its own.
          // Production EAS builds never set this env so this branch
          // is dead code there.
          const isDetoxFixture = !!process.env.EXPO_PUBLIC_DETOX_FIXTURE_URL
          if (isDetoxFixture && data.session) {
            setFetchError(false)
            return
          }
          if (data.session) {
            await supabase.auth.signOut()
          }
          setProfile(null)
          setLoyalty(null)
          setWelcomeDiscount(DEFAULT_WELCOME)
          setIgFollowDiscount(DEFAULT_IG_FOLLOW)
          setFlashPromo(DEFAULT_FLASH_PROMO)
          setStarsPerReward(json.starsPerReward)
          setFetchError(false)
          return
        }
        // Preserve prior references when server data matches — downstream
        // hooks (useLoyalty, useFocusEffect) key their deps on these, so
        // replacing the ref on every /api/me poll re-fires their effects
        // and can produce visible loading flashes on the Account tab.
        setProfile((prev) => (shallowEqual(prev, json.profile) ? prev : json.profile))
        setLoyalty((prev) => (shallowEqual(prev, json.loyalty) ? prev : json.loyalty))
        setWelcomeDiscount((prev) =>
          shallowEqual(prev, json.welcomeDiscount) ? prev : json.welcomeDiscount,
        )
        setIgFollowDiscount((prev) =>
          shallowEqual(prev, json.igFollowDiscount) ? prev : json.igFollowDiscount,
        )
        setFlashPromo((prev) => {
          const next = json.flashPromo ?? DEFAULT_FLASH_PROMO
          return shallowEqual(prev, next) ? prev : next
        })
        setStarsPerReward(json.starsPerReward)
        setFetchError(false)
      } catch {
        // Network / 5xx — flag so AuthGate can show a retry overlay
        // instead of bouncing the user (who may still be authenticated
        // via Supabase) onto the signup flow.
        setFetchError(true)
      }
    })()
    inFlight.current = p
    try {
      await p
    } finally {
      inFlight.current = null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Flip loading synchronously on token-changing events so downstream
      // screens don't observe a stale (session=new, profile=old,
      // loading=false) tuple during the brief window before fetchMe's
      // useEffect schedules its own setLoading(true). Without this, a
      // returning SSO user's login screen promotes to the 'name' stage
      // for one render before profile hydration redirects them.
      //
      // USER_UPDATED is intentionally excluded: supabase.auth.updateUser
      // (e.g. staging a phone change via OTP) fires USER_UPDATED without
      // changing access_token, so the token-keyed useEffect below never
      // re-runs and loading would stick at true forever.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(true)
      }
      setSession(nextSession)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Keyed on user.id (not access_token) so Supabase's periodic token
    // refreshes don't spuriously re-hydrate /api/me and flash AuthGate's
    // splash over whatever screen the user is on. apiFetch reads the
    // latest token from supabase.auth.getSession() on every call, so
    // subsequent API requests still use the fresh access_token.
    //
    // A local `cancelled` flag guards against races: if this effect is
    // torn down (StrictMode double-invoke, rapid user.id change) before
    // fetchMe resolves, we must not flip loading=false from the stale
    // run or AuthGate will see loading=false with no profile yet.
    let cancelled = false
    setLoading(true)
    fetchMe()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id, fetchMe])

  const signInWithPhone = useCallback(
    async (phoneE164: string) => {
      if (session?.user && !session.user.phone) {
        const { error } = await supabase.auth.updateUser({ phone: phoneE164 })
        if (error) throw error
        return
      }
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 })
      if (error) throw error
    },
    [session],
  )

  const verifyOtp = useCallback(
    async (phoneE164: string, token: string) => {
      const linkingPhone = !!session?.user && !session.user.phone
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token,
        type: linkingPhone ? 'phone_change' : 'sms',
      })
      if (error) throw error
    },
    [session],
  )

  const completeSignup = useCallback(
    async ({ firstName, lastName }: { firstName: string; lastName?: string }) => {
      const json = await apiFetch<{ ok: boolean; profile: AuthProfile; error?: string }>(
        '/api/auth/complete-signup',
        {
          method: 'POST',
          body: JSON.stringify({ firstName, lastName }),
        },
      )
      if (!json.ok) throw new Error(json.error ?? 'Sign up failed')
      setProfile(json.profile)
      await fetchMe()
      return json.profile
    },
    [fetchMe],
  )

  const claimIgFollowDiscount = useCallback(async () => {
    const json = await apiFetch<{ ok: boolean; alreadyClaimed?: boolean; error?: string }>(
      '/api/promotions/ig-follow/claim',
      { method: 'POST' },
    )
    if (!json.ok) throw new Error(json.error ?? 'Failed to claim IG follow discount')
    await fetchMe()
    return { alreadyClaimed: !!json.alreadyClaimed }
  }, [fetchMe])

  const signOut = useCallback(async () => {
    await revokeCurrentPushToken()
    await supabase.auth.signOut()
    setProfile(null)
    setLoyalty(null)
    setWelcomeDiscount(DEFAULT_WELCOME)
    setIgFollowDiscount(DEFAULT_IG_FOLLOW)
    setFlashPromo(DEFAULT_FLASH_PROMO)
  }, [])

  const deleteAccount = useCallback(async () => {
    // Server deletes auth.users (cascades user_profiles + device_push_tokens),
    // welcome_discounts, and best-effort deletes the Square customer record.
    // After this POST the bearer token is invalid, so use local-scope signOut
    // to clear the Supabase client cache without hitting the server.
    await apiFetch('/api/account/delete', { method: 'POST' })
    await supabase.auth.signOut({ scope: 'local' })
    setProfile(null)
    setLoyalty(null)
    setWelcomeDiscount(DEFAULT_WELCOME)
    setIgFollowDiscount(DEFAULT_IG_FOLLOW)
    setFlashPromo(DEFAULT_FLASH_PROMO)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loyalty,
      welcomeDiscount,
      igFollowDiscount,
      flashPromo,
      starsPerReward,
      loading,
      fetchError,
      signInWithPhone,
      verifyOtp,
      completeSignup,
      claimIgFollowDiscount,
      signOut,
      deleteAccount,
      refresh: fetchMe,
    }),
    [
      session,
      profile,
      loyalty,
      welcomeDiscount,
      igFollowDiscount,
      flashPromo,
      starsPerReward,
      loading,
      fetchError,
      signInWithPhone,
      verifyOtp,
      completeSignup,
      claimIgFollowDiscount,
      signOut,
      deleteAccount,
      fetchMe,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
