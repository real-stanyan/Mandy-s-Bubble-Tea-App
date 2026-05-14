import { useEffect, useMemo, useState } from 'react'
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
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '@/store/cart'
import { useCreateOrder } from '@/hooks/use-create-order'
import { usePayment } from '@/hooks/use-payment'
import { useOrderAcceptance } from '@/hooks/use-order-acceptance'
import { canAcceptOrders } from '@/components/home/helpers'
import { useAuth } from '@/components/auth/AuthProvider'
import { PaymentErrorDialog } from '@/components/ui/PaymentErrorDialog'
import { PickupReminderDialog } from '@/components/checkout/PickupReminderDialog'
import { SignInCard } from '@/components/auth/SignInCard'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { CardBlock } from '@/components/checkout/CardBlock'
import { OrderPlaced } from '@/components/checkout/OrderPlaced'
import { hashColor } from '@/components/brand/color'
import { T, FONT, RADIUS, SHADOW } from '@/constants/theme'
import { CARD_SURCHARGE, LOYALTY, PH_SURCHARGE, PLATFORM_FEE } from '@/lib/constants'
import { cardSurcharge, platformFee, publicHolidaySurcharge } from '@/lib/surcharge'
import { isPublicHolidayActive } from '@/lib/holiday'
import { formatPrice } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { pickPromoCups } from '@/lib/promo-cup-pick'
import {
  initSquarePayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
} from '@/lib/square-payment'
import type { CartItem, CartModifier } from '@/types/square'
import { cartToSlots, type DoodleSlot } from '@/lib/doodle/cartToSlots'
import { DoodleSection } from '@/components/doodle/DoodleSection'
import { uploadDoodle } from '@/lib/doodle/uploadDoodle'

