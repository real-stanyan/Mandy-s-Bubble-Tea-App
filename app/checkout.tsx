import { GrainGround } from '@/components/ui/GrainOverlay'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '@/store/cart'
import { CheckoutHero } from '@/components/brand/CheckoutHero'
import { extraCups, orderCups } from '@/lib/menu/order-cups'
import { FulfillmentSelector } from '@/components/checkout/FulfillmentSelector'
import { DeliveryAddressForm } from '@/components/checkout/DeliveryAddressForm'
import { DeliveryQuoteCard } from '@/components/checkout/DeliveryQuoteCard'
import { useDeliveryQuote } from '@/hooks/use-delivery-quote'
import { startActivityForPlacedOrder } from '@/lib/live-activity-sync'
import { buildPaymentSelections } from '@/lib/doodle/build-payment-selections'
import { deliveryFeesPending, feeValueText } from '@/lib/delivery'
import { useCreateOrder } from '@/hooks/use-create-order'
import { availablePickupOffsets, pickupClockLabel } from '@/lib/pickup-schedule'
import {
  useOrderQuote,
  quoteCents,
  type OrderQuote,
  type QuoteAmount,
} from '@/hooks/use-order-quote'
import { nothingToPay } from '@/lib/order-quote'
import { checkoutCta } from '@/lib/checkout-cta'
import { buildOrderLines } from '@/lib/order-lines'
import { usePayment } from '@/hooks/use-payment'
import { useOrderAcceptance } from '@/hooks/use-order-acceptance'
import { useStoreStatus } from '@/hooks/use-store-status'
import { useKitchenLoad } from '@/hooks/use-kitchen-load'
import { KITCHEN_LOAD_FALLBACK, kitchenMoodLabel, type KitchenLoad } from '@/lib/kitchen-load'
import { canAcceptOrders } from '@/components/home/helpers'
import { useAuth } from '@/components/auth/AuthProvider'
import { PaymentErrorDialog } from '@/components/ui/PaymentErrorDialog'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { PickupReminderDialog } from '@/components/checkout/PickupReminderDialog'
import { SignInCard } from '@/components/auth/SignInCard'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { CardBlock } from '@/components/checkout/CardBlock'
import { OrderPlaced } from '@/components/checkout/OrderPlaced'
import {
  GooglePayButton,
  googlePayButtonAvailable,
} from '@/modules/google-pay-button'
import { hashColor } from '@/components/brand/color'
import { T, FONT, RADIUS, SHADOW, PIN, CTA, TYPE } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import { isPublicHolidayActive } from '@/lib/holiday'
import { formatPrice } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import {
  initSquarePayments,
  isSandboxPayments,
  canUseApplePay,
  canUseGooglePay,
  startCardPayment,
  startApplePayPayment,
  startGooglePayPayment,
  PAYMENT_SHEET_TIMEOUT,
} from '@/lib/square-payment'
import { reportPaymentStep } from '@/lib/client-log'
import { clearOrderNonce } from '@/lib/order-nonce'
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
  // One drawn cup per unit in the order, from the same mapper as the item sheet.
  const heroCups = useMemo(() => orderCups(items), [items])
  const heroExtra = useMemo(() => extraCups(items), [items])
  const labelSelections = useCartStore((s) => s.labelSelections)
  const setLabel = useCartStore((s) => s.setLabel)
  const clearLabel = useCartStore((s) => s.clearLabel)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)
  const fulfillmentType = useCartStore((s) => s.fulfillmentType)
  const setFulfillmentType = useCartStore((s) => s.setFulfillmentType)
  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress)
  const quote = useDeliveryQuote({
    fulfillment: fulfillmentType,
    address: deliveryAddress,
    drinksSubtotalCents: total,
  })

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
  // Scheduled pickup: minutes until collection, 0 = ASAP. Pickup-only.
  const [pickupOffset, setPickupOffset] = useState(0)
  // Live "ready in" estimate — one poll, shared by the Pickup card and the
  // ASAP pill so they never disagree.
  const kitchen = useKitchenLoad()
  const [error, setError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  // Non-alarming inline notice (e.g. user closed the payment sheet). Kept
  // separate from paymentError so it doesn't render in the red error style.
  const [payNotice, setPayNotice] = useState<string | null>(null)
  // Square SDK failed to initialize — Pay would silently no-op, so disable
  // the button and tell the user instead of console.warn-ing into the void.
  const [squareInitFailed, setSquareInitFailed] = useState(false)

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

  const slots = useMemo(
    () => cartToSlots(items, labelSelections),
    [items, labelSelections],
  )

  const handleSlotChange = (_slotIdx: number, next: DoodleSlot) => {
    if (next.selection) setLabel(next.cupKey, next.selection)
    else clearLabel(next.cupKey)
  }

  const allLabeled = useMemo(() => {
    return slots.every((slot) => {
      const s = slot.selection
      // null = surprise random design (optional, always fine to pay).
      if (s === null) return true
      if (s.kind === 'ai' && s.aiDoodleId === null) return false
      // draw with userDoodleId === null is fine — handlePay uploads paths
      // before submitting payment. Blocking here is a chicken-and-egg:
      // user can never click Pay to trigger the upload.
      if (s.kind === 'draw' && s.paths.length === 0) return false
      return true
    })
  }, [slots])

  // Live balance on entry: the redeem stepper must be clamped by what the
  // server will actually honor, not by a home-tab snapshot. 2026-08-28: a
  // customer's cached balance said 24 while 18 stars sat held on an
  // abandoned order — the stepper offered 2 rewards, the server said
  // "Not enough stars", and they retried into a wall for three minutes.
  useFocusEffect(
    useCallback(() => {
      refreshAuth()
    }, [refreshAuth]),
  )

  const loyaltyBalance = loyalty?.balance ?? 0
  const perReward = starsPerReward || LOYALTY.starsForReward
  const canRedeem = perReward > 0 && loyaltyBalance >= perReward
  const welcomeAvailable = welcomeDiscount.available

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
      setSquareInitFailed(true)
    }
  }, [profile])

  // The exact body `/api/orders` will receive, minus the free-text note — the
  // note changes on every keystroke and never moves the price. Both the quote
  // below and the create call in handlePay are built from the same cart, so
  // what the customer reads is priced from the request that gets charged.
  const quoteBody = useMemo(
    () => ({
      lines: buildOrderLines(items),
      applyWelcomeDiscount: welcomeAvailable,
      applyIgFollowDiscount: igFollowDiscount.available,
      applyLoyaltyReward: rewardCount > 0,
      loyaltyRewardCount: rewardCount,
      fulfillmentType,
      ...(fulfillmentType === 'DELIVERY' &&
      deliveryAddress.address &&
      deliveryAddress.lat &&
      deliveryAddress.lng
        ? {
            delivery: {
              address: deliveryAddress.address,
              lat: deliveryAddress.lat,
              lng: deliveryAddress.lng,
              unit: deliveryAddress.unit || undefined,
              driverNote: deliveryAddress.driverNote || undefined,
              postcode: deliveryAddress.postcode || undefined,
            },
          }
        : {}),
    }),
    [
      items,
      welcomeAvailable,
      igFollowDiscount.available,
      rewardCount,
      fulfillmentType,
      deliveryAddress,
    ],
  )

  const phActive = isPublicHolidayActive()

  // Server-priced summary — every discount, every surcharge, the total.
  //
  // This screen used to decide all of it locally: which promos apply, how many
  // cups each covers, which one wins the exclusive better-of, and what the
  // percentage surcharges come to. That copy of the rules could only lag the
  // server's, and did (#40). Now the server decides and this screen renders.
  // Signed out there is nothing to price — every promo resolves off the
  // session, and the endpoint 401s. The screen shows the cart subtotal.
  const {
    quote: orderQuote,
    blocked: quoteBlocked,
    stale: quoteStale,
    quoteFresh,
  } = useOrderQuote(quoteBody, items.length > 0 && !!profile, phActive)

  // The server refused to price this cart because it holds an item the catalog
  // no longer has. /api/orders will refuse to create it for the same reason, so
  // showing a total and an enabled pay button would only send the customer into
  // a failure they can't diagnose (#94).
  const cartHasRetiredItems = quoteBlocked !== null

  // No quote yet (first paint, or offline): show the bare cart subtotal rather
  // than inventing a total. Too high, never too low.
  const displayedTotal = orderQuote ? quoteCents(orderQuote.netTotalCents) : total

  // Whether a card gets charged at all, straight off the server-priced net
  // total — and only when the quote in hand was priced for this cart. A
  // swallowed re-quote failure clears `quoteStale` while leaving the previous
  // cart's quote up, which is exactly when this must not answer.
  const payNothing = nothingToPay(orderQuote, rewardCount, quoteFresh)

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
    if (cartHasRetiredItems) return
    // The quote on hand was priced for a previous cart, so the bar is
    // describing the wrong order. The button is already disabled for this;
    // this is the stale-render backstop, same shape as the guards above.
    if (quoteStale) return

    setProcessing(true)
    setError(null)
    setPaymentError(null)
    setPayNotice(null)

    // Ask for both; the server verifies each against Supabase and silently
    // ignores one the customer doesn't hold. Same flags the quote was priced
    // with, so the created order can't come back cheaper or dearer than shown.
    const useWelcome = welcomeAvailable
    const useIgFollow = igFollowDiscount.available

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
        fulfillmentType,
        pickupOffsetMinutes:
          fulfillmentType === 'PICKUP' && pickupOffset > 0 ? pickupOffset : undefined,
        delivery:
          fulfillmentType === 'DELIVERY'
            ? {
                address: deliveryAddress.address,
                lat: deliveryAddress.lat,
                lng: deliveryAddress.lng,
                unit: deliveryAddress.unit || undefined,
                driverNote: deliveryAddress.driverNote || undefined,
                postcode: deliveryAddress.postcode || undefined,
              }
            : undefined,
      })
      reportPaymentStep({ step: 'create-order', orderId, payMethod })

      // What Square will capture, from the order Square just priced. Every
      // discount the server attached is already in it — there is nothing left
      // to mirror, and mirroring is what made the pay sheet disagree with the
      // charge in the first place (#40).
      let amountCents = Number(createdOrder?.totalMoney?.amount ?? total)
      if (!Number.isFinite(amountCents) || amountCents < 0) amountCents = total

      if (rewardCount > 0) {
        let redeemRes: { ok: boolean; updatedAmountCents?: string; error?: string }
        try {
          redeemRes = await apiFetch<{
            ok: boolean
            updatedAmountCents?: string
            error?: string
          }>('/api/loyalty/redeem', {
            method: 'POST',
            body: JSON.stringify({ orderId, count: rewardCount }),
          })
        } catch (redeemErr) {
          reportPaymentStep({
            step: 'redeem-fail',
            orderId,
            payMethod,
            message: redeemErr instanceof Error ? redeemErr.message : String(redeemErr),
          })
          // Re-hydrate loyalty so the stepper re-clamps to the balance the
          // server just judged by — retrying against a stale number is how
          // the 2026-08-28 customer got stuck. Fire-and-forget: the error
          // itself must surface regardless.
          refreshAuth()
          throw redeemErr
        }
        if (!redeemRes.ok) {
          reportPaymentStep({
            step: 'redeem-fail',
            orderId,
            payMethod,
            message: redeemRes.error ?? 'Could not redeem reward',
          })
          refreshAuth()
          throw new Error(redeemRes.error ?? 'Could not redeem reward')
        }
        if (typeof redeemRes.updatedAmountCents === 'string') {
          amountCents = Number(redeemRes.updatedAmountCents)
        }
      }

      const isFreeOrder = amountCents <= 0

      // Upload any draw doodles whose paths haven't been persisted yet.
      // Run all uploads in parallel; abort the whole pay flow if any fails.
      // Deliberately BEFORE tokenize: a payment nonce is single-use, so a
      // failed upload after tokenize would burn the nonce and force the
      // user through the payment sheet again.
      const drawUploads = slots
        .filter((slot) => slot.selection?.kind === 'draw' && slot.selection.userDoodleId === null && slot.selection.paths.length > 0)
      if (drawUploads.length > 0) {
        await Promise.all(
          drawUploads.map(async (slot) => {
            const s = slot.selection as Extract<typeof slot.selection, { kind: 'draw' }>
            const { doodleId } = await uploadDoodle(s.paths)
            setLabel(slot.cupKey, { ...s, userDoodleId: doodleId })
          }),
        )
      }

      let nonce: string | undefined
      if (!isFreeOrder) {
        const priceDollars = (amountCents / 100).toFixed(2)
        reportPaymentStep({ step: 'tokenize-start', orderId, payMethod })
        // If the sheet hasn't settled within 25s, beacon it — that's the
        // exact signature of the "promise never settles" bug (dropped
        // native rejection / nil rootViewController no-op) this flow was
        // hardened against. Cleared as soon as tokenize settles.
        const pendingTimer = setTimeout(() => {
          reportPaymentStep({ step: 'tokenize-pending', orderId, payMethod })
        }, 25_000)
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
            // User closed the sheet. Not an error — keep the created order
            // (the idempotency key reuses it on the next Pay) and show a
            // calm inline notice instead of the red error dialog.
            reportPaymentStep({ step: 'tokenize-cancel', orderId, payMethod })
            setPayNotice(
              "Payment not completed — nothing was charged. Tap Pay when you're ready.",
            )
            setProcessing(false)
            return
          }
          reportPaymentStep({
            step: msg === PAYMENT_SHEET_TIMEOUT ? 'tokenize-timeout' : 'tokenize-fail',
            orderId,
            payMethod,
            message: msg,
          })
          throw sdkErr
        } finally {
          clearTimeout(pendingTimer)
        }
      }

      const selectionMaps = buildPaymentSelections(useCartStore.getState().labelSelections)
      let result: Awaited<ReturnType<typeof pay>>
      try {
        result = await pay({
          sourceId: nonce,
          orderId,
          ...selectionMaps,
        })
      } catch (payErr) {
        reportPaymentStep({
          step: 'pay-fail',
          orderId,
          payMethod,
          message: payErr instanceof Error ? payErr.message : String(payErr),
        })
        throw payErr
      }

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

      // Lock-screen Live Activity (iOS 16.2+). Fire-and-forget: checkout
      // success must never block or fail on the lock-screen card. Uses the
      // render-scope deliveryAddress captured BEFORE clearCart resets it.
      startActivityForPlacedOrder({
        orderId,
        referenceId: createdOrder.referenceId ?? null,
        fulfillmentType,
        destLat: deliveryAddress.lat,
        destLng: deliveryAddress.lng,
        // Cartoon cup(s) on the lock-screen card: distinct drinks stack
        // (max 3); a single-drink order carries its cup count for the ×N badge.
        drinkName: items[0]?.name ?? null,
        ...(() => {
          const distinct: string[] = []
          for (const it of items) if (!distinct.includes(it.name)) distinct.push(it.name)
          return {
            drinkNames: distinct.slice(0, 3),
            drinkQuantity:
              distinct.length === 1 ? items.reduce((s, i) => s + i.quantity, 0) : null,
          }
        })(),
      }).catch(() => {})

      clearCart()
      // Payment succeeded — rotate the per-checkout idempotency nonce so
      // the NEXT order gets a fresh identity. Only cleared on success:
      // failures/cancels keep the nonce so a retry reuses the same order.
      clearOrderNonce().catch(() => {})
      // Re-hydrate profile/loyalty/welcomeDiscount so the success overlay
      // and home tab show the updated stars + consumed welcome.
      refreshAuth()
      setPlaced({ pickupNumber: pickupRef, totalCents, starsEarned })
    } catch (e) {
      const raw =
        e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      const message =
        raw === PAYMENT_SHEET_TIMEOUT
          ? "Payment screen didn't respond — nothing was charged. Please try again."
          : raw
      setPaymentError(message)
    } finally {
      setProcessing(false)
    }
  }

  const isLoading = orderLoading || payLoading || processing
  const acceptance = useOrderAcceptance()
  const deliveryReady = fulfillmentType !== 'DELIVERY' || quote.kind === 'ok'
  const payDisabled =
    isLoading ||
    !acceptance.accepting ||
    !allLabeled ||
    // Mid-reprice: the total on screen and "is anything owed" both belong to
    // the previous cart. Costs a re-tap; the alternative is paying against a
    // number the customer wasn't shown.
    quoteStale ||
    !deliveryReady ||
    squareInitFailed ||
    cartHasRetiredItems

  const cta = checkoutCta({
    accepting: acceptance.accepting,
    nextOpenLabel: acceptance.nextOpenLabel,
    busy: isLoading,
    quoteStale,
    nothingToPay: payNothing,
    payMethodLabel: payLabel(payMethod),
  })

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
        <GrainGround />
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
      <GrainGround />
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
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          // The Google Pay bar is taller (summary line + button) than the pill.
          paddingBottom: payMethod === 'google' && googlePayButtonAvailable ? 180 : 130,
        }}
      >
        <InlineHeader onBack={handleBack} total={displayedTotal} />
        {quoteBlocked && (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={`${quoteBlocked.message} Go back to your cart.`}
            style={styles.staleCartCard}
          >
            <Text style={styles.staleCartTitle}>{quoteBlocked.message}</Text>
            <Text style={styles.staleCartAction}>
              Remove them and add them again — tap here to go back.
            </Text>
          </Pressable>
        )}
        {/* What happens next, with this order in it: the cups on the counter, or
            going into the bag at the door (components/brand/CheckoutHero). */}
        <CheckoutHero
          kind={fulfillmentType === 'PICKUP' ? 'pickup' : 'delivery'}
          cups={heroCups}
          extra={heroExtra}
          style={styles.fulfillmentHero}
        />
        <FulfillmentSelector
          value={fulfillmentType}
          onChange={setFulfillmentType}
          drinksSubtotalCents={total}
          pickupEtaLabel={kitchen?.label}
        />
        {fulfillmentType === 'PICKUP' ? (
          <>
            <StoreBlock />
            <PickupTimeBlock value={pickupOffset} onChange={setPickupOffset} kitchen={kitchen} />
          </>
        ) : (
          <>
            <DeliveryAddressForm
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              defaultPhone={profile?.phone_e164}
            />
            <DeliveryQuoteCard quote={quote} />
          </>
        )}
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
          promos={orderQuote?.discounts ?? []}
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
          quote={orderQuote}
          rewardCount={rewardCount}
          delivery={
            fulfillmentType === 'DELIVERY'
              ? {
                  pending: deliveryFeesPending(fulfillmentType, quote.kind),
                }
              : null
          }
        />
        {(error || orderError || payError) && (
          <Text style={styles.errorText}>{error || orderError || payError}</Text>
        )}
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {squareInitFailed && (
          <View style={styles.noticeBar}>
            <Text style={styles.noticeText}>
              Payments couldn&apos;t start on this device. Please close and
              reopen the app, then try again.
            </Text>
          </View>
        )}
        {!squareInitFailed && payNotice && (
          <View style={styles.noticeBar}>
            <Text style={styles.noticeText}>{payNotice}</Text>
          </View>
        )}
        {/* Google Pay is paid for with GOOGLE'S button, not one of ours.
            Drawing our own brand-brown "Pay with Google Pay" pill is what the
            Google Pay API review team rejected this integration for
            (2026-09-04); PayButton renders the mark, height, contrast and
            clear space to their spec. The total and any gate reason move to a
            line above it, because Google's button carries no copy of ours.

            googlePayButtonAvailable is false on binaries built before the
            native module existed — an OTA to one of those keeps the old CTA
            rather than rendering nothing. */}
        {payMethod === 'google' && googlePayButtonAvailable && !payNothing ? (
          // The pill variant floats over the page; this one carries copy, so it
          // sits on an opaque strip of page colour — the totals card scrolled
          // straight through the summary line otherwise (emulator, 2026-09-04).
          <View style={styles.gpayBar}>
            <View style={styles.gpaySummary}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.gpayEyebrow}>{cta.eyebrow}</Text>
                <Text style={styles.gpayTitle} numberOfLines={1}>
                  {cta.title}
                </Text>
              </View>
              {cta.showSpinner ? (
                <ActivityIndicator color={T.brand} />
              ) : (
                <Text style={styles.gpayAmount}>{formatPrice(displayedTotal)}</Text>
              )}
            </View>
            <GooglePayButton
              theme="dark"
              type="pay"
              cornerRadius={26}
              enabled={!payDisabled}
              onPress={handlePay}
              style={styles.gpayButton}
            />
          </View>
        ) : (
          <Pressable
            onPress={handlePay}
            disabled={payDisabled}
            style={[styles.placeBtn, payDisabled && { opacity: 0.5 }, ctaShadow]}
          >
            <View style={{ flex: 1, paddingLeft: 18 }}>
              <Text style={styles.placeEyebrow}>{cta.eyebrow}</Text>
              <Text style={styles.placeTitle}>{cta.title}</Text>
            </View>
            <View style={styles.placeAmount}>
              {cta.showSpinner ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.placeAmountText}>{formatPrice(displayedTotal)}</Text>
              )}
            </View>
          </Pressable>
        )}
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
  const status = useStoreStatus()
  return (
    <CardBlock eyebrow="Pickup store" title="Mandy’s — Southport">
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
        <Text style={{ fontFamily: FONT.sans, fontSize: 12.5, color: T.ink2, lineHeight: 18 }}>
          34 Davenport St · Southport QLD 4215
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {status.open ? (
            <>
              <View style={styles.openPill}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>Open now</Text>
              </View>
              <View style={styles.waitPill}>
                <Icon name="clock" size={11} color={T.ink2} />
                <Text style={styles.waitText}>~6 min</Text>
              </View>
            </>
          ) : (
            <View style={styles.closedPill}>
              <View style={styles.closedDot} />
              <Text style={styles.closedText}>Closed · Opens {status.nextLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </CardBlock>
  )
}

// "What time will you collect your drinks?" — the App port of the web
// pills (web PR #280/#281 wording): lead with the ~clock time, keep the
// countdown as the sub-line, and never promise the minute. The server
// re-validates the offset, so an expired pill 409s rather than lies.
function PickupTimeBlock({
  value,
  onChange,
  kitchen,
}: {
  value: number
  onChange: (next: number) => void
  /** Live kitchen load; undefined before the first poll, null when the
   *  server could not measure it — both show the middle bracket. */
  kitchen?: KitchenLoad | null
}) {
  // "~10 min" was a constant. The estimate now follows the cups on the
  // bench (Stan, 2026-09-04): quiet 2–3, medium 5–7, busy 7–10.
  const load = kitchen ?? KITCHEN_LOAD_FALLBACK
  const status = useStoreStatus()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  const offsets = status.open ? availablePickupOffsets(now) : []

  // A picked pill that has since expired must not ride into the order.
  useEffect(() => {
    if (value !== 0 && !offsets.includes(value)) onChange(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  if (!status.open) {
    return <CardBlock eyebrow="Pickup time" title={`Opens ${status.nextLabel}`} />
  }

  return (
    <CardBlock eyebrow="Pickup time" title="What time will you collect?">
      <View style={pickupStyles.row}>
        <Pressable
          onPress={() => onChange(0)}
          style={[pickupStyles.pill, value === 0 && pickupStyles.pillActive]}
        >
          <Text style={[pickupStyles.pillLabel, value === 0 && pickupStyles.pillLabelActive]}>
            ASAP
          </Text>
          <Text style={pickupStyles.pillSub}>ready in {load.label}</Text>
        </Pressable>
        {offsets.map((offset) => {
          const active = value === offset
          return (
            <Pressable
              key={offset}
              onPress={() => onChange(offset)}
              style={[pickupStyles.pill, active && pickupStyles.pillActive]}
            >
              <Text style={[pickupStyles.pillLabel, active && pickupStyles.pillLabelActive]}>
                ~{pickupClockLabel(offset, now)}
              </Text>
              <Text style={pickupStyles.pillSub}>in {offset} min</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={pickupStyles.hint}>
        {value === 0
          ? `We'll start making your drinks right away — at the counter in about ${load.label}.${kitchen ? ` We're ${kitchenMoodLabel(kitchen.level)}.` : ''}`
          : `Ready around ${pickupClockLabel(value, now)} — we'll start a few minutes before, so they're fresh when you arrive. Here early? Tap "I'm here" on your order page.`}
      </Text>
    </CardBlock>
  )
}

const pickupStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  pill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: {
    borderWidth: 2,
    borderColor: T.brand,
    backgroundColor: T.cream,
  },
  pillLabel: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 13.5,
    color: T.ink2,
  },
  pillLabelActive: { color: T.brand },
  pillSub: {
    marginTop: 1,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 10.5,
    color: T.ink3,
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: T.ink3,
  },
})

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
                <SquareImage
                  url={it.imageUrl}
                  width={IMG_THUMB}
                  style={StyleSheet.absoluteFill}
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
  promos,
}: {
  stars: number
  goal: number
  canRedeem: boolean
  rewardCount: number
  maxRewardCount: number
  onIncrement: () => void
  onDecrement: () => void
  /** Discounts the server actually attached, with its own labels. */
  promos: QuoteAmount[]
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
        {/* One hint per discount the server attached — its label already
            says which promo and how many drinks it covers. This used to
            hard-code Welcome and IG Follow, so a newer promo silently had
            no hint at all. */}
        {promos.map((p) => (
          <Text key={p.uid} style={styles.welcomeHint}>
            {p.name} — saves {formatPrice(quoteCents(p.amountCents))}
          </Text>
        ))}
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
        {isSandboxPayments() && (
          <View style={styles.sandboxBar}>
            <Text style={styles.sandboxTitle}>🧪 SANDBOX 测试支付环境</Text>
            <Text style={styles.sandboxText}>
              当前连接 Square 沙盒，不会产生真实扣款。请勿使用真实银行卡——用测试卡
              4111 1111 1111 1111（任意未来有效期 / 任意 CVV 和邮编）。
            </Text>
          </View>
        )}
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

// The money block, rendered straight from the server's quote.
//
// Every discount and fee row — including its LABEL — comes out of
// /api/orders/quote, because only the server knows how many cups a promo
// covered and which promo won the exclusive better-of. Nothing is decided
// here; a promo added server-side shows up with no app release (#40).
function SummaryBlock({
  subtotal,
  quote,
  rewardCount: rewardCountForSummary,
  delivery,
}: {
  /** Local cart subtotal — shown only until the first quote lands. */
  subtotal: number
  quote: OrderQuote | null
  rewardCount: number
  /** Delivery chosen but the address quote hasn't resolved yet. */
  delivery?: { pending: boolean } | null
}) {
  const rewardCents = quoteCents(quote?.rewardCupsSumCents)
  const deliveryFee = quote?.serviceCharges.find((sc) => sc.uid === 'delivery-fee')
  const serviceFee = quote?.serviceCharges.find((sc) => sc.uid === 'service-fee')
  const otherCharges = (quote?.serviceCharges ?? []).filter(
    (sc) => sc.uid !== 'delivery-fee' && sc.uid !== 'service-fee',
  )
  const total = quote ? quoteCents(quote.netTotalCents) : subtotal

  return (
    <View style={styles.summaryCard}>
      <SummaryRow
        label="Subtotal"
        amountCents={quote ? quoteCents(quote.subtotalCents) : subtotal}
        muted
      />
      {(quote?.discounts ?? []).map((d) => (
        <SummaryRow
          key={d.uid}
          label={d.name}
          amountCents={-quoteCents(d.amountCents)}
          muted
        />
      ))}
      {rewardCountForSummary > 0 && (
        <SummaryRow
          label={`Reward discount${rewardCountForSummary > 1 ? ` ×${rewardCountForSummary}` : ''}`}
          amountCents={-rewardCents}
          muted
        />
      )}
      {otherCharges.map((sc) => (
        <SummaryRow
          key={sc.uid}
          label={sc.name}
          amountCents={quoteCents(sc.amountCents)}
          muted
        />
      ))}
      {delivery && (
        <>
          {/* A zero delivery fee is attached as no charge at all, so "no row"
              means free — but only once a quote exists. Before that it's
              unknown, and printing FREE would be a promise we can't keep. */}
          <SummaryTextRow
            label="Delivery Fee"
            value={feeValueText(
              delivery.pending || !quote,
              quoteCents(deliveryFee?.amountCents),
            )}
          />
          <SummaryTextRow
            label={serviceFee?.name ?? 'Service Fee (5%)'}
            value={feeValueText(
              delivery.pending || !quote,
              quoteCents(serviceFee?.amountCents),
            )}
          />
        </>
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

function SummaryTextRow({ label, value }: { label: string; value: string }) {
  const isFree = value === 'FREE'
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, styles.summaryLabelMuted]}>{label}</Text>
      <Text style={[styles.summaryValue, styles.summaryValueMuted, isFree && { color: '#3F7A3F' }]}>
        {value}
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
  closedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: T.bg2,
  },
  closedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.ink4,
  },
  closedText: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: T.ink3,
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
  fulfillmentHero: {
    width: '100%',
    marginTop: 4,
    marginBottom: 12,
    aspectRatio: 1.85,
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
  sandboxBar: {
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF6DE',
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#C9A227',
  },
  sandboxTitle: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#8A6E14',
    marginBottom: 4,
  },
  sandboxText: {
    fontFamily: FONT.sans,
    fontSize: 12,
    lineHeight: 17,
    color: '#8A6E14',
  },
  noticeBar: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: T.card,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: T.line,
  },
  noticeText: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    lineHeight: 17,
    color: T.ink2,
    textAlign: 'center',
  },
  staleCartCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.small,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  staleCartTitle: {
    fontFamily: FONT.sans,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '700',
    color: '#b91c1c',
  },
  staleCartAction: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
    color: '#b91c1c',
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
  // A solid panel, not a floating bar: the pay control and its total/gate
  // line sit on their own paper surface with a top edge, so the order
  // summary scrolls UNDER it instead of through it (Stan, 2026-09-04: 给
  // 下方 PAY 专门做一个底框，不用悬浮无背景显示).
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: T.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  // CTA, not PIN.chip. Pinning the dark ink fixed the label but cost the
  // button its surface: #2A1E14 on the evening page is 1.16:1, so the pay bar
  // read as loose text on the background with only the amount visible
  // (Stan's screenshot, 2026-08-13). Brand holds an edge in both themes.
  placeBtn: {
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: CTA.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  // Total + gate reason, above Google's button. It sits on the bar's own
  // background so the button keeps clear space on all four sides, and the
  // 10pt gap below is that clear space on top.
  gpayBar: {},
  gpaySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  gpayEyebrow: {
    fontFamily: FONT.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: T.ink3,
    textTransform: 'uppercase',
  },
  gpayTitle: {
    fontFamily: FONT.sans,
    fontSize: 15,
    fontWeight: '700',
    color: T.ink,
    marginTop: 2,
  },
  gpayAmount: {
    ...TYPE.priceMd,
    color: T.ink,
  },
  // 52dp: comfortably over Google's 40dp minimum and the same visual weight
  // as the CTA it replaces. Height and corner radius are the only geometry
  // we set; everything inside is Google's.
  gpayButton: {
    height: 52,
    width: '100%',
  },
  placeEyebrow: {
    fontFamily: FONT.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: CTA.on,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  placeTitle: {
    marginTop: 2,
    fontFamily: FONT.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: CTA.on,
    lineHeight: 22,
  },
  // Inverted against the bar it sits on: the bar is CTA.bg, so the amount
  // takes CTA.on as its surface and CTA.bg as its ink. That inverts with the
  // theme for free — a white chip with brown figures by day, a dark chip with
  // gold figures at night — where a fixed brand fill would have dissolved
  // into the brand-coloured bar the moment the bar stopped being dark.
  placeAmount: {
    minWidth: 110,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: CTA.on,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  placeAmountText: {
    fontFamily: FONT.mono,
    fontSize: 16,
    fontWeight: '700',
    color: CTA.bg,
  },
})
