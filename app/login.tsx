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
import { router, useLocalSearchParams } from 'expo-router'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { T, PIN, IS_EVENING, CTA } from '@/constants/theme'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Application from 'expo-application'
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'
import { LegalModal } from '@/components/legal/LegalModal'
import type { LegalKind } from '@/lib/legal'
import { normalizeAUMobile } from '@/lib/phone'

// Sign-in used to carry its own palette — a cool grey with a forest-green
// accent — while every other screen is warm cream and brown. It was the first
// screen a new customer saw and it looked like a different product's login
// bolted on. These now come from the app's own tokens, so the screen follows
// Evening Mode with everything else instead of staying stubbornly daylit.
const tokens = {
  bg: T.bg,
  ink: T.ink,
  ink2: T.ink2,
  ink3: T.ink3,
  ink4: T.ink4,
  line: T.line,
  accent: T.brand,
  // Evening brand is a light gold — white on it measures about 2.3:1, the
  // unreadable blob this codebase keeps re-learning. Same call the proposal
  // and promotion cards already make.
  accentOn: IS_EVENING ? PIN.ink : '#FFFFFF',
  danger: '#B4432B',
  surface: T.card,
}

/**
 * Sign-in was set in Georgia with the system sans underneath it, while the
 * rest of the app is Shantell Sans throughout. Two typefaces nobody else
 * uses, on the first screen a new customer meets.
 *
 * React Native ignores fontWeight once a custom family is named, so weight
 * has to be chosen by family — hence the map rather than a single constant.
 * Every face here is already loaded in _layout, so this adds no download.
 *
 * The old design leaned on italic for its second heading line. Shantell has
 * no italic loaded and RN would synthesise or drop it depending on platform,
 * so the two lines separate by weight instead.
 */
const TYPE = {
  display: 'ShantellSans_700Bold',
  displaySoft: 'ShantellSans_500Medium',
  action: 'ShantellSans_600SemiBold',
  body: 'ShantellSans_400Regular',
  bodyMed: 'ShantellSans_500Medium',
  /** Letterspaced micro-labels, matching the eyebrows on the checkout card. */
  eyebrow: 'JetBrainsMono_700Bold',
} as const

type Stage = 'landing' | 'phone' | 'otp' | 'name'
const RESEND_COOLDOWN = 30

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  // The iOS OAuth client is registered per bundle id, so pick by the
  // running binary's id — a Debug build with the production bundle id
  // must use the production client, or Google's token exchange 500s.
  iosClientId: Application.applicationId?.endsWith('.dev')
    ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
})

export default function LoginScreen() {
  const auth = useAuth()
  const insets = useSafeAreaInsets()
  // `next` is set by AuthGate when redirecting an unauthenticated user to
  // /login — we restore that path on success so deep links survive auth.
  const params = useLocalSearchParams<{ next?: string | string[] }>()
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next
  const nextPath =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/login')
      ? nextRaw
      : null
  const successTarget = (nextPath ?? '/(tabs)') as never
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
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      if (error) throw error
      // Routing is handled by the auth-state useEffect: registered users
      // (profile non-null) get redirected to /(tabs); first-time SSO users
      // (profile still null after fetch) advance to the phone OTP stage.
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
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error) throw error
      // Routing handled by the auth-state useEffect (see handleApple).
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
    const phoneE164 = normalizeAUMobile(phoneInput)
    if (!phoneE164) {
      setError('Enter a valid AU mobile number (e.g. 0412 345 678)')
      return
    }
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
          router.replace(successTarget)
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
      router.replace(successTarget)
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

  // Show a full-screen indicator whenever we're mid-handshake: either our
  // local `busy` (button press → network call) or AuthProvider is still
  // hydrating a just-obtained session. Without this the SSO flow silently
  // sits for 1–3s between native sheet close and AuthGate's redirect.
  const loadingLabel =
    stage === 'phone'
      ? 'Sending code…'
      : stage === 'otp'
        ? 'Verifying…'
        : stage === 'name'
          ? 'Creating your account…'
          : 'Signing you in…'
  const showLoadingOverlay =
    busy || (!!auth.session && !auth.profile && auth.loading)

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Behind every stage, not just the landing one, so moving between
          them never feels like changing screens. */}
      <AmbientGlow />
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
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={tokens.accent} />
          <Text style={styles.loadingOverlayText}>{loadingLabel}</Text>
        </View>
      )}
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
      <Rise step={0}>
        <TeaIllustration />
      </Rise>

      <Rise step={1} style={styles.heroHeadingWrap}>
        <Text style={styles.heroEyebrow}>MANDY&rsquo;S REWARDS</Text>
        <Text style={styles.heroHeading}>Brewed for</Text>
        <Text style={[styles.heroHeading, styles.heroHeadingItalic]}>the regulars.</Text>
        <View style={styles.heroRule} />
        <Text style={styles.heroSub}>
          Sign in to order ahead, stamp your card, and skip the line.
        </Text>
      </Rise>

      <Rise step={2} style={{ gap: 10 }}>
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
      </Rise>
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
        <Text style={styles.stageSub}>We’ll text you a 6-digit code.</Text>
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