type PayMethod = 'card' | 'apple' | 'google'

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
    igFollowDiscount,
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
  const [rewardCount, setRewardCount] = useState(0)
  const [note, setNote] = useState('')
  const [placed, setPlaced] = useState<{
    pickupNumber: string
    totalCents: number
    starsEarned: number
  } | null>(null)

  const [slots, setSlots] = useState<DoodleSlot[]>(() => cartToSlots(items))

  useEffect(() => {
    // Re-derive slots when cart shape changes, but preserve userPaths for slots
    // whose (lineId, cupIdx) still exists.
    setSlots(prev => {
      const next = cartToSlots(items)
      const prevByKey = new Map(
        prev.map(s => [`${s.lineId}:${s.cupIdx}`, s] as const),
      )
      return next.map(n => {
        const old = prevByKey.get(`${n.lineId}:${n.cupIdx}`)
        return old?.userPaths ? { ...n, userPaths: old.userPaths } : n
      })
    })
  }, [items])

  const handleSlotChange = (slotIdx: number, next: DoodleSlot) => {
    setSlots(prev => prev.map((s, i) => (i === slotIdx ? next : s)))
  }

  const loyaltyBalance = loyalty?.balance ?? 0
  const perReward = starsPerReward || LOYALTY.starsForReward
  const canRedeem = perReward > 0 && loyaltyBalance >= perReward
  const welcomeAvailable = welcomeDiscount.available
  const welcomePercentage = welcomeDiscount.percentage

  const cupCount = items.reduce((n, it) => n + it.quantity, 0)
  const maxRewardCount = perReward > 0
    ? Math.min(Math.floor(loyaltyBalance / perReward), cupCount)
    : 0

  useEffect(() => {
    if (rewardCount > maxRewardCount) setRewardCount(maxRewardCount)
  }, [maxRewardCount, rewardCount])

  useEffect(() => {
    if (!profile) return
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
  }, [profile])

  const sortedUnitPrices = useMemo(() => {
    const arr: number[] = []
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) arr.push(item.price)
    }
    return arr.sort((a, b) => a - b)
  }, [items])

  const welcomeK = welcomeAvailable
    ? Math.min(welcomeDiscount.drinksRemaining, sortedUnitPrices.length)
    : 0
  const igFollowK = igFollowDiscount.available ? igFollowDiscount.drinksRemaining : 0

  const { welcomeCups, igFollowCups } = pickPromoCups({
    unitPrices: sortedUnitPrices,
    welcomeK,
    igFollowK,
    loyaltyRewardCount: rewardCount,
  })

  const welcomeAmount = Math.floor(
    (welcomeCups.reduce((s, p) => s + p, 0) * welcomePercentage) / 100,
  )
  const igFollowAmount = Math.floor(
    (igFollowCups.reduce((s, p) => s + p, 0) * igFollowDiscount.percentage) / 100,
  )

  const welcomeDiscountForSummary =
    welcomeAvailable && welcomeCups.length > 0
      ? {
          amountCents: welcomeAmount,
          percentage: welcomePercentage,
          coveredCount: welcomeCups.length,
        }
      : null

  const igFollowDiscountForSummary =
    igFollowDiscount.available && igFollowCups.length > 0
      ? {
          amountCents: igFollowAmount,
          percentage: igFollowDiscount.percentage,
          coveredCount: igFollowCups.length,
        }
      : null

  const rewardDiscountCents = sortedUnitPrices
    .slice(0, rewardCount)
    .reduce((s, p) => s + p, 0)
  const totalDiscountCents =
    rewardDiscountCents +
    (welcomeDiscountForSummary?.amountCents ?? 0) +
    (igFollowDiscountForSummary?.amountCents ?? 0)
  const isFreeRedeem = rewardCount > 0 && total - totalDiscountCents <= 0
  // Mirrors the SUBTOTAL_PHASE Square service charge in /api/orders:
  // 1.9% of the pre-discount subtotal, floored. Skipped on free redeem
  // since the server also skips it on that branch.
  const surchargeCents = isFreeRedeem ? 0 : cardSurcharge(total)
  const platformFeeCents = isFreeRedeem ? 0 : platformFee(total)
  // PH surcharge mirrors the server-side detection: 10% of the pre-discount
  // subtotal, only on QLD public holidays (Christmas Eve from 18:00).
  // Skipped on free redeem for the same reason as the card surcharge.
  const phActive = isPublicHolidayActive()
  const phSurchargeCents = isFreeRedeem || !phActive
    ? 0
    : publicHolidaySurcharge(total)
  const displayedTotal = Math.max(
    total
      - rewardDiscountCents
      - (welcomeDiscountForSummary?.amountCents ?? 0)
      - (igFollowDiscountForSummary?.amountCents ?? 0)
      + surchargeCents
      + platformFeeCents
      + phSurchargeCents,
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
    // Defensive: UI should already have the button disabled, but guard the
    // submit path in case acceptance flips between render and tap.
    if (!canAcceptOrders().accepting) return

    setProcessing(true)
    setError(null)
    setPaymentError(null)

    const useWelcome = welcomeAvailable && welcomeCups.length > 0
    const useIgFollow = igFollowDiscount.available && igFollowCups.length > 0

    try {
      // applyLoyaltyReward (legacy) + loyaltyRewardCount (new) both gate
      // server-side skipSurcharges. Either > 0 / true skips the SUBTOTAL_PHASE
      // service charges (card surcharge, platform fee, PH surcharge) — which
      // matches Square applying loyalty reward discounts on the order.
      const { orderId, order: createdOrder } = await createOrder({
        items,
        applyWelcomeDiscount: useWelcome,
        applyIgFollowDiscount: useIgFollow,
        applyLoyaltyReward: rewardCount > 0,
        loyaltyRewardCount: rewardCount,
        note,
      })

      let amountCents = total
      if (useWelcome) amountCents = Math.max(amountCents - welcomeAmount, 0)
      if (useIgFollow) amountCents = Math.max(amountCents - igFollowAmount, 0)
      if (rewardCount > 0) {
        const redeemRes = await apiFetch<{
          ok: boolean
          updatedAmountCents?: string
          error?: string
        }>('/api/loyalty/redeem', {
          method: 'POST',
          body: JSON.stringify({ orderId, count: rewardCount }),
        })
        if (!redeemRes.ok) {
          throw new Error(redeemRes.error ?? 'Could not redeem reward')
        }
        if (typeof redeemRes.updatedAmountCents === 'string') {
          amountCents = Number(redeemRes.updatedAmountCents)
        }
      }

      const isFreeOrder = amountCents <= 0
      // Surcharges mirror the SUBTOTAL_PHASE service charges attached
      // server-side; add them to the Apple/Google Pay sheet total so the
      // user sees the real amount Square will capture. PH → Platform → Card
      // matches the server's receipt ordering.
      if (!isFreeOrder) {
        if (phSurchargeCents > 0) amountCents += phSurchargeCents
        if (platformFeeCents > 0) amountCents += platformFeeCents
        if (surchargeCents > 0) amountCents += surchargeCents
      }

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

      // Slot resolution priority: AI / uploaded photo > drawn > preset/default.
      // Server-side both `aiDoodleId` and `uploadedDoodleId` end up in the
      // same `aiDoodleIds` map — they're both preprocessed PNGs in Storage,
      // the source distinction is purely UI-side.
      const aiDoodleIds: Record<string, string> = {}
      for (const s of slots) {
        const id = s.aiDoodleId ?? s.uploadedDoodleId
        if (id) aiDoodleIds[`${s.lineId}:${s.cupIdx}`] = id
      }

      const doodleIds: Record<string, string> = {}
      const drawnSlots = slots.filter(
        (s) => !s.aiDoodleId && !s.uploadedDoodleId && (s.userPaths?.length ?? 0) > 0,
      )
      for (const s of drawnSlots) {
        try {
          const { doodleId } = await uploadDoodle(s.userPaths!)
          doodleIds[`${s.lineId}:${s.cupIdx}`] = doodleId
        } catch (e) {
          // Soft-fail: this cup falls back to the default. The order still goes through.
          console.warn('[doodle] upload failed for', s.lineId, s.cupIdx, e)
        }
      }

      const doodleDefaults: Record<string, string> = {}
      for (const s of slots) {
        if (s.aiDoodleId || s.uploadedDoodleId) continue
        if (!s.userPaths || s.userPaths.length === 0) {
          doodleDefaults[`${s.lineId}:${s.cupIdx}`] = s.defaultKey
        }
      }

      const result = await pay({
        sourceId: nonce,
        orderId,
        doodleIds: Object.keys(doodleIds).length > 0 ? doodleIds : undefined,
        doodleDefaults: Object.keys(doodleDefaults).length > 0 ? doodleDefaults : undefined,
        aiDoodleIds: Object.keys(aiDoodleIds).length > 0 ? aiDoodleIds : undefined,
      })

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
  const acceptance = useOrderAcceptance()
  const payDisabled = isLoading || !acceptance.accepting

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
      <PickupReminderDialog />
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
        <DoodleSection slots={slots} onSlotChange={handleSlotChange} />
        <OrderItemsBlock items={items} />
        <RewardsBlock
          stars={loyaltyBalance}
          goal={perReward}
          canRedeem={canRedeem}
          rewardCount={rewardCount}
          maxRewardCount={maxRewardCount}
          onIncrement={() => setRewardCount((n) => Math.min(maxRewardCount, n + 1))}
          onDecrement={() => setRewardCount((n) => Math.max(0, n - 1))}
          welcome={
            welcomeDiscountForSummary
              ? {
                  amountCents: welcomeDiscountForSummary.amountCents,
                  coveredCount: welcomeDiscountForSummary.coveredCount,
                }
              : null
          }
          igFollow={
            igFollowDiscountForSummary
              ? {
                  amountCents: igFollowDiscountForSummary.amountCents,
                  coveredCount: igFollowDiscountForSummary.coveredCount,
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
          igFollow={igFollowDiscountForSummary}
          rewardDiscount={rewardDiscountCents}
          rewardCount={rewardCount}
          surcharge={surchargeCents}
          platformFee={platformFeeCents}
          phSurcharge={phSurchargeCents}
        />
        {(error || orderError || payError) && (
          <Text style={styles.errorText}>{error || orderError || payError}</Text>
        )}
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handlePay}
          disabled={payDisabled}
          style={[styles.placeBtn, payDisabled && { opacity: 0.5 }, ctaShadow]}
        >
          <View style={{ flex: 1, paddingLeft: 18 }}>
            <Text style={styles.placeEyebrow}>
              {!acceptance.accepting ? 'Closed' : payLabel(payMethod)}
            </Text>
            <Text style={styles.placeTitle}>
              {!acceptance.accepting ? `Opens ${acceptance.nextOpenLabel}` : 'Place order'}
            </Text>
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
              {it.imageUrl ? (
                <Image
                  source={{ uri: it.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                <CupArt fill={hashColor(it.variationId)} stroke={T.ink} size={26} />
              )}
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
  rewardCount,
  maxRewardCount,
  onIncrement,
  onDecrement,
  welcome,
  igFollow,
}: {
  stars: number
  goal: number
  canRedeem: boolean
  rewardCount: number
  maxRewardCount: number
  onIncrement: () => void
  onDecrement: () => void
  welcome: { amountCents: number; coveredCount: number } | null
  igFollow: { amountCents: number; coveredCount: number } | null
}) {
  const title = canRedeem ? 'Free drink available' : `${stars} / ${goal} stars`
  const progressPct = Math.min(goal > 0 ? stars / goal : 0, 1) * 100
  return (
    <CardBlock
      eyebrow="Rewards"
      title={title}
      right={
        maxRewardCount > 0 ? (
          <View style={styles.stepperRow}>
            <Pressable
              onPress={onDecrement}
              disabled={rewardCount === 0}
              style={[styles.stepperBtn, rewardCount === 0 && styles.stepperBtnDisabled]}
              accessibilityLabel="Decrease reward count"
              hitSlop={6}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperCount}>{rewardCount}</Text>
            <Pressable
              onPress={onIncrement}
              disabled={rewardCount === maxRewardCount}
              style={[styles.stepperBtn, rewardCount === maxRewardCount && styles.stepperBtnDisabled]}
              accessibilityLabel="Increase reward count"
              hitSlop={6}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
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
        {canRedeem && rewardCount === 0 && (
          <Text style={styles.rewardsHint}>
            Tap + to redeem free drinks. Each reward covers one drink and uses {goal} stars.
          </Text>
        )}
        {canRedeem && rewardCount > 0 && (
          <Text style={styles.rewardsHint}>
            Redeeming {rewardCount} free drink{rewardCount === 1 ? '' : 's'}.
          </Text>
        )}
        {welcome && welcome.coveredCount > 0 && (
          <Text style={styles.welcomeHint}>
            Welcome 30% off applied to {welcome.coveredCount} drink
            {welcome.coveredCount === 1 ? '' : 's'} — saves {formatPrice(welcome.amountCents)}
          </Text>
        )}
        {igFollow && igFollow.coveredCount > 0 && (
          <Text style={styles.welcomeHint}>
            IG Follow 10% off applied to {igFollow.coveredCount} drink
            {igFollow.coveredCount === 1 ? '' : 's'} — saves {formatPrice(igFollow.amountCents)}
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
  igFollow,
  rewardDiscount,
  rewardCount: rewardCountForSummary,
  surcharge,
  platformFee: platformFeeAmt,
  phSurcharge,
}: {
  subtotal: number
  welcome: { amountCents: number; percentage: number; coveredCount: number } | null
  igFollow: { amountCents: number; percentage: number; coveredCount: number } | null
  rewardDiscount: number
  rewardCount: number
  surcharge: number
  platformFee: number
  phSurcharge: number
}) {
  const discountTotal =
    (welcome?.amountCents ?? 0) + (igFollow?.amountCents ?? 0) + rewardDiscount
  const total = Math.max(
    subtotal - discountTotal + surcharge + platformFeeAmt + phSurcharge,
    0,
  )
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
      {igFollow && igFollow.amountCents > 0 && (
        <SummaryRow
          label={`IG Follow ${igFollow.percentage}% off (${igFollow.coveredCount} drink${igFollow.coveredCount === 1 ? '' : 's'})`}
          amountCents={-igFollow.amountCents}
          muted
        />
      )}
      {rewardDiscount > 0 && (
        <SummaryRow
          label={`Reward discount${rewardCountForSummary > 1 ? ` ×${rewardCountForSummary}` : ''}`}
          amountCents={-rewardDiscount}
          muted
        />
      )}
      {phSurcharge > 0 && (
        <SummaryRow
          label={`${PH_SURCHARGE.name} (${PH_SURCHARGE.percentage}%)`}
          amountCents={phSurcharge}
          muted
        />
      )}
      {platformFeeAmt > 0 && (
        <SummaryRow
          label={`${PLATFORM_FEE.name} (${PLATFORM_FEE.percentage}%)`}
          amountCents={platformFeeAmt}
          muted
        />
      )}
      {surcharge > 0 && (
        <SummaryRow
          label={`${CARD_SURCHARGE.name} (${CARD_SURCHARGE.percentage}%)`}
          amountCents={surcharge}
          muted
        />
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
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.3 },
  stepperBtnText: { color: T.brand, fontSize: 18, fontWeight: '500' },
  stepperCount: { minWidth: 24, textAlign: 'center', fontWeight: '500', color: T.brand, fontSize: 16 },
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
