import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '@/store/cart'
import { useCreateOrder } from '@/hooks/use-create-order'
import { usePayment } from '@/hooks/use-payment'
import { useAuth } from '@/components/auth/AuthProvider'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { PaymentErrorDialog } from '@/components/ui/PaymentErrorDialog'
import { SignInCard } from '@/components/auth/SignInCard'
import { BRAND, LOYALTY } from '@/lib/constants'
import { apiFetch } from '@/lib/api'
import {
  initSquarePayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
} from '@/lib/square-payment'
import type { LoyaltyAccount } from '@/types/square'

type PayMethod = 'card' | 'apple' | 'google'

/**
 * Mirrors the server-side cheapest-K algorithm in /api/orders for the
 * web repo. Keep in sync with src/app/api/orders/route.ts.
 */
function computeWelcomeDiscount(
  items: { price: number; quantity: number; modifiers?: Array<{ priceCents?: number }> }[],
  drinksRemaining: number,
  percentage: number,
): { coveredCount: number; discountCents: number } {
  if (drinksRemaining <= 0 || items.length === 0 || percentage <= 0) {
    return { coveredCount: 0, discountCents: 0 }
  }
  const unitPrices: number[] = []
  for (const item of items) {
    // item.price is the stored per-unit line price — matches the server's
    // (variationPriceCents + modifierPriceCentsSum) expansion.
    for (let i = 0; i < item.quantity; i++) unitPrices.push(item.price)
  }
  unitPrices.sort((a, b) => a - b)
  const K = Math.min(drinksRemaining, unitPrices.length)
  if (K === 0) return { coveredCount: 0, discountCents: 0 }
  const coveredSum = unitPrices.slice(0, K).reduce((s, p) => s + p, 0)
  return {
    coveredCount: K,
    discountCents: Math.floor((coveredSum * percentage) / 100),
  }
}

