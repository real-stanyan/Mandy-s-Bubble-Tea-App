import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { BRAND } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'

// Mirror of web SignInCard. Four stages:
//   chooser (Apple / Google / phone) → phone → otp → name
// The "name" stage auto-engages once Supabase has a session but no
// user_profiles row yet (same rule as the web version).

type Stage = 'chooser' | 'phone' | 'otp' | 'name'

const RESEND_COOLDOWN = 30

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
})

export function SignInCard({
  heading = "Sign in to Mandy's",
  subheading = 'Loyalty stars, orders, and your welcome discount — all in one place.',
  onComplete,
}: {
  heading?: string
  subheading?: string
  onComplete?: () => void
}) {
  const auth = useAuth()
  const [stage, setStage] = useState<Stage>('chooser')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [phoneInput, setPhoneInput] = useState('')
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Auto-promote to "name" once auth session exists but profile is missing.
  useEffect(() => {
    if (auth.session && !auth.profile && !auth.loading) {
      setStage('name')
    }
  }, [auth.session, auth.profile, auth.loading])

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [resendTimer])

  function reset() {
    setStage('chooser')
    setPhoneInput('')
    setPendingPhone(null)
    setOtp('')
    setResendTimer(0)
    setError(null)
  }

  async function handleApple() {
    setError(null)
    setBusy(true)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!credential.identityToken) throw new Error('No identity token from Apple')
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      if (error) throw error
      // AuthProvider's onAuthStateChange will pick up the new session.
      onComplete?.()
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err?.code === 'ERR_REQUEST_CANCELED') return
      setError(err?.message ?? 'Apple sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const res = await GoogleSignin.signIn()
      const idToken = res.data?.idToken ?? (res as unknown as { idToken?: string })?.idToken
      if (!idToken) throw new Error('No ID token from Google')
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error) throw error
      onComplete?.()
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (
        err?.code === statusCodes.SIGN_IN_CANCELLED ||
        err?.code === statusCodes.IN_PROGRESS
      )
        return
      setError(err?.message ?? 'Google sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSendOtp() {
    const digits = phoneInput.replace(/\D/g, '')
    if (digits.length < 9) {
      setError('Enter a valid AU mobile number')
      return
    }
    const phoneE164 = `+61${digits.replace(/^0+/, '')}`
    setError(null)
    setBusy(true)
    try {
      await auth.signInWithPhone(phoneE164)
      setPendingPhone(phoneE164)
      setOtp('')
      setResendTimer(RESEND_COOLDOWN)
      setStage('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send code')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    if (!pendingPhone || otp.length < 6) return
    setError(null)
    setBusy(true)
    try {
      await auth.verifyOtp(pendingPhone, otp)
      // onAuthStateChange fires → session populates → effect above jumps
      // to "name" if there's no profile yet.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleResendOtp() {
    if (!pendingPhone || resendTimer > 0) return
    setBusy(true)
    setError(null)
    try {
      await auth.signInWithPhone(pendingPhone)
      setResendTimer(RESEND_COOLDOWN)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not resend')
    } finally {
      setBusy(false)
    }
  }

  async function handleCompleteSignup() {
    if (!firstName.trim()) {
      setError('Please enter your first name')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await auth.completeSignup({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
      })
      onComplete?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not finish signup'
      setError(msg)
      Alert.alert('Sign up failed', msg)
    } finally {
      setBusy(false)
    }
  }

  /* ---------- Render ---------- */

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.subtitle}>{subheading}</Text>

      {stage === 'chooser' && (
        <View style={{ gap: 10, marginTop: 12 }}>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={999}
              style={{ height: 48 }}
              onPress={handleApple}
            />
          )}
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={busy}>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setStage('phone')}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Use phone number instead</Text>
          </TouchableOpacity>
          {busy && <ActivityIndicator color={BRAND.color} style={{ marginTop: 8 }} />}
        </View>
      )}

      {stage === 'phone' && (
        <View style={{ marginTop: 12 }}>
          <View style={styles.phoneRow}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>+61</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="400 000 000"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phoneInput}
              onChangeText={setPhoneInput}
              editable={!busy}
            />
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, (!phoneInput.trim() || busy) && styles.primaryBtnDisabled]}
            onPress={handleSendOtp}
            disabled={!phoneInput.trim() || busy}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? 'Sending…' : 'Send verification code'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === 'otp' && pendingPhone && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.otpHint}>
            Sent to <Text style={styles.otpHintBold}>{pendingPhone}</Text>
          </Text>
          <TextInput
            style={styles.otpInput}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            editable={!busy}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.primaryBtn, (otp.length < 6 || busy) && styles.primaryBtnDisabled]}
            onPress={handleVerifyOtp}
            disabled={otp.length < 6 || busy}
          >
            <Text style={styles.primaryBtnText}>{busy ? 'Verifying…' : 'Verify'}</Text>
          </TouchableOpacity>
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn&apos;t receive it? </Text>
            {resendTimer > 0 ? (
              <Text style={styles.resendDisabled}>Resend in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResendOtp} disabled={busy}>
                <Text style={styles.resendLink}>Resend</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.backLink}>← Use a different number</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === 'name' && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.nameIntro}>
            Almost done — what should we call you?
          </Text>
          <Text style={styles.fieldLabel}>First name</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="First name"
            autoComplete="given-name"
            value={firstName}
            onChangeText={setFirstName}
            editable={!busy}
          />
          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Last name (optional)</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Last name"
            autoComplete="family-name"
            value={lastName}
            onChangeText={setLastName}
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, (!firstName.trim() || busy) && styles.primaryBtnDisabled, { marginTop: 14 }]}
            onPress={handleCompleteSignup}
            disabled={!firstName.trim() || busy}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#18181b', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#52525b', lineHeight: 20 },
  googleBtn: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#18181b' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.15)' },
  dividerText: { fontSize: 12, color: '#71717a' },
  secondaryBtn: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '500', color: '#3f3f46' },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
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
  primaryBtn: {
    backgroundColor: BRAND.color,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backLink: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: '#71717a',
  },
  otpHint: { fontSize: 14, color: '#52525b', marginBottom: 8, textAlign: 'center' },
  otpHintBold: { color: '#18181b', fontWeight: '600' },
  otpInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
  },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  resendText: { fontSize: 13, color: '#71717a' },
  resendDisabled: { fontSize: 13, color: '#a1a1aa' },
  resendLink: { fontSize: 13, color: BRAND.color, fontWeight: '600' },
  nameIntro: { fontSize: 14, color: '#52525b', marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    color: '#b91c1c',
    fontSize: 13,
  },
})
