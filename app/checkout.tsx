import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { useCartStore } from '@/store/cart'
import { useCreateOrder } from '@/hooks/use-create-order'
import { usePayment } from '@/hooks/use-payment'
import { formatAUPhone } from '@/lib/utils'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { OtpInput } from '@/components/checkout/OtpInput'
import { BRAND } from '@/lib/constants'
import { apiFetch } from '@/lib/api'
import { Ionicons } from '@expo/vector-icons'

const DEVICE_TOKEN_KEY = 'mbt:account:deviceToken'
const PHONE_KEY = 'mbt:account:phone'

export default function CheckoutScreen() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)

  const { createOrder, loading: orderLoading, error: orderError } = useCreateOrder()
  const { pay, loading: payLoading, error: payError } = usePayment()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFieldErrors, setShowFieldErrors] = useState(false)

  // OTP state
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // Check device token on mount — if present, skip OTP
  useEffect(() => {
    async function checkToken() {
      try {
        const token = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY)
        if (token) setPhoneVerified(true)
      } catch { /* noop */ }
      try {
        const savedPhone = await AsyncStorage.getItem(PHONE_KEY)
        if (savedPhone) {
          setPhone(savedPhone)
          // Auto-lookup customer for name pre-fill
          lookupCustomer(savedPhone)
        }
      } catch { /* noop */ }
    }
    checkToken()
  }, [])

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [resendTimer])

  async function lookupCustomer(phoneVal: string) {
    try {
      const res = await apiFetch<{
        ok: boolean
        found: boolean
        givenName?: string
        familyName?: string
      }>('/api/customer/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneVal }),
      })
      if (res.found) {
        const fullName = [res.givenName, res.familyName].filter(Boolean).join(' ')
        if (fullName) setName((cur) => (cur.trim() === '' ? fullName : cur))
      }
    } catch { /* noop */ }
  }

  async function sendOtp(phoneVal?: string) {
    const p = formatAUPhone((phoneVal ?? phone).trim())
    if (!p) return
    setOtpLoading(true)
    setError(null)
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: p }),
      })
      setOtpPhone(p)
      setOtpCode('')
      setOtpError(false)
      setResendTimer(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOtpLoading(false)
    }
  }

  async function verifyOtp() {
    if (!otpPhone) return
    setOtpLoading(true)
    setError(null)
    setOtpError(false)
    try {
      const res = await apiFetch<{
        ok: boolean
        deviceToken: string
        found: boolean
        givenName?: string
        familyName?: string
      }>('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: otpPhone, code: otpCode }),
      })
      // Store device token securely
      await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, res.deviceToken)
      await AsyncStorage.setItem(PHONE_KEY, otpPhone)
      if (res.givenName || res.familyName) {
        const fullName = [res.givenName, res.familyName].filter(Boolean).join(' ')
        setName((cur) => (cur.trim() === '' ? fullName : cur))
      }
      const verifiedPhone = otpPhone
      setPhoneVerified(true)
      setOtpPhone(null)
      setOtpCode('')
      void lookupCustomer(verifiedPhone)
    } catch (err) {
      // 401 = wrong code
      if (err instanceof Error && err.message.includes('401')) {
        setOtpError(true)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setOtpLoading(false)
    }
  }

  const handlePay = async () => {
    if (items.length === 0) return

    // Validate required fields
    const missingName = !name.trim()
    const missingPhone = !phone.trim()
    if (missingName || missingPhone) {
      setShowFieldErrors(true)
      const parts: string[] = []
      if (missingName) parts.push('your name')
      if (missingPhone) parts.push('your phone')
      setError(`Please enter ${parts.join(' and ')}`)
      return
    }

    if (!phoneVerified) {
      setError('Please verify your phone number first')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const order = await createOrder(items)

      // TODO Task 11: Replace with Square In-App Payments SDK call
      const nonce = 'PLACEHOLDER_NONCE'

      const formattedPhone = formatAUPhone(phone.trim())
      await AsyncStorage.setItem(PHONE_KEY, formattedPhone)

      const result = await pay({
        token: nonce,
        orderId: order.id,
        total,
        phoneNumber: formattedPhone,
      })

      clearCart()
      router.replace({
        pathname: '/order-confirmation',
        params: {
          orderId: order.id,
          starsEarned: result.starsEarned?.toString() ?? '0',
        },
      })
    } catch (e) {
      Alert.alert(
        'Payment Failed',
        e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        [{ text: 'OK' }],
      )
    } finally {
      setProcessing(false)
    }
  }

  const isLoading = orderLoading || payLoading || processing

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <OrderSummary items={items} total={total} />

        {/* Name input */}
        <View style={styles.fieldSection}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Name</Text>
            {showFieldErrors && !name.trim() && (
              <Text style={styles.requiredStar}> *</Text>
            )}
          </View>
          <TextInput
            style={[
              styles.fieldInput,
              showFieldErrors && !name.trim() && styles.fieldInputError,
            ]}
            placeholder="Your name"
            value={name}
            onChangeText={(t) => {
              setName(t)
              setShowFieldErrors(false)
            }}
            autoComplete="name"
          />
        </View>

        {/* Phone input — hidden after verification */}
        {!phoneVerified && (
          <View style={styles.fieldSection}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Phone</Text>
              {showFieldErrors && !phone.trim() && (
                <Text style={styles.requiredStar}> *</Text>
              )}
            </View>
            <TextInput
              style={[
                styles.fieldInput,
                showFieldErrors && !phone.trim() && styles.fieldInputError,
              ]}
              placeholder="04xx xxx xxx"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                setPhone(t)
                setPhoneVerified(false)
                setOtpPhone(null)
                setShowFieldErrors(false)
              }}
              autoComplete="tel"
            />
          </View>
        )}

        {/* OTP Section */}
        <CheckoutOtpSection
          phone={phone}
          phoneVerified={phoneVerified}
          otpPhone={otpPhone}
          otpCode={otpCode}
          otpError={otpError}
          otpLoading={otpLoading}
          resendTimer={resendTimer}
          onSend={() => sendOtp()}
          onVerify={verifyOtp}
          onCodeChange={setOtpCode}
          onResend={() => sendOtp()}
        />

        {(error || orderError || payError) && (
          <Text style={styles.errorText}>{error || orderError || payError}</Text>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payButton, isLoading && styles.payButtonDisabled]}
          onPress={handlePay}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>Pay Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Checkout OTP verification section (3 states)                      */
