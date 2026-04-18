import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { useLoyalty } from '@/hooks/use-loyalty'
import { formatAUPhone } from '@/lib/utils'
import { BRAND, LOYALTY, STORAGE_KEYS } from '@/lib/constants'
import { apiFetch } from '@/lib/api'
import { OtpInput } from '@/components/checkout/OtpInput'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { MemberQrCard } from '@/components/account/MemberQrCard'
import { PromotionsCard } from '@/components/account/PromotionsCard'
import { ActivityHistory } from '@/components/account/ActivityHistory'
import { OrderHistory } from '@/components/account/OrderHistory'
import { WelcomeDiscountCard } from '@/components/account/WelcomeDiscountCard'
import { useOrderHistory } from '@/hooks/use-order-history'
import { isUnfinished, useOrdersStore } from '@/store/orders'
import { useWelcomeDiscountStore } from '@/store/welcomeDiscount'
import type { LoyaltyAccount } from '@/types/square'

const PHONE_KEY = STORAGE_KEYS.phone
const DEVICE_TOKEN_KEY = STORAGE_KEYS.deviceToken
const NAME_KEY = STORAGE_KEYS.name
const RESEND_COOLDOWN = 60

// Zero-balance fallback used right after signup, before the loyalty account
// materialises on first purchase — keeps the dashboard from dead-ending on
// "No loyalty account found" for a freshly registered customer.
const EMPTY_LOYALTY: LoyaltyAccount = {
  id: '',
  balance: 0,
  lifetimePoints: 0,
  availableRewards: [],
}

type AuthStage = 'phone' | 'otp' | 'signup'