// ─────────────────────────── Atmosphere ───────────────────────────

/**
 * A slow warm bloom behind the whole screen — the light over the counter,
 * not a decoration. It drifts and breathes on a 9s cycle, which is slow
 * enough that you notice the screen is alive without ever watching it move.
 *
 * One SVG node and two animated values. The cost has to stay near zero:
 * this sits under a screen that low-end Android phones already find heavy,
 * and a sign-in screen that stutters is worse than one that sits still.
 */
function AmbientGlow() {
  const reduced = useReducedMotion()
  const drift = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    drift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(drift)
  }, [drift, reduced])

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + drift.value * 0.35,
    transform: [
      { translateY: -40 + drift.value * 30 },
      { scale: 1 + drift.value * 0.12 },
    ],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.glowWrap, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="loginGlow" cx="50%" cy="42%" r="52%">
            <Stop offset="0%" stopColor={T.peach} stopOpacity={0.55} />
            <Stop offset="55%" stopColor={T.brand} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={T.brand} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="42" r="52" fill="url(#loginGlow)" />
      </Svg>
    </Animated.View>
  )
}

/**
 * Entrance choreography: each piece fades up a beat after the one above it,
 * so the screen assembles instead of appearing. `step` is the position in
 * the sequence, not a duration — keeps call sites readable and the rhythm
 * consistent if a row is added or removed.
 */