/* ------------------------------------------------------------------ */

function CheckoutOtpSection({
  phone,
  phoneVerified,
  otpPhone,
  otpCode,
  otpError,
  otpLoading,
  resendTimer,
  onSend,
  onVerify,
  onCodeChange,
  onResend,
}: {
  phone: string
  phoneVerified: boolean
  otpPhone: string | null
  otpCode: string
  otpError: boolean
  otpLoading: boolean
  resendTimer: number
  onSend: () => void
  onVerify: () => void
  onCodeChange: (code: string) => void
  onResend: () => void
}) {
  const phoneDigits = phone.replace(/\D/g, '')
  if (phoneDigits.length < 10) return null

  // Already verified — green badge
  if (phoneVerified) {
    return (
      <View style={styles.verifiedBadge}>
        <Ionicons name="checkmark-circle" size={16} color="#15803d" />
        <Text style={styles.verifiedText}>Phone verified</Text>
      </View>
    )
  }

  // OTP sent — show code input
  if (otpPhone) {
    return (
      <View style={styles.otpSection}>
        <Text style={styles.otpHint}>
          Enter the 6-digit code sent to {otpPhone}
        </Text>
        <OtpInput value={otpCode} onChange={onCodeChange} error={otpError} />
        {otpError && (
          <Text style={styles.otpErrorText}>Invalid code. Please try again.</Text>
        )}
        <View style={styles.otpActions}>
          <TouchableOpacity
            onPress={onVerify}
            disabled={otpLoading || otpCode.length < 6}
            style={[
              styles.verifyBtn,
              (otpLoading || otpCode.length < 6) && styles.verifyBtnDisabled,
            ]}
          >
            <Text style={styles.verifyBtnText}>
              {otpLoading ? 'Verifying...' : 'Verify'}
            </Text>
          </TouchableOpacity>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={onResend} disabled={otpLoading}>
              <Text style={styles.resendLink}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // Phone entered but no OTP sent yet — show verify button
  return (
    <View style={styles.otpSection}>
      <TouchableOpacity
        onPress={onSend}
        disabled={otpLoading}
        style={[styles.sendOtpBtn, otpLoading && styles.sendOtpBtnDisabled]}
      >
        <Text style={styles.sendOtpBtnText}>
          {otpLoading ? 'Sending...' : 'Verify Phone'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.otpExplain}>
        {"We'll send a verification code to confirm your number"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fieldSection: { paddingHorizontal: 16, marginBottom: 12 },
  labelRow: { flexDirection: 'row', marginBottom: 6 },
  fieldLabel: { fontSize: 16, fontWeight: '600' },
  requiredStar: { color: '#ef4444', fontWeight: '700' },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  fieldInputError: {
    borderColor: '#f87171',
  },
  // OTP verified badge
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifiedText: { fontSize: 14, fontWeight: '600', color: '#15803d' },
  // OTP section
  otpSection: { paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  otpHint: { fontSize: 13, color: '#666' },
  otpErrorText: { fontSize: 13, color: '#ef4444' },
  otpActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verifyBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resendTimer: { fontSize: 13, color: '#888' },
  resendLink: { fontSize: 13, color: BRAND.color, fontWeight: '500' },
  // Send OTP button (before code sent)
  sendOtpBtn: {
    borderWidth: 1,
    borderColor: BRAND.color,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendOtpBtnDisabled: { opacity: 0.5 },
  sendOtpBtnText: { color: BRAND.color, fontSize: 15, fontWeight: '600' },
  otpExplain: { fontSize: 12, color: '#888', textAlign: 'center' },
  // Error & bottom bar
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  payButton: {
    backgroundColor: BRAND.color,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
