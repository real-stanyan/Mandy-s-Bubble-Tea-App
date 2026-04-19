import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '@/store/cart'
import { useCreateOrder } from '@/hooks/use-create-order'
import { usePayment } from '@/hooks/use-payment'
import { useAuth } from '@/components/auth/AuthProvider'
import { PaymentErrorDialog } from '@/components/ui/PaymentErrorDialog'
import { SignInCard } from '@/components/auth/SignInCard'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { CardBlock } from '@/components/checkout/CardBlock'
import { OrderPlaced } from '@/components/checkout/OrderPlaced'
import { hashColor } from '@/components/brand/color'
import { T, FONT, RADIUS, SHADOW } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import {
  initSquarePayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
} from '@/lib/square-payment'
import type { CartItem, CartModifier } from '@/types/square'

type PayMethod = 'card' | 'apple' | 'google'

/**
 * Mirrors the server-side cheapest-K algorithm in /api/orders for the
 * web repo. Keep in sync with src/app/api/orders/route.ts.
 */
function computeWelcomeDiscount(
  items: { price: number; quantity: number; modifiers?: { priceCents?: number }[] }[],
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

function cheapestItemPrice(items: { price: number }[]): number {
  if (items.length === 0) return 0
  return items.reduce((min, it) => (it.price < min ? it.price : min), items[0].price)
}

function groupModifiers(mods: CartModifier[] | undefined): string {
  if (!mods || mods.length === 0) return ''
  const byList = new Map<string, string[]>()
  for (const m of mods) {
    const key = (m.listName || 'OTHER').toLowerCase()
    const arr = byList.get(key) ?? []
    arr.push(m.name)
    byList.set(key, arr)
  }
  const parts: string[] = []
  for (const [, names] of byList) parts.push(names.join(', '))
  return parts.join(' · ')
}

function payLabel(m: PayMethod): string {
  if (m === 'apple') return 'Pay with Apple Pay'
  if (m === 'google') return 'Pay with Google Pay'
  return 'Pay with Card'
}

export default function CheckoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
  const [note, setNote] = useState('')
  const [placed, setPlaced] = useState<{
    pickupNumber: string
    totalCents: number
    starsEarned: number
  } | null>(null)

  const loyaltyBalance = loyalty?.balance ?? 0
  const perReward = starsPerReward || LOYALTY.starsForReward
  const canRedeem = perReward > 0 && loyaltyBalance >= perReward
  const welcomeAvailable = welcomeDiscount.available
  const welcomePercentage = welcomeDiscount.percentage

  useEffect(() => {
    try {
      initSquarePayments()
      canUseApplePay()
        .then((ok) => {
          setApplePayAvailable(ok)
          if (ok) setPayMethod('apple')
        })
        .catch(() => {})
      canUseGooglePay()
        .then((ok) => {
          setGooglePayAvailable(ok)
          if (ok) setPayMethod('google')
        })
        .catch(() => {})
    } catch (e) {
      console.warn('Square SDK init failed:', e)
    }
  }, [])

  const showWelcomeLine = welcomeAvailable && !(useReward && canRedeem)
  const welcomeCoverage = showWelcomeLine
    ? computeWelcomeDiscount(items, welcomeDiscount.drinksRemaining, welcomePercentage)
    : { coveredCount: 0, discountCents: 0 }
  const welcomeDiscountForSummary =
    showWelcomeLine && welcomeCoverage.coveredCount > 0
      ? {
          amountCents: welcomeCoverage.discountCents,
          percentage: welcomePercentage,
          coveredCount: welcomeCoverage.coveredCount,
        }
      : null

  const rewardDiscountCents = useReward && canRedeem ? cheapestItemPrice(items) : 0
  const displayedTotal = Math.max(
    total - rewardDiscountCents - (welcomeDiscountForSummary?.amountCents ?? 0),
    0,
  )

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/menu')
    }
  }

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
        note,
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

      // Save order items for track/history screens before clearing cart
      await AsyncStorage.setItem('mbt:lastOrder:items', JSON.stringify(items))

      const pickupRef = createdOrder.referenceId
        ? `#${createdOrder.referenceId}`
        : orderId
          ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0')
          : '#---'
      const starsEarned = result.loyaltyAccrued
        ? items.reduce((s, i) => s + i.quantity, 0)
        : 0
      const totalCents = Math.max(amountCents, 0)

      clearCart()
      // Re-hydrate profile/loyalty/welcomeDiscount so the success overlay
      // and home tab show the updated stars + consumed welcome.
      refreshAuth()
      setPlaced({ pickupNumber: pickupRef, totalCents, starsEarned })
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setPaymentError(message)
    } finally {
      setProcessing(false)
    }
  }

  const isLoading = orderLoading || payLoading || processing

  if (authLoading && !profile) {
    return (
      <View style={styles.centerLoad}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <InlineHeader onBack={handleBack} total={total} />
          <SimpleSummaryBlock items={items} total={total} />
          <View style={{ marginHorizontal: 16, marginTop: 4 }}>
            <SignInCard
              heading="Sign in to continue"
              subheading="We need your name + phone to place an order."
            />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <PaymentErrorDialog
        visible={!!paymentError}
        message={paymentError}
        onCancel={() => setPaymentError(null)}
        onRetry={() => {
          setPaymentError(null)
          handlePay()
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 130 }}
      >
        <InlineHeader onBack={handleBack} total={displayedTotal} />
        <StoreBlock />
        <PickupTimeBlock />
        <OrderItemsBlock items={items} />
        <RewardsBlock
          stars={loyaltyBalance}
          goal={perReward}
          canRedeem={canRedeem}
          useReward={useReward}
          onToggle={() => setUseReward((v) => !v)}
          welcome={
            welcomeDiscountForSummary
              ? {
                  amountCents: welcomeDiscountForSummary.amountCents,
                  coveredCount: welcomeDiscountForSummary.coveredCount,
                }
              : null
          }
        />
        <PaymentBlock
          payMethod={payMethod}
          applePay={applePayAvailable}
          googlePay={googlePayAvailable}
          onChange={setPayMethod}
        />
        <NotesBlock value={note} onChange={setNote} />
        <SummaryBlock
          subtotal={total}
          welcome={welcomeDiscountForSummary}
          rewardDiscount={rewardDiscountCents}
        />
        {(error || orderError || payError) && (
          <Text style={styles.errorText}>{error || orderError || payError}</Text>
        )}
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handlePay}
          disabled={isLoading}
          style={[styles.placeBtn, isLoading && { opacity: 0.65 }, ctaShadow]}
        >
          <View style={{ flex: 1, paddingLeft: 18 }}>
            <Text style={styles.placeEyebrow}>{payLabel(payMethod)}</Text>
            <Text style={styles.placeTitle}>Place order</Text>
          </View>
          <View style={styles.placeAmount}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.placeAmountText}>{formatPrice(displayedTotal)}</Text>
            )}
          </View>
        </Pressable>
      </View>

      {placed && (
        <OrderPlaced
          pickupNumber={placed.pickupNumber}
          totalCents={placed.totalCents}
          starsEarned={placed.starsEarned}
          storeName="Southport"
          onTrack={() => {
            setPlaced(null)
            router.replace('/(tabs)/order')
          }}
        />
      )}
    </View>
  )
}

