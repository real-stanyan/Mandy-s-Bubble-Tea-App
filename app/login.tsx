import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import * as AppleAuthentication from 'expo-apple-authentication'
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { LegalModal } from '@/components/legal/LegalModal'
import type { LegalKind } from '@/lib/legal'

const tokens = {
  bg: '#ECEBE6',
  ink: '#141413',
  ink2: '#3A3A37',
  ink3: 'rgba(20,20,19,0.55)',
  ink4: 'rgba(20,20,19,0.32)',
  line: 'rgba(20,20,19,0.10)',
  accent: '#1F3A32',
  accentOn: '#F5F3EC',
  danger: '#B4432B',
  surface: '#FFFFFF',
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })

type Stage = 'landing' | 'phone' | 'otp' | 'name'
const RESEND_COOLDOWN = 30

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
})

export default function LoginScreen() {
  const auth = useAuth()
  const insets = useSafeAreaInsets()
  const [stage, setStage] = useState<Stage>('landing')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [phoneInput, setPhoneInput] = useState('')
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ssoNames, setSsoNames] = useState<{ first: string; last: string } | null>(null)
  const [legal, setLegal] = useState<LegalKind | null>(null)

  // Remember which Supabase user we've already routed for. Supabase fires
  // USER_UPDATED on updateUser({phone}) which bumps auth.session's object
  // identity without changing access_token — without this guard the
  // effect would re-fire mid-OTP-flow and override the stage the user
  // just advanced to (e.g. bouncing them from 'otp' back to 'phone').
  const routedForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!auth.session) {
      // Reset so a subsequent sign-in (even with the same userId, e.g. a
      // user signs out and back in with the same Google account) will
      // re-route from landing instead of silently skipping.
      routedForUserRef.current = null
      return
    }
    if (auth.profile || auth.loading) return
    const userId = auth.session.user.id
    if (routedForUserRef.current === userId) return

    // SSO sessions arrive without a phone attached — collect that first.
    // Phone-OTP users already have a phone by the time they get here, so
    // the only remaining step is a name.
    const userPhone = auth.session.user?.phone
    if (!userPhone) {
      setStage('phone')
    } else {
      if (ssoNames && !firstName) setFirstName(ssoNames.first)
      if (ssoNames && !lastName) setLastName(ssoNames.last)
      setStage('name')
    }
    routedForUserRef.current = userId
  }, [auth.session, auth.profile, auth.loading])

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [resendTimer])

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
      // Apple only returns fullName on the very first sign-in for a given
      // Apple ID. Capture whatever we get so we can auto-complete signup
      // after the phone OTP step.
      const appleFirst = credential.fullName?.givenName?.trim() ?? ''
      const appleLast = credential.fullName?.familyName?.trim() ?? ''
      if (appleFirst || appleLast) {
        setSsoNames({ first: appleFirst, last: appleLast })
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      if (error) throw error
      // SSO always needs a phone attached before completeSignup — advance
      // directly instead of waiting for the auth-state useEffect, which
      // races against the async session propagation.
      if (data.session && !data.user?.phone) {
        setStage('phone')
      }
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
      // Pull the given/family name out of Google's response (falling back
      // to splitting `name` if either field is empty). We'll feed this to
      // completeSignup once the user adds a phone, so they skip the name
      // entry screen entirely.
      const gUser = res.data?.user
      let gFirst = gUser?.givenName?.trim() ?? ''
      let gLast = gUser?.familyName?.trim() ?? ''
      if (!gFirst && !gLast && gUser?.name) {
        const parts = gUser.name.trim().split(/\s+/)
        gFirst = parts[0] ?? ''
        gLast = parts.slice(1).join(' ')
      }
      if (gFirst || gLast) {
        setSsoNames({ first: gFirst, last: gLast })
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error) throw error
      // SSO always needs a phone attached before completeSignup — advance
      // directly instead of waiting for the auth-state useEffect, which
      // races against the async session propagation.
      if (data.session && !data.user?.phone) {
        setStage('phone')
      }
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
      // SSO users already gave us a name via Apple/Google — finish signup
      // right here so they never see the name entry stage. Phone-only
      // users fall through and the useEffect above routes them to 'name'.
      if (ssoNames?.first) {
        try {
          await auth.completeSignup({
            firstName: ssoNames.first,
            lastName: ssoNames.last || undefined,
          })
          router.replace('/(tabs)')
          return
        } catch (completeErr) {
          // Auto-complete failed (e.g. network) — pre-fill the manual
          // form and move the user to the name stage so they can retry
          // with one tap. Explicit setStage because routedForUserRef is
          // already pinned to this user and the stage-routing useEffect
          // won't fire again.
          setFirstName(ssoNames.first)
          setLastName(ssoNames.last)
          setError(
            completeErr instanceof Error ? completeErr.message : 'Could not finish signup',
          )
          setStage('name')
        }
      }
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
      router.replace('/(tabs)')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not finish signup')
    } finally {
      setBusy(false)
    }
  }

  function backToLanding() {
    setStage('landing')
    setPhoneInput('')
    setPendingPhone(null)
    setOtp('')
    setResendTimer(0)
    setError(null)
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.wordmarkRow}>
            <Wordmark />
          </View>

          {stage === 'landing' && (
            <LandingStage
              onApple={handleApple}
              onGoogle={handleGoogle}
              onPhone={() => setStage('phone')}
              busy={busy}
            />
          )}

          {stage === 'phone' && (
            <PhoneStage
              value={phoneInput}
              onChange={setPhoneInput}
              onSubmit={handleSendOtp}
              onBack={backToLanding}
              busy={busy}
            />
          )}

          {stage === 'otp' && pendingPhone && (
            <OtpStage
              phone={pendingPhone}
              code={otp}
              onChange={setOtp}
              onSubmit={handleVerifyOtp}
              onResend={handleResendOtp}
              onChangeNumber={() => setStage('phone')}
              resendTimer={resendTimer}
              busy={busy}
            />
          )}

          {stage === 'name' && (
            <NameStage
              firstName={firstName}
              lastName={lastName}
              onChangeFirst={setFirstName}
              onChangeLast={setLastName}
              onSubmit={handleCompleteSignup}
              busy={busy}
            />
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {stage === 'landing' && <Footer onOpen={setLegal} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <LegalModal
        visible={legal !== null}
        kind={legal ?? 'terms'}
        onClose={() => setLegal(null)}
      />
    </SafeAreaView>
  )
}

// ─────────────────────────── Landing ───────────────────────────

function LandingStage({
  onApple,
  onGoogle,
  onPhone,
  busy,
}: {
  onApple: () => void
  onGoogle: () => void
  onPhone: () => void
  busy: boolean
}) {
  return (
    <View>
      <TeaIllustration />

      <View style={styles.heroHeadingWrap}>
        <Text style={styles.heroHeading}>Brewed for</Text>
        <Text style={[styles.heroHeading, styles.heroHeadingItalic]}>the regulars.</Text>
        <Text style={styles.heroSub}>
          Sign in to order ahead, stamp your card, and skip the line.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ height: 54 }}
            onPress={onApple}
          />
        )}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnGoogle,
            pressed && styles.btnPressed,
          ]}
          onPress={onGoogle}
          disabled={busy}
        >
          <GoogleG />
          <Text style={styles.btnGoogleText}>Continue with Google</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnPhone,
            pressed && styles.btnPressed,
          ]}
          onPress={onPhone}
          disabled={busy}
        >
          <PhoneGlyph />
          <Text style={styles.btnPhoneText}>Continue with phone</Text>
        </Pressable>

        {busy && <ActivityIndicator color={tokens.accent} style={{ marginTop: 12 }} />}
      </View>
    </View>
  )
}