function Rise({
  step = 0,
  children,
  style: outer,
}: {
  step?: number
  children: React.ReactNode
  style?: object
}) {
  const reduced = useReducedMotion()
  const t = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) return
    t.value = withDelay(
      90 * step,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }),
    )
    return () => cancelAnimation(t)
  }, [t, step, reduced])

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * 14 }],
  }))

  return <Animated.View style={[outer, style]}>{children}</Animated.View>
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
      {/* Sits on the filled brand button now, so it takes the button's own
          foreground rather than page ink. */}
      <Rect
        x={6}
        y={2.5}
        width={12}
        height={19}
        rx={2.5}
        stroke={tokens.accentOn}
        strokeWidth={1.6}
      />
      <Circle cx={12} cy={18} r={0.9} fill={tokens.accentOn} />
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

  // Absolutely positioned and taller than it is wide so the bloom's falloff
  // lands inside the screen rather than washing flat across it.
  glowWrap: {
    position: 'absolute',
    top: -80,
    left: -60,
    right: -60,
    height: 520,
  },

  wordmarkRow: { alignItems: 'center', marginBottom: 28 },
  wordmarkItalic: {
    fontFamily: TYPE.displaySoft,
    fontSize: 26,
    color: tokens.ink,
    letterSpacing: -0.2,
  },
  wordmarkBold: {
    fontFamily: TYPE.display,
    fontSize: 26,
    color: tokens.ink,
    letterSpacing: -0.2,
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
    borderRadius: 22,
    marginBottom: 28,
    overflow: 'hidden',
    // A warm hairline instead of a grey wash: the illustration reads as a
    // framed picture on the counter rather than a placeholder rectangle.
    borderWidth: 1,
    borderColor: tokens.line,
    backgroundColor: T.cream,
  },
  teaImage: { width: '100%', height: '100%' },

  heroHeadingWrap: { marginBottom: 28 },
  heroEyebrow: {
    fontFamily: TYPE.eyebrow,
    fontSize: 10.5,
    letterSpacing: 2.2,
    color: tokens.accent,
    marginBottom: 10,
  },
  // A hairline between the promise and the explanation. Cheap, and it stops
  // the block reading as one undifferentiated paragraph of serif.
  heroRule: {
    width: 44,
    height: 2,
    borderRadius: 2,
    backgroundColor: tokens.accent,
    opacity: 0.5,
    marginTop: 18,
  },
  heroHeading: {
    fontFamily: TYPE.displaySoft,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.8,
    color: tokens.ink,
  },
  // Second line carries the emphasis by weight, not by a synthesised italic.
  heroHeadingItalic: {
    fontFamily: TYPE.display,
  },
  heroSub: {
    fontFamily: TYPE.body,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: tokens.ink3,
    maxWidth: 300,
  },

  stageTitle: {
    fontFamily: TYPE.display,
    fontSize: 30,
    letterSpacing: -0.8,
    color: tokens.ink,
  },
  stageSub: {
    fontFamily: TYPE.body,
    marginTop: 8,
    fontSize: 14,
    color: tokens.ink3,
  },
  stageSubBold: { color: tokens.ink, fontFamily: TYPE.action },

  btn: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.4 },

  btnGoogle: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
  },
  btnGoogleText: {
    fontFamily: TYPE.action,
    fontSize: 17,
    color: tokens.ink,
    letterSpacing: -0.3,
  },

  // Phone is the primary path — it is how most customers here actually sign
  // in, and it was previously the faintest button on the screen. Filled in
  // brand with pinned white on it: PIN, not a theme token, because brand goes
  // light gold in Evening Mode and this label has to stay legible on it.
  btnPhone: {
    backgroundColor: CTA.bg,
    borderWidth: 0,
    shadowColor: PIN.chip,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 3,
  },
  btnPhoneText: {
    fontFamily: TYPE.action,
    fontSize: 17,
    color: CTA.on,
    letterSpacing: -0.3,
  },

  btnPrimary: { backgroundColor: tokens.accent },
  btnPrimaryText: {
    fontFamily: TYPE.action,
    fontSize: 16,
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
    fontFamily: TYPE.eyebrow,
    fontSize: 10.5,
    color: tokens.ink3,
    letterSpacing: 1.4,
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
  flagText: { fontSize: 20, lineHeight: 22, fontFamily: TYPE.body },
  phonePrefixText: { fontSize: 16, color: tokens.ink, fontFamily: TYPE.bodyMed },
  phoneInput: {
    fontFamily: TYPE.bodyMed,
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
  otpSlotText: { fontSize: 26, fontFamily: TYPE.display, color: tokens.ink },
  otpHiddenInput: {
    fontFamily: TYPE.body,
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
  mutedText: { fontSize: 13, color: tokens.ink3, fontFamily: TYPE.body },
  linkText: {
    fontFamily: TYPE.action,
    fontSize: 13,
    color: tokens.ink2,
    textDecorationLine: 'underline',
  },

  fieldLabel: {
    fontFamily: TYPE.eyebrow,
    fontSize: 10.5,
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
    fontFamily: TYPE.body,
    fontSize: 16,
    color: tokens.ink,
  },

  backLink: {
    fontFamily: TYPE.action,
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
  errorText: { color: tokens.danger, fontSize: 13, lineHeight: 18, fontFamily: TYPE.body },

  footer: {
    fontFamily: TYPE.body,
    marginTop: 28,
    fontSize: 11.5,
    lineHeight: 17,
    color: tokens.ink3,
    textAlign: 'center',
  },
  footerLink: { color: tokens.ink2, textDecorationLine: 'underline' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(236,235,230,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 9999,
  },
  loadingOverlayText: {
    fontFamily: TYPE.bodyMed,
    fontSize: 14,
    color: tokens.ink2,
    letterSpacing: -0.1,
  },
})