/* ---------- Subcomponents ---------- */

function InlineHeader({ onBack, total }: { onBack: () => void; total: number }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Icon name="arrowL" size={18} color={T.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerEyebrow}>Checkout</Text>
        <Text style={styles.headerTitle}>Review & pay</Text>
      </View>
      <Text style={styles.headerTotal}>{formatPrice(total)}</Text>
    </View>
  )
}

function SimpleSummaryBlock({ items, total }: { items: CartItem[]; total: number }) {
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return (
    <CardBlock eyebrow="Your order" title={`${count} drink${count === 1 ? '' : 's'}`}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: 13, color: T.ink2 }}>
          Total {formatPrice(total)}
        </Text>
      </View>
    </CardBlock>
  )
}

function StoreBlock() {
  return (
    <CardBlock eyebrow="Pickup store" title="Mandy’s — Southport">
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: 12.5, color: T.ink2, lineHeight: 18 }}>
          34 Davenport St · Southport QLD 4215
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.openPill}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>Open now</Text>
          </View>
          <View style={styles.waitPill}>
            <Icon name="clock" size={11} color={T.ink2} />
            <Text style={styles.waitText}>~6 min</Text>
          </View>
        </View>
      </View>
    </CardBlock>
  )
}

function PickupTimeBlock() {
  return <CardBlock eyebrow="Pickup time" title="ASAP · ~6 min" />
}