// ─────────────────────────── Phone ───────────────────────────

function PhoneStage({
  value,
  onChange,
  onSubmit,
  onBack,
  busy,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  busy: boolean
}) {
  const canSend = value.replace(/\D/g, '').length >= 9
  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={styles.stageTitle}>Enter your number</Text>
        <Text style={styles.stageSub}>We'll text you a 6-digit code.</Text>
      </View>

      <View style={styles.phoneRow}>
        <View style={styles.phonePrefix}>
          <Text style={styles.flagText}>🇦🇺</Text>
          <Text style={styles.phonePrefixText}>+61</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          placeholder="400 000 000"
          placeholderTextColor={tokens.ink4}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoFocus
          value={value}
          onChangeText={onChange}
          editable={!busy}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnPrimary,
          (!canSend || busy) && styles.btnDisabled,
          pressed && canSend && !busy && styles.btnPressed,
        ]}
        onPress={onSubmit}
        disabled={!canSend || busy}
      >
        <Text style={styles.btnPrimaryText}>
          {busy ? 'Sending…' : 'Send code'}
        </Text>
      </Pressable>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>← Back</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─────────────────────────── OTP ───────────────────────────

function OtpStage({
  phone,
  code,
  onChange,
  onSubmit,
  onResend,
  onChangeNumber,
  resendTimer,
  busy,
}: {
  phone: string
  code: string
  onChange: (v: string) => void
  onSubmit: () => void
  onResend: () => void
  onChangeNumber: () => void
  resendTimer: number
  busy: boolean
}) {
  const slots = Array.from({ length: 6 }, (_, i) => code[i] || '')
  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={styles.stageTitle}>Enter the code</Text>
        <Text style={styles.stageSub}>
          Sent to <Text style={styles.stageSubBold}>{phone}</Text>
        </Text>
      </View>

      <View style={{ position: 'relative' }}>
        <View style={styles.otpRow} pointerEvents="none">
          {slots.map((ch, i) => {
            const active = i === code.length
            return (
              <View
                key={i}
                style={[
                  styles.otpSlot,
                  active && styles.otpSlotActive,
                  !!ch && styles.otpSlotFilled,
                ]}
              >
                <Text style={styles.otpSlotText}>{ch}</Text>
              </View>
            )
          })}
        </View>
        <TextInput
          style={styles.otpHiddenInput}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          value={code}
          onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
          editable={!busy}
          autoFocus
          caretHidden
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnPrimary,
          (code.length < 6 || busy) && styles.btnDisabled,
          pressed && code.length === 6 && !busy && styles.btnPressed,
        ]}
        onPress={onSubmit}
        disabled={code.length < 6 || busy}
      >
        <Text style={styles.btnPrimaryText}>{busy ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>

      <View style={styles.otpFooter}>
        {resendTimer > 0 ? (
          <Text style={styles.mutedText}>Resend code in {resendTimer}s</Text>
        ) : (
          <TouchableOpacity onPress={onResend} disabled={busy}>
            <Text style={styles.linkText}>Resend code</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onChangeNumber}>
          <Text style={styles.linkText}>Change number</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─────────────────────────── Name (complete signup) ───────────────────────────

function NameStage({
  firstName,
  lastName,
  onChangeFirst,
  onChangeLast,
  onSubmit,
  busy,
}: {
  firstName: string
  lastName: string
  onChangeFirst: (v: string) => void
  onChangeLast: (v: string) => void
  onSubmit: () => void
  busy: boolean
}) {
  return (
    <View style={{ gap: 20 }}>
      <View>
        <Text style={styles.stageTitle}>Almost there</Text>
        <Text style={styles.stageSub}>What should we call you?</Text>
      </View>

      <View style={{ gap: 12 }}>
        <View>
          <Text style={styles.fieldLabel}>First name</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="First name"
            placeholderTextColor={tokens.ink4}
            autoComplete="given-name"
            value={firstName}
            onChangeText={onChangeFirst}
            editable={!busy}
          />
        </View>
        <View>
          <Text style={styles.fieldLabel}>Last name (optional)</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Last name"
            placeholderTextColor={tokens.ink4}
            autoComplete="family-name"
            value={lastName}
            onChangeText={onChangeLast}
            editable={!busy}
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnPrimary,
          (!firstName.trim() || busy) && styles.btnDisabled,
          pressed && !!firstName.trim() && !busy && styles.btnPressed,
        ]}
        onPress={onSubmit}
        disabled={!firstName.trim() || busy}
      >
        <Text style={styles.btnPrimaryText}>
          {busy ? 'Creating account…' : 'Create account'}
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────── Bits ───────────────────────────

function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={styles.wordmarkItalic}>Mandy’s</Text>
      <Text style={styles.wordmarkBold}> Bubble Tea</Text>
    </View>
  )
}