export default function AccountScreen() {
  const [phone, setPhone] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { account, events, loading, error, refresh } = useLoyalty(phone)
  const { orders, refresh: refreshOrders } = useOrderHistory(phone)
  const customerId = useOrdersStore((s) => s.customerId)
  const refreshWelcome = useWelcomeDiscountStore((s) => s.refresh)
  const clearWelcome = useWelcomeDiscountStore((s) => s.clear)
  const [refreshing, setRefreshing] = useState(false)

  // Auth flow state (only relevant when `phone` is null)
  const [authStage, setAuthStage] = useState<AuthStage>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const { activeOrders, pastOrders } = useMemo(() => {
    const active = orders.filter(isUnfinished)
    const past = orders.filter((o) => !isUnfinished(o))
    return { activeOrders: active, pastOrders: past }
  }, [orders])

  const hasActiveOrder = activeOrders.length > 0
  useFocusEffect(
    useCallback(() => {
      // Picks up a registration that happened elsewhere (checkout OTP
      // flow) while this tab was already mounted — without this the
      // SignInCard stays visible even though storage now has a phone.
      if (!phone) {
        let cancelled = false
        AsyncStorage.getItem(PHONE_KEY).then((saved) => {
          if (!cancelled && saved) setPhone(saved)
        })
        return () => {
          cancelled = true
        }
      }
      refresh()
      refreshOrders()
      refreshWelcome(phone)
      // Poll orders while there's an active (unfinished) one so staff
      // dashboard updates flow through without a manual refresh. Stops
      // automatically when no active orders remain.
      if (!hasActiveOrder) return
      const id = setInterval(() => {
        refreshOrders()
      }, 10_000)
      return () => clearInterval(id)
    }, [phone, refresh, refreshOrders, refreshWelcome, hasActiveOrder]),
  )

  const onPullRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([refresh(), refreshOrders(), refreshWelcome(phone)])
    } finally {
      setRefreshing(false)
    }
  }

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [resendTimer])

  // Mount: try device token autologin first, then fall back to saved phone.
  useEffect(() => {
    async function hydrate() {
      try {
        const token = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY)
        if (token) {
          try {
            const res = await apiFetch<{
              ok: boolean
              valid: boolean
              customerId?: string | null
              phoneE164?: string
              givenName?: string | null
              familyName?: string | null
            }>('/api/auth/check-token', {
              method: 'POST',
              body: JSON.stringify({ deviceToken: token }),
            })
            if (res.valid && res.phoneE164) {
              await AsyncStorage.setItem(PHONE_KEY, res.phoneE164)
              const full = [res.givenName, res.familyName].filter(Boolean).join(' ').trim()
              if (full) await AsyncStorage.setItem(NAME_KEY, full)
              setPhone(res.phoneE164)
              setInitializing(false)
              return
            }
            await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY)
          } catch {
            // token check failed — drop token and continue
            await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY).catch(() => {})
          }
        }
      } catch {
        /* SecureStore unavailable — ignore */
      }
      const saved = await AsyncStorage.getItem(PHONE_KEY)
      if (saved) setPhone(saved)
      setInitializing(false)
    }
    hydrate()
  }, [])

  const handleLookup = async (raw: string) => {
    const formatted = formatAUPhone(raw)
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await apiFetch<{
        ok: boolean
        found: boolean
        customerId?: string
        givenName?: string | null
        familyName?: string | null
        phoneE164?: string
        deviceToken?: string
      }>('/api/customer/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone: formatted }),
      })

      if (res.found && res.phoneE164) {
        // Existing customer — web returns a device token here so we match
        // that behaviour and keep the phone as a soft-login session.
        if (res.deviceToken) {
          await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, res.deviceToken).catch(() => {})
        }
        const full = [res.givenName, res.familyName].filter(Boolean).join(' ').trim()
        if (full) await AsyncStorage.setItem(NAME_KEY, full)
        await AsyncStorage.setItem(PHONE_KEY, res.phoneE164)
        setPhone(res.phoneE164)
        return
      }

      // New user — send OTP for verification before signup.
      await apiFetch<{ ok: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: formatted }),
      })
      setPendingPhone(formatted)
      setOtpCode('')
      setOtpError(false)
      setResendTimer(RESEND_COOLDOWN)
      setAuthStage('otp')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!pendingPhone || otpCode.length < 6) return
    setAuthLoading(true)
    setAuthError(null)
    setOtpError(false)
    try {
      const res = await apiFetch<{
        ok: boolean
        deviceToken: string
        found: boolean
        customerId?: string
        phoneE164?: string
        givenName?: string | null
        familyName?: string | null
      }>('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: pendingPhone, code: otpCode }),
      })

      await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, res.deviceToken).catch(() => {})
      const phoneE164 = res.phoneE164 ?? pendingPhone

      if (res.found) {
        const full = [res.givenName, res.familyName].filter(Boolean).join(' ').trim()
        if (full) await AsyncStorage.setItem(NAME_KEY, full)
        await AsyncStorage.setItem(PHONE_KEY, phoneE164)
        setPhone(phoneE164)
        return
      }

      // Verified but no customer in Square yet — move to signup stage.
      setPendingPhone(phoneE164)
      setOtpCode('')
      setAuthStage('signup')
    } catch (e) {
      if (e instanceof Error && e.message.includes('401')) {
        setOtpError(true)
      } else {
        setAuthError(e instanceof Error ? e.message : 'Verification failed')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const handleResend = async () => {
    if (!pendingPhone || resendTimer > 0) return
    setAuthLoading(true)
    setAuthError(null)
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: pendingPhone }),
      })
      setResendTimer(RESEND_COOLDOWN)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Failed to resend')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!pendingPhone || !firstName.trim() || !lastName.trim()) return
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await apiFetch<{
        ok: boolean
        customerId: string
        phoneE164?: string
      }>('/api/customer', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: pendingPhone,
        }),
      })
      const phoneE164 = res.phoneE164 ?? pendingPhone
      const full = `${firstName.trim()} ${lastName.trim()}`
      await AsyncStorage.setItem(PHONE_KEY, phoneE164)
      await AsyncStorage.setItem(NAME_KEY, full)
      setPhone(phoneE164)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign up failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const resetAuth = () => {
    setAuthStage('phone')
    setPendingPhone(null)
    setPhoneInput('')
    setOtpCode('')
    setOtpError(false)
    setResendTimer(0)
    setFirstName('')
    setLastName('')
    setAuthError(null)
  }

  const handleChangeNumber = async () => {
    await AsyncStorage.removeItem(PHONE_KEY)
    await AsyncStorage.removeItem(NAME_KEY).catch(() => {})
    await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY).catch(() => {})
    setPhone(null)
    useOrdersStore.getState().clear()
    clearWelcome()
    resetAuth()
  }

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (!phone) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {authStage === 'phone' && (
          <SignInCard
            value={phoneInput}
            onChange={setPhoneInput}
            onSubmit={() => handleLookup(phoneInput.trim())}
            loading={authLoading}
            error={authError}
          />
        )}
        {authStage === 'otp' && pendingPhone && (
          <OtpCard
            phone={pendingPhone}
            code={otpCode}
            onCodeChange={setOtpCode}
            onVerify={handleVerify}
            onResend={handleResend}
            onBack={resetAuth}
            resendTimer={resendTimer}
            loading={authLoading}
            otpError={otpError}
            error={authError}
          />
        )}
        {authStage === 'signup' && pendingPhone && (
          <SignupCard
            firstName={firstName}
            lastName={lastName}
            onFirstName={setFirstName}
            onLastName={setLastName}
            onSubmit={handleSignup}
            onBack={resetAuth}
            loading={authLoading}
            error={authError}
          />
        )}
        <HowItWorks />
        <StoreInfo />
      </ScrollView>
    )
  }

  if (loading && !account) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={BRAND.color} />
      }
    >
      <WelcomeDiscountCard />
      <LoyaltyCard account={account ?? EMPTY_LOYALTY} />
      {customerId && phone ? (
        <MemberQrCard customerId={customerId} phoneE164={phone} />
      ) : null}
      <PromotionsCard rewardsCount={account?.availableRewards?.length ?? 0} />
      {orders.length === 0 ? (
        <OrderHistory orders={orders} />
      ) : (
        <>
          <OrderHistory orders={activeOrders} title="In Progress" hideIfEmpty />
          <OrderHistory orders={pastOrders} title="Past Orders" hideIfEmpty />
        </>
      )}
      <ActivityHistory events={events} />
      <StoreInfo />
      <TouchableOpacity style={styles.signOutBtn} onPress={handleChangeNumber}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