function OrderItemsBlock({ items }: { items: CartItem[] }) {
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return (
    <CardBlock eyebrow="Your order" title={`${count} drink${count === 1 ? '' : 's'}`}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {items.map((it, idx) => (
          <View
            key={it.lineId ?? it.variationId}
            style={[styles.itemRow, idx === 0 && styles.itemRowFirst]}
          >
            <View style={styles.itemThumb}>
              <CupArt fill={hashColor(it.variationId)} stroke={T.ink} size={26} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemName} numberOfLines={1}>
                {it.quantity}× {it.name}
              </Text>
              {groupModifiers(it.modifiers) ? (
                <Text style={styles.itemSub} numberOfLines={2}>
                  {groupModifiers(it.modifiers)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.itemPrice}>{formatPrice(it.price * it.quantity)}</Text>
          </View>
        ))}
      </View>
    </CardBlock>
  )
}

function RewardsBlock({
  stars,
  goal,
  canRedeem,
  useReward,
  onToggle,
  welcome,
}: {
  stars: number
  goal: number
  canRedeem: boolean
  useReward: boolean
  onToggle: () => void
  welcome: { amountCents: number; coveredCount: number } | null
}) {
  const title = canRedeem ? 'Free drink available' : `${stars} / ${goal} stars`
  const progressPct = Math.min(goal > 0 ? stars / goal : 0, 1) * 100
  return (
    <CardBlock
      eyebrow="Rewards"
      title={title}
      right={
        canRedeem ? (
          <Pressable onPress={onToggle} style={styles.toggleRow} hitSlop={8}>
            <Text style={styles.toggleLabel}>Apply</Text>
            <View style={[styles.toggleTrack, useReward && { backgroundColor: T.brand }]}>
              <View
                style={[styles.toggleThumb, useReward && { transform: [{ translateX: 16 }] }]}
              />
            </View>
          </Pressable>
        ) : undefined
      }
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {!canRedeem && (
          <>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              +1 star with this order — {Math.max(goal - stars - 1, 0)} to go
            </Text>
          </>
        )}
        {canRedeem && (
          <Text style={styles.rewardsHint}>
            Toggle on to redeem one free drink from your order. Stars reset after redemption.
          </Text>
        )}
        {welcome && welcome.coveredCount > 0 && (
          <Text style={styles.welcomeHint}>
            Welcome 30% off applied to {welcome.coveredCount} drink
            {welcome.coveredCount === 1 ? '' : 's'} — saves {formatPrice(welcome.amountCents)}
          </Text>
        )}
      </View>
    </CardBlock>
  )
}

function PaymentBlock({
  payMethod,
  applePay,
  googlePay,
  onChange,
}: {
  payMethod: PayMethod
  applePay: boolean
  googlePay: boolean
  onChange: (m: PayMethod) => void
}) {
  const [open, setOpen] = useState(false)
  const options: { id: PayMethod; label: string; icon: 'apple' | 'google' | 'card' }[] = []
  if (applePay) options.push({ id: 'apple', label: 'Apple Pay', icon: 'apple' })
  if (googlePay) options.push({ id: 'google', label: 'Google Pay', icon: 'google' })
  options.push({ id: 'card', label: 'Card', icon: 'card' })
  const cur = options.find((o) => o.id === payMethod) ?? options[0]
  return (
    <CardBlock eyebrow="Payment" title={cur.label} onEdit={() => setOpen((o) => !o)}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        {open && (
          <View style={styles.payOptions}>
            {options.map((o, i) => {
              const active = o.id === payMethod
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                  style={[styles.payRow, i === 0 && styles.payRowFirst]}
                >
                  <View style={styles.payIconBox}>
                    <Icon name={o.icon} size={14} color={T.ink} />
                  </View>
                  <Text style={styles.payRowLabel}>{o.label}</Text>
                  <View
                    style={[
                      styles.radioOuter,
                      active && { borderColor: T.brand, backgroundColor: T.brand },
                    ]}
                  >
                    {active && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </CardBlock>
  )
}

function NotesBlock({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <CardBlock eyebrow="Notes for barista" title="Anything special?">
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="e.g. less ice, extra pearls, gift wrap"
          placeholderTextColor={T.ink3}
          multiline
          numberOfLines={2}
          style={styles.notesInput}
        />
      </View>
    </CardBlock>
  )
}

function SummaryBlock({
  subtotal,
  welcome,
  rewardDiscount,
}: {
  subtotal: number
  welcome: { amountCents: number; percentage: number; coveredCount: number } | null
  rewardDiscount: number
}) {
  const discountTotal = (welcome?.amountCents ?? 0) + rewardDiscount
  const total = Math.max(subtotal - discountTotal, 0)
  return (
    <View style={styles.summaryCard}>
      <SummaryRow label="Subtotal" amountCents={subtotal} muted />
      {welcome && welcome.amountCents > 0 && (
        <SummaryRow
          label={`Welcome ${welcome.percentage}% off (${welcome.coveredCount} drink${welcome.coveredCount === 1 ? '' : 's'})`}
          amountCents={-welcome.amountCents}
          muted
        />
      )}
      {rewardDiscount > 0 && (
        <SummaryRow label="Reward discount" amountCents={-rewardDiscount} muted />
      )}
      <View style={styles.summaryDivider} />
      <SummaryRow label="Total" amountCents={total} bold />
    </View>
  )
}

function SummaryRow({
  label,
  amountCents,
  bold,
  muted,
}: {
  label: string
  amountCents: number
  bold?: boolean
  muted?: boolean
}) {
  const sign = amountCents < 0 ? '−' : ''
  const abs = Math.abs(amountCents)
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold && styles.summaryLabelBold,
          muted && styles.summaryLabelMuted,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          bold && styles.summaryValueBold,
          muted && styles.summaryValueMuted,
        ]}
      >
        {sign}
        {formatPrice(abs)}
      </Text>
    </View>
  )
}

const ctaShadow = Platform.select({
  ios: {
    shadowColor: SHADOW.primaryCta.shadowColor,
    shadowOffset: SHADOW.primaryCta.shadowOffset,
    shadowOpacity: SHADOW.primaryCta.shadowOpacity,
    shadowRadius: SHADOW.primaryCta.shadowRadius,
  },
  android: { elevation: SHADOW.primaryCta.elevation },
  default: {},
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  centerLoad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: FONT.serif,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: T.ink,
    lineHeight: 26,
  },
  headerTotal: {
    fontFamily: FONT.mono,
    fontSize: 16,
    fontWeight: '700',
    color: T.ink,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(60,169,110,0.10)',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.green,
  },
  openText: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: T.greenDark,
  },
  waitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: T.bg2,
  },
  waitText: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: '700',
    color: T.ink2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  itemRowFirst: {
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  itemThumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.small,
    backgroundColor: T.paper,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemName: {
    fontFamily: FONT.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
  },
  itemSub: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 11.5,
    color: T.ink3,
    lineHeight: 15,
  },
  itemPrice: {
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: T.ink2,
    textTransform: 'uppercase',
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 999,
    backgroundColor: T.ink4,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  progressBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: T.bg2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.brand,
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 10,
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink2,
  },
  rewardsHint: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink2,
    lineHeight: 17,
  },
  welcomeHint: {
    marginTop: 8,
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '600',
    color: T.brand,
    lineHeight: 16,
  },
  payOptions: {
    borderTopWidth: 1,
    borderTopColor: T.line,
    borderStyle: 'dashed',
    marginTop: 6,
    paddingTop: 8,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  payRowFirst: {
    borderTopWidth: 0,
  },
  payIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: T.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRowLabel: {
    flex: 1,
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '600',
    color: T.ink,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: T.ink4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  notesInput: {
    minHeight: 64,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONT.sans,
    fontSize: 13.5,
    color: T.ink,
    textAlignVertical: 'top',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: FONT.sans,
    fontSize: 13,
    color: T.ink,
  },
  summaryLabelMuted: {
    color: T.ink2,
  },
  summaryLabelBold: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
  },
  summaryValue: {
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '600',
    color: T.ink,
  },
  summaryValueMuted: {
    color: T.ink2,
  },
  summaryValueBold: {
    fontFamily: FONT.mono,
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: T.line,
    marginVertical: 4,
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 4,
    color: '#b91c1c',
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  placeBtn: {
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  placeEyebrow: {
    fontFamily: FONT.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: T.cream,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  placeTitle: {
    marginTop: 2,
    fontFamily: FONT.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: T.cream,
    lineHeight: 22,
  },
  placeAmount: {
    minWidth: 110,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  placeAmountText: {
    fontFamily: FONT.mono,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
})
