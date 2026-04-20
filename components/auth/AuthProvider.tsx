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

export type MeResponse = {
  ok: true
  authed: boolean
  profile: AuthProfile | null
  email?: string | null
  phone?: string | null
  loyalty: LoyaltyInfo | null
  welcomeDiscount: WelcomeDiscountInfo
  starsPerReward: number
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  loyalty: LoyaltyInfo | null
  welcomeDiscount: WelcomeDiscountInfo
  starsPerReward: number
  loading: boolean
  signInWithPhone: (phoneE164: string) => Promise<void>
  verifyOtp: (phoneE164: string, token: string) => Promise<void>
  completeSignup: (args: { firstName: string; lastName?: string }) => Promise<AuthProfile>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

const DEFAULT_WELCOME: WelcomeDiscountInfo = { available: false, percentage: 0, drinksRemaining: 0 }

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
  const [starsPerReward, setStarsPerReward] = useState(9)
  const [loading, setLoading] = useState(true)

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
          if (data.session) {
            await supabase.auth.signOut()
          }
          setProfile(null)
          setLoyalty(null)
          setWelcomeDiscount(DEFAULT_WELCOME)
          setStarsPerReward(json.starsPerReward)
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
        setStarsPerReward(json.starsPerReward)
      } catch {
        // Non-fatal — leave state untouched.
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
    ;(async () => {
      setLoading(true)
      await fetchMe()
      setLoading(false)
    })()
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setLoyalty(null)
    setWelcomeDiscount(DEFAULT_WELCOME)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loyalty,
      welcomeDiscount,
      starsPerReward,
      loading,
      signInWithPhone,
      verifyOtp,
      completeSignup,
      signOut,
      refresh: fetchMe,
    }),
    [
      session,
      profile,
      loyalty,
      welcomeDiscount,
      starsPerReward,
      loading,
      signInWithPhone,
      verifyOtp,
      completeSignup,
      signOut,
      fetchMe,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