function TeaIllustration() {
  return (
    <View style={styles.teaBox}>
      <Image
        source={require('../assets/images/login-banner.webp')}
        style={styles.teaImage}
        resizeMode="cover"
        accessible
        accessibilityLabel="Mandy's Bubble Tea welcome illustration"
      />
    </View>
  )
}

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </Svg>
  )
}

function PhoneGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={2.5} width={12} height={19} rx={2.5} stroke={tokens.ink} strokeWidth={1.6} />
      <Circle cx={12} cy={18} r={0.9} fill={tokens.ink} />
    </Svg>
  )
}

function Footer({ onOpen }: { onOpen: (k: LegalKind) => void }) {
  return (
    <Text style={styles.footer}>
      By continuing you agree to our{' '}
      <Text style={styles.footerLink} onPress={() => onOpen('terms')}>Terms</Text>
      {' '}and{' '}
      <Text style={styles.footerLink} onPress={() => onOpen('privacy')}>Privacy Policy</Text>.
    </Text>
  )
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { paddingHorizontal: 28, paddingTop: 24, flexGrow: 1 },

  wordmarkRow: { alignItems: 'center', marginBottom: 28 },
  wordmarkItalic: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 26,
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  wordmarkBold: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 26,
    color: tokens.ink,
    letterSpacing: -0.4,
  },
  wordmarkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.ink,
    marginLeft: 3,
    transform: [{ translateY: -10 }],
  },

  teaBox: {
    width: '100%',
    aspectRatio: 2.3,
    borderRadius: 18,
    marginBottom: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,19,0.03)',
  },
  teaImage: { width: '100%', height: '100%' },

  heroHeadingWrap: { marginBottom: 28 },
  heroHeading: {
    fontFamily: SERIF,
    fontWeight: '400',
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: tokens.ink,
  },
  heroHeadingItalic: {
    fontStyle: 'italic',
    fontWeight: '500',
  },
  heroSub: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.ink3,
    maxWidth: 280,
  },

  stageTitle: {
    fontFamily: SERIF,
    fontWeight: '500',
    fontSize: 30,
    letterSpacing: -0.8,
    color: tokens.ink,
  },
  stageSub: {
    marginTop: 8,
    fontSize: 14,
    color: tokens.ink3,
  },
  stageSubBold: { color: tokens.ink, fontWeight: '600' },

  btn: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  btnDisabled: { opacity: 0.4 },

  btnGoogle: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
  },
  btnGoogleText: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.ink,
    letterSpacing: -0.3,
  },

  btnPhone: {
    backgroundColor: tokens.bg,
    borderWidth: 1,
    borderColor: tokens.ink2,
  },
  btnPhoneText: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.ink,
    letterSpacing: -0.3,
  },

  btnPrimary: { backgroundColor: tokens.accent },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.accentOn,
    letterSpacing: -0.2,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tokens.line },
  dividerLabel: {
    fontSize: 12,
    color: tokens.ink3,
    letterSpacing: 1.4,
    fontWeight: '500',
  },

  phoneRow: { flexDirection: 'row', gap: 8 },
  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
  },
  flagText: { fontSize: 20, lineHeight: 22 },
  phonePrefixText: { fontSize: 16, color: tokens.ink, fontWeight: '500' },
  phoneInput: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    paddingHorizontal: 18,
    fontSize: 18,
    color: tokens.ink,
  },

  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  otpSlot: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpSlotActive: { borderColor: tokens.ink },
  otpSlotFilled: { borderColor: tokens.ink },
  otpSlotText: { fontSize: 26, fontWeight: '500', color: tokens.ink },
  otpHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
    fontSize: 26,
  },

  otpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutedText: { fontSize: 13, color: tokens.ink3 },
  linkText: {
    fontSize: 13,
    color: tokens.ink2,
    textDecorationLine: 'underline',
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.ink3,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: tokens.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    color: tokens.ink,
  },

  backLink: {
    textAlign: 'center',
    fontSize: 13,
    color: tokens.ink3,
    textDecorationLine: 'underline',
  },

  errorBox: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(180,67,43,0.25)',
    backgroundColor: 'rgba(180,67,43,0.06)',
  },
  errorText: { color: tokens.danger, fontSize: 13, lineHeight: 18 },

  footer: {
    marginTop: 28,
    fontSize: 11.5,
    lineHeight: 17,
    color: tokens.ink3,
    textAlign: 'center',
  },
  footerLink: { color: tokens.ink2, textDecorationLine: 'underline' },
})