/* ------------------------------------------------------------------ */
/*  Sign-in card (phone → lookup)                                      */
/* ------------------------------------------------------------------ */

function SignInCard({
  value,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading: boolean
  error: string | null
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Login or Sign Up</Text>
      <Text style={styles.cardSubtitle}>
        Enter your mobile number to continue. New members earn {LOYALTY.starsForReward} stars for a free drink.
      </Text>
      <View style={styles.phoneRow}>
        <View style={styles.phonePrefix}>
          <Text style={styles.phonePrefixText}>+61</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          placeholder="400 000 000"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={value}
          onChangeText={onChange}
        />
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, (!value.trim() || loading) && styles.primaryBtnDisabled]}
        onPress={onSubmit}
        disabled={!value.trim() || loading}
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Looking up…' : 'Continue →'}
        </Text>
      </TouchableOpacity>
      {error && <Text style={styles.authError}>{error}</Text>}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  OTP card                                                           */
/* ------------------------------------------------------------------ */

function OtpCard({
  phone,
  code,
  onCodeChange,
  onVerify,
  onResend,
  onBack,
  resendTimer,
  loading,
  otpError,
  error,
}: {
  phone: string
  code: string
  onCodeChange: (c: string) => void
  onVerify: () => void
  onResend: () => void
  onBack: () => void
  resendTimer: number
  loading: boolean
  otpError: boolean
  error: string | null
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Enter Verification Code</Text>
      <Text style={styles.cardSubtitle}>
        Sent to <Text style={styles.cardSubtitleBold}>{phone}</Text>
      </Text>
      <View style={{ marginBottom: 12 }}>
        <OtpInput value={code} onChange={onCodeChange} disabled={loading} error={otpError} />
        {otpError && (
          <Text style={styles.otpErrorText}>Invalid code, please try again</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, (loading || code.length < 6) && styles.primaryBtnDisabled]}
        onPress={onVerify}
        disabled={loading || code.length < 6}
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Verifying…' : 'Verify →'}
        </Text>
      </TouchableOpacity>
      <View style={styles.resendRow}>
        <Text style={styles.resendPrompt}>Didn&apos;t receive it? </Text>
        {resendTimer > 0 ? (
          <Text style={styles.resendDisabled}>Resend in {resendTimer}s</Text>
        ) : (
          <TouchableOpacity onPress={onResend} disabled={loading}>
            <Text style={styles.resendLink}>Resend Code</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>← Use a different number</Text>
      </TouchableOpacity>
      {error && !otpError && <Text style={styles.authError}>{error}</Text>}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Signup card (firstName / lastName)                                 */
/* ------------------------------------------------------------------ */

function SignupCard({
  firstName,
  lastName,
  onFirstName,
  onLastName,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  firstName: string
  lastName: string
  onFirstName: (v: string) => void
  onLastName: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  error: string | null
}) {
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !loading
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Finish Signing Up</Text>
      <Text style={styles.cardSubtitle}>
        Looks like you&apos;re new here. What should we call you?
      </Text>
      <View style={styles.verifiedBadge}>
        <Text style={styles.verifiedBadgeText}>✓ Phone verified</Text>
      </View>
      <Text style={styles.fieldLabel}>First Name</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder="First name"
        autoComplete="given-name"
        value={firstName}
        onChangeText={onFirstName}
      />
      <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Last Name</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder="Last name"
        autoComplete="family-name"
        value={lastName}
        onChangeText={onLastName}
      />
      <TouchableOpacity
        style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled, { marginTop: 16 }]}
        onPress={onSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Creating account…' : 'Create Account →'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>← Use a different phone number</Text>
      </TouchableOpacity>
      {error && <Text style={styles.authError}>{error}</Text>}
    </View>
  )
}

function HowItWorks() {
  return (
    <View style={styles.howItWorks}>
      <Text style={styles.howTitle}>How it works</Text>
      <Text style={styles.howBullet}>☕ Buy any drink = earn 1 star</Text>
      <Text style={styles.howBullet}>
        ⭐ {LOYALTY.starsForReward} stars = 1 free drink of your choice
      </Text>
      <Text style={styles.howBullet}>📱 Show this screen at the counter to redeem</Text>
    </View>
  )
}

function StoreInfo() {
  return (
    <View style={styles.storeInfo}>
      <Text style={styles.storeName}>{BRAND.name}</Text>
      <Text style={styles.storeDetail}>{BRAND.address}</Text>
      <Text style={styles.storeDetail}>{BRAND.phone}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrollContent: { paddingBottom: 40 },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  signOutText: {
    color: '#3f3f46',
    fontSize: 15,
    fontWeight: '500',
  },
  // Auth cards (shared)
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#18181b', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#52525b', lineHeight: 20, marginBottom: 16 },
  cardSubtitleBold: { color: '#18181b', fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 14 },
  phonePrefix: {
    backgroundColor: BRAND.accentColor,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 999,
  },
  phonePrefixText: { color: BRAND.color, fontWeight: '600', fontSize: 14 },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: BRAND.color,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  authError: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    color: '#b91c1c',
    fontSize: 13,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  resendPrompt: { fontSize: 13, color: '#71717a' },
  resendDisabled: { fontSize: 13, color: '#a1a1aa' },
  resendLink: { fontSize: 13, color: BRAND.color, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: '#71717a',
  },
  otpErrorText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    color: '#dc2626',
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
  },
  verifiedBadgeText: { color: '#15803d', fontSize: 12, fontWeight: '600' },
  howItWorks: {
    backgroundColor: BRAND.accentColor,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  howTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  howBullet: { fontSize: 14, lineHeight: 20 },
  storeInfo: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 4,
  },
  storeName: { fontSize: 16, fontWeight: '600' },
  storeDetail: { fontSize: 14, color: '#888' },
})