export default function CheckoutScreen() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)

  const {
    profile,
    loyalty,
    welcomeDiscount,
    starsPerReward,
    loading: authLoading,
    refresh: refreshAuth,
  } = useAuth()
  const { createOrder, loading: orderLoading, error: orderError } = useCreateOrder()
  const { pay, loading: payLoading, error: payError } = usePayment()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [payMethod, setPayMethod] = useState<PayMethod>('card')
  const [applePayAvailable, setApplePayAvailable] = useState(false)
  const [googlePayAvailable, setGooglePayAvailable] = useState(false)
  const [useReward, setUseReward] = useState(false)

  const loyaltyBalance = loyalty?.balance ?? 0
  const perReward = starsPerReward || LOYALTY.starsForReward
  const canRedeem = perReward > 0 && loyaltyBalance >= perReward
  const welcomeAvailable = welcomeDiscount.available
  const welcomePercentage = welcomeDiscount.percentage

  useEffect(() => {
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

  const handlePay = async () => {
    if (items.length === 0) return
    if (!profile) return

    setProcessing(true)
    setError(null)
    setPaymentError(null)

    // Loyalty reward (line-level) beats welcome (order-level) in display —
    // only pass the welcome flag when the user isn't redeeming a reward, so
    // the totals shown at checkout match what Square actually charges.
    const useWelcome = welcomeAvailable && !(useReward && canRedeem)

    try {
      const { orderId, order: createdOrder } = await createOrder({
        items,
        applyWelcomeDiscount: useWelcome,
      })

      let amountCents = total
      if (useWelcome) {
        const { discountCents } = computeWelcomeDiscount(
          items,
          welcomeDiscount.drinksRemaining,
          welcomePercentage,
        )
        amountCents = Math.max(total - discountCents, 0)
      }
      if (useReward && canRedeem) {
        const redeemRes = await apiFetch<{
          ok: boolean
          updatedAmountCents?: string
          error?: string
        }>('/api/loyalty/redeem', {
          method: 'POST',
          body: JSON.stringify({ orderId }),
        })
        if (!redeemRes.ok) {
          throw new Error(redeemRes.error ?? 'Could not redeem reward')
        }
        if (typeof redeemRes.updatedAmountCents === 'string') {
          amountCents = Number(redeemRes.updatedAmountCents)
        }
      }

      const isFreeOrder = amountCents <= 0

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

      const result = await pay({ sourceId: nonce, orderId })

      // Save order items for confirmation page before clearing cart
      await AsyncStorage.setItem('mbt:lastOrder:items', JSON.stringify(items))

      clearCart()
      // Re-hydrate profile/loyalty/welcomeDiscount so the confirmation
      // screen and home tab show the updated stars + consumed welcome.
      refreshAuth()
      router.replace({
        pathname: '/order-confirmation',
        params: {
          orderId,
          pickupNumber: createdOrder.referenceId ?? '',
          loyaltyAccrued: result.loyaltyAccrued ? '1' : '0',
          total: total.toString(),
        },
      })
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setPaymentError(message)
    } finally {
      setProcessing(false)
    }
  }

  const isLoading = orderLoading || payLoading || processing
  const willBeFreeOrder = useReward && canRedeem && total - cheapestItemPrice(items) <= 0
  const showWelcomeLine = welcomeAvailable && !(useReward && canRedeem)
  const welcomeCoverage = showWelcomeLine
    ? computeWelcomeDiscount(items, welcomeDiscount.drinksRemaining, welcomePercentage)
    : { coveredCount: 0, discountCents: 0 }
  const welcomeDiscountForSummary = showWelcomeLine && welcomeCoverage.coveredCount > 0
    ? {
        amountCents: welcomeCoverage.discountCents,
        percentage: welcomePercentage,
        coveredCount: welcomeCoverage.coveredCount,
      }
    : null

  if (authLoading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (!profile) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <OrderSummary items={items} total={total} />
        <SignInCard
          heading="Sign in to continue"
          subheading="We need your name + phone to place an order. Sign in with Apple, Google, or your mobile number."
        />
      </ScrollView>
    )
  }

  const account: LoyaltyAccount = loyalty
    ? { id: loyalty.accountId, balance: loyalty.balance, lifetimePoints: loyalty.lifetimePoints }
    : { id: '', balance: 0, lifetimePoints: 0 }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()

  return (
    <View style={styles.container}>
      <PaymentErrorDialog
        visible={!!paymentError}
        message={paymentError}
        onCancel={() => setPaymentError(null)}
        onRetry={() => {
          setPaymentError(null)
          handlePay()
        }}
      />
      <ScrollView keyboardShouldPersistTaps="handled">
        <OrderSummary
          items={items}
          total={total}
          welcomeDiscount={welcomeDiscountForSummary}
        />

        <View style={styles.signedInBadge}>
          <Ionicons name="person-circle" size={18} color="#15803d" />
          <Text style={styles.signedInText} numberOfLines={1}>
            Signed in as {fullName || profile.phone_e164}
          </Text>
        </View>

        <View style={styles.loyaltyWrap}>
          <LoyaltyCard account={account} starsPerReward={perReward} />
          {canRedeem && (
            <RedeemToggle
              useReward={useReward}
              onToggle={() => setUseReward((v) => !v)}
              rewardDiscountCents={cheapestItemPrice(items)}
            />
          )}
        </View>

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

function cheapestItemPrice(items: { price: number }[]): number {
  if (items.length === 0) return 0
  return items.reduce((min, it) => (it.price < min ? it.price : min), items[0].price)
}

function RedeemToggle({
  useReward,
  onToggle,
  rewardDiscountCents,
}: {
  useReward: boolean
  onToggle: () => void
  rewardDiscountCents: number
}) {
  const discountDollars = (rewardDiscountCents / 100).toFixed(2)
  return (
    <TouchableOpacity
      style={[styles.rewardToggle, useReward && styles.rewardToggleActive]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.checkbox, useReward && styles.checkboxActive]}>
        {useReward && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rewardToggleTitle}>Redeem free drink reward</Text>
        <Text style={styles.rewardToggleSub}>
          Save A${discountDollars} on this order
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fieldSection: { paddingHorizontal: 16, marginBottom: 12 },
  fieldLabel: { fontSize: 16, fontWeight: '600' },
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
  loyaltyWrap: {
    marginBottom: 24,
  },
  rewardToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
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
