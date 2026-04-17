import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
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
import { BRAND, STORAGE_KEYS } from '@/lib/constants'
import { apiFetch } from '@/lib/api'
import { Ionicons } from '@expo/vector-icons'
import {
  initSquarePayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
} from '@/lib/square-payment'

const DEVICE_TOKEN_KEY = STORAGE_KEYS.deviceToken
const PHONE_KEY = STORAGE_KEYS.phone
const NAME_KEY = STORAGE_KEYS.name

export default function CheckoutScreen() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)

  const { createOrder, loading: orderLoading, error: orderError } = useCreateOrder()
  const { pay, loading: payLoading, error: payError } = usePayment()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFieldErrors, setShowFieldErrors] = useState(false)

  // Payment method state
  type PayMethod = 'card' | 'apple' | 'google'
  const [payMethod, setPayMethod] = useState<PayMethod>('card')
  const [applePayAvailable, setApplePayAvailable] = useState(false)
  const [googlePayAvailable, setGooglePayAvailable] = useState(false)

  // Loyalty state (for signed-in users)
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null)
  const [starsPerReward, setStarsPerReward] = useState<number | null>(null)
  const [useReward, setUseReward] = useState(false)

  // OTP state
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // Skip OTP if user is already "signed in" on this device (device token or saved phone).
  // On mobile the app runs on the user's personal device — a phone saved via
  // Account tab / prior checkout is treated as a soft-login.
  useEffect(() => {
    async function checkToken() {
      let hasToken = false
      try {
        const token = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY)
        if (token) hasToken = true
      } catch { /* noop */ }
      let hasPhone = false
      try {
        const savedPhone = await AsyncStorage.getItem(PHONE_KEY)
        if (savedPhone) {
          setPhone(savedPhone)
          hasPhone = true
          lookupCustomer(savedPhone)
          fetchLoyalty(savedPhone)
        }
      } catch { /* noop */ }
      try {
        const savedName = await AsyncStorage.getItem(NAME_KEY)
        if (savedName) setName(savedName)
      } catch { /* noop */ }
      if (hasToken || hasPhone) setPhoneVerified(true)
    }
    checkToken()

    // Initialize Square SDK and check wallet availability
    try {
      initSquarePayments()
      canUseApplePay().then((ok) => {
        setApplePayAvailable(ok)
        if (ok) setPayMethod('apple')
      }).catch(() => {})
      canUseGooglePay().then((ok) => {
        setGooglePayAvailable(ok)
        if (ok) setPayMethod('google')
      }).catch(() => {})
    } catch (e) {
      console.warn('Square SDK init failed:', e)
    }
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
        customerId?: string
        givenName?: string
        familyName?: string
      }>('/api/customer/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneVal }),
      })
      if (res.found) {
        if (res.customerId) setCustomerId(res.customerId)
        const fullName = [res.givenName, res.familyName].filter(Boolean).join(' ')
        if (fullName) {
          setName((cur) => (cur.trim() === '' ? fullName : cur))
          await AsyncStorage.setItem(NAME_KEY, fullName)
        }
      }
    } catch { /* noop */ }
  }

  async function fetchLoyalty(phoneVal: string) {
    try {
      const res = await apiFetch<{
        ok: boolean
        account: { id: string; balance: number } | null
        starsPerReward?: number
      }>(`/api/loyalty/account?phone=${encodeURIComponent(phoneVal)}`)
      if (res.account) {
        setLoyaltyBalance(res.account.balance)
        if (res.starsPerReward) setStarsPerReward(res.starsPerReward)
      } else {
        setLoyaltyBalance(0)
        if (res.starsPerReward) setStarsPerReward(res.starsPerReward)
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
    // New-user registration needs a name — enforce before verifying
    // so we can auto-register after the code check.
    if (!name.trim()) {
      setShowFieldErrors(true)
      setError('Please enter your name to create an account')
      return
    }
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

      // If the phone has no Square customer yet, register one with the
      // user-entered name before treating them as logged in.
      if (!res.found) {
        const parts = name.trim().split(/\s+/)
        const firstName = parts[0]
        const lastName = parts.slice(1).join(' ') || undefined
        await apiFetch<{ ok: boolean; customerId: string }>('/api/customer', {
          method: 'POST',
          body: JSON.stringify({ firstName, lastName, phone: otpPhone }),
        })
      }

      // Store device token securely
      await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, res.deviceToken)
      await AsyncStorage.setItem(PHONE_KEY, otpPhone)
      if (res.found && (res.givenName || res.familyName)) {
        const fullName = [res.givenName, res.familyName].filter(Boolean).join(' ')
        setName((cur) => (cur.trim() === '' ? fullName : cur))
        await AsyncStorage.setItem(NAME_KEY, fullName)
      } else {
        await AsyncStorage.setItem(NAME_KEY, name.trim())
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

    // Signed-in users skip the name/phone fields entirely — they're pulled from storage.
    if (!isLoggedIn) {
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
    }

    setProcessing(true)
    setError(null)

    try {
      const formattedPhone = formatAUPhone(phone.trim())
      const { orderId, customerId: orderCustomerId } = await createOrder({
        items,
        name: name.trim() || 'Customer',
        phone: formattedPhone,
      })

      // Optionally redeem a loyalty reward before charging. Square
      // discounts the order server-side and returns the new total so
      // the payment nonce matches the post-discount amount.
      let amountCents = total
      if (useReward && canRedeem && orderCustomerId) {
        const redeemRes = await apiFetch<{
          ok: boolean
          updatedAmountCents?: string
          error?: string
        }>('/api/loyalty/redeem', {
          method: 'POST',
          body: JSON.stringify({
            customerId: orderCustomerId,
            phone: formattedPhone,
            orderId,
          }),
        })
        if (!redeemRes.ok) {
          throw new Error(redeemRes.error ?? 'Could not redeem reward')
        }
        if (typeof redeemRes.updatedAmountCents === 'string') {
          amountCents = Number(redeemRes.updatedAmountCents)
        }
      }

      const isFreeOrder = amountCents <= 0

      // Get payment nonce from Square SDK — skip entirely for a free order.
      let nonce: string | undefined
      if (!isFreeOrder) {
        const priceDollars = (amountCents / 100).toFixed(2)
        try {
          switch (payMethod) {
            case 'apple':
              nonce = await startApplePayPayment(priceDollars)
              break
            case 'google':
              nonce = await startGooglePayPayment(priceDollars)
              break
            case 'card':
            default:
              nonce = await startCardPayment()
              break
          }
        } catch (sdkErr) {
          const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr)
          if (msg.includes('cancelled') || msg.includes('canceled')) {
            setProcessing(false)
            return
          }
          throw sdkErr
        }
      }

      await AsyncStorage.setItem(PHONE_KEY, formattedPhone)

      const result = await pay({
        sourceId: nonce,
        orderId,
        customerId: orderCustomerId,
        phone: formattedPhone,
      })

      // Save order items for confirmation page before clearing cart
      await AsyncStorage.setItem('mbt:lastOrder:items', JSON.stringify(items))

      clearCart()
      router.replace({
        pathname: '/order-confirmation',
        params: {
          orderId,
          loyaltyAccrued: result.loyaltyAccrued ? '1' : '0',
          total: total.toString(),
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
  const isLoggedIn = phoneVerified
  const canRedeem =
    loyaltyBalance != null &&
    starsPerReward != null &&
    starsPerReward > 0 &&
    loyaltyBalance >= starsPerReward
  const willBeFreeOrder = useReward && canRedeem && total - cheapestItemPrice(items) <= 0

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <OrderSummary items={items} total={total} />

        {isLoggedIn && (
          <View style={styles.signedInBadge}>
            <Ionicons name="person-circle" size={18} color="#15803d" />
            <Text style={styles.signedInText} numberOfLines={1}>
              Signed in as {name || phone}
            </Text>
          </View>
        )}

        {isLoggedIn && loyaltyBalance != null && starsPerReward != null && starsPerReward > 0 && (
          <LoyaltyRewardCard
            balance={loyaltyBalance}
            starsPerReward={starsPerReward}
            useReward={useReward}
            onToggle={() => setUseReward((v) => !v)}
            rewardDiscountCents={cheapestItemPrice(items)}
          />
        )}

        {!isLoggedIn && (
        <>
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

        {/* Phone input — always visible so user can see/edit their number.
            Verification status is shown by the OTP section below. */}
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
        </>
        )}

        {/* Payment Method Selector */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Payment Method</Text>
          <View style={styles.payMethodRow}>
            {applePayAvailable && (
              <TouchableOpacity
                style={[
                  styles.payMethodTab,
                  payMethod === 'apple' && styles.payMethodTabActive,
                ]}
                onPress={() => setPayMethod('apple')}
              >
                <Ionicons
                  name="logo-apple"
                  size={18}
                  color={payMethod === 'apple' ? '#fff' : '#333'}
                />
                <Text
                  style={[
                    styles.payMethodText,
                    payMethod === 'apple' && styles.payMethodTextActive,
                  ]}
                >
                  Apple Pay
                </Text>
              </TouchableOpacity>
            )}
            {googlePayAvailable && (
              <TouchableOpacity
                style={[
                  styles.payMethodTab,
                  payMethod === 'google' && styles.payMethodTabActive,
                ]}
                onPress={() => setPayMethod('google')}
              >
                <Ionicons
                  name="logo-google"
                  size={18}
                  color={payMethod === 'google' ? '#fff' : '#333'}
                />
                <Text
                  style={[
                    styles.payMethodText,
                    payMethod === 'google' && styles.payMethodTextActive,
                  ]}
                >
                  Google Pay
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.payMethodTab,
                payMethod === 'card' && styles.payMethodTabActive,
              ]}
              onPress={() => setPayMethod('card')}
            >
              <Ionicons
                name="card-outline"
                size={18}
                color={payMethod === 'card' ? '#fff' : '#333'}
              />
              <Text
                style={[
                  styles.payMethodText,
                  payMethod === 'card' && styles.payMethodTextActive,
                ]}
              >
                Card
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {(error || orderError || payError) && (
          <Text style={styles.errorText}>{error || orderError || payError}</Text>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.payButton,
            isLoading && styles.payButtonDisabled,
            payMethod === 'apple' && styles.applePayButton,
            payMethod === 'google' && styles.googlePayButton,
          ]}
          onPress={handlePay}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.payButtonContent}>
              {willBeFreeOrder ? (
                <Ionicons name="star" size={18} color="#fff" style={{ marginRight: 6 }} />
              ) : payMethod === 'apple' ? (
                <Ionicons name="logo-apple" size={20} color="#fff" style={{ marginRight: 6 }} />
              ) : payMethod === 'google' ? (
                <Ionicons name="logo-google" size={18} color="#fff" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.payButtonText}>
                {willBeFreeOrder
                  ? 'Place Free Order'
                  : payMethod === 'apple'
                    ? 'Pay with Apple Pay'
                    : payMethod === 'google'
                      ? 'Pay with Google Pay'
                      : 'Pay with Card'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Loyalty reward card                                               */
/* ------------------------------------------------------------------ */

function cheapestItemPrice(items: { price: number }[]): number {
  if (items.length === 0) return 0
  return items.reduce((min, it) => (it.price < min ? it.price : min), items[0].price)
}

function LoyaltyRewardCard({
  balance,
  starsPerReward,
  useReward,
  onToggle,
  rewardDiscountCents,
}: {
  balance: number
  starsPerReward: number
  useReward: boolean
  onToggle: () => void
  rewardDiscountCents: number
}) {
  const canRedeem = balance >= starsPerReward
  const pct = Math.min((balance / starsPerReward) * 100, 100)
  const discountDollars = (rewardDiscountCents / 100).toFixed(2)
  return (
    <View style={styles.loyaltyCard}>
      <View style={styles.loyaltyHeader}>
        <Text style={styles.loyaltyTitle}>⭐ Loyalty Stars</Text>
        <Text style={styles.loyaltyCount}>
          {balance} / {starsPerReward}
        </Text>
      </View>
      <View style={styles.loyaltyBarTrack}>
        <View style={[styles.loyaltyBarFill, { width: `${pct}%` }]} />
      </View>
      {canRedeem ? (
        <TouchableOpacity
          style={[styles.rewardToggle, useReward && styles.rewardToggleActive]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, useReward && styles.checkboxActive]}>
            {useReward && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardToggleTitle}>
              Redeem free drink reward
            </Text>
            <Text style={styles.rewardToggleSub}>
              Save A${discountDollars} on this order
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.loyaltyHint}>
          {starsPerReward - balance} more ⭐ for a free drink
        </Text>
      )}
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
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={onResend} disabled={otpLoading}>
              <Text style={styles.resendLink}>Resend code</Text>
            </TouchableOpacity>
          )}
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
  signedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signedInText: { fontSize: 14, fontWeight: '600', color: '#15803d', flex: 1 },
  // Loyalty reward card
  loyaltyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: BRAND.accentColor,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  loyaltyCount: { fontSize: 14, fontWeight: '700', color: BRAND.color },
  loyaltyBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  loyaltyBarFill: {
    height: '100%',
    backgroundColor: BRAND.color,
    borderRadius: 4,
  },
  loyaltyHint: { fontSize: 12, color: '#8a8076', textAlign: 'center', marginTop: 2 },
  rewardToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  rewardToggleActive: {
    borderColor: BRAND.color,
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxActive: {
    backgroundColor: BRAND.color,
    borderColor: BRAND.color,
  },
  rewardToggleTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  rewardToggleSub: { fontSize: 12, color: BRAND.color, marginTop: 2, fontWeight: '600' },
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
  otpActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  verifyBtn: {
    backgroundColor: BRAND.color,
    width: '50%',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
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
  // Payment method selector
  payMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  payMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  payMethodTabActive: {
    backgroundColor: '#333',
    borderColor: '#333',
  },
  payMethodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  payMethodTextActive: {
    color: '#fff',
  },
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
  applePayButton: { backgroundColor: '#000' },
  googlePayButton: { backgroundColor: '#333' },
  payButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
