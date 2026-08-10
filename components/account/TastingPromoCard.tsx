import { memo, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

// "New drink, $5 to try it" — the tasting promo (web repo ADR 0009).
//
// Self-fetches, like AppDownloadDiscountCard: no /api/me change, no shared
// context. No auth either — the promo is store-wide for its window, there is
// no per-customer grant to look up, so the card renders for a signed-out user
// too (and tapping it lands them on the menu, which is the point).
//
// Display-only. The discount is applied server-side, and ONLY for app
// requests: the same cart priced on the web does not get it.
//
// Read the copy carefully before changing it. The tasting price competes in
// the exclusive better-of lane with welcome / IG / tier / flash / app-download,
// so a customer whose other discount is worth more gets that one instead and
// pays LESS than the tasting price. Promising a bare "$5" would read as a bug
// to exactly those customers — hence "best price", not "always $5".

export type TastingPromoStatus = {
  ok: boolean
  available: boolean
  key: string | null
  productName: string | null
  tastingPriceCents: number
  endsAt: string | null
}

/**
 * Shared fetch hook, so a screen that needs availability for its own empty
 * state (the Promotions screen) can read it once and pass it down as a prop
 * instead of firing a second request.
 */
export function useTastingPromoStatus(): TastingPromoStatus | null {
  const [status, setStatus] = useState<TastingPromoStatus | null>(null)
  useEffect(() => {
    let alive = true
    apiFetch<TastingPromoStatus>('/api/promotions/tasting-promo/status')
      .then((d) => {
        if (alive) setStatus(d)
      })
      .catch(() => {
        if (alive) setStatus(null)
      })
    return () => {
      alive = false
    }
  }, [])
  return status
}

export function tastingPromoAvailable(
  status: TastingPromoStatus | null,
): boolean {
  return !!status?.available && !!status.productName
}

/** Whole days left, rounded up — never "0 days left" while it is still live. */
function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export const TastingPromoCard = memo(function TastingPromoCard({
  status,
}: {
  status: TastingPromoStatus | null
}) {
  if (!tastingPromoAvailable(status)) return null
  const days = daysLeft(status!.endsAt)

  return (
    <Pressable
      onPress={() => router.push('/menu')}
      accessibilityRole="button"
      accessibilityLabel={`${status!.productName}, tasting price ${priceLabel(
        status!.tastingPriceCents,
      )}. Opens the menu.`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotPrimary]} />
        <View style={[styles.dot, styles.dotSecondary]} />
        <View style={[styles.dot, styles.dotTertiary]} />
      </View>
      <Text style={styles.label}>🧋 NEW — TASTING PRICE</Text>
      <Text style={styles.badge}>{priceLabel(status!.tastingPriceCents)}</Text>
      <Text style={styles.product}>{status!.productName}</Text>
      <Text style={styles.hint}>
        App only, one cup per order. We apply your best available discount at
        checkout{days ? ` — ${days} day${days > 1 ? 's' : ''} left` : ''}.
      </Text>
      <Text style={styles.cta}>Tap to order →</Text>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.paper,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.brand,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    ...SHADOW.card,
  },
  cardPressed: { opacity: 0.85 },
  dots: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPrimary: { backgroundColor: T.brand },
  dotSecondary: { backgroundColor: T.sage },
  dotTertiary: { backgroundColor: T.peach },
  label: {
    ...TYPE.eyebrow,
    color: T.brand,
  },
  badge: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 32,
    letterSpacing: -0.5,
    color: T.brand,
  },
  product: {
    ...TYPE.body,
    color: T.ink,
    textAlign: 'center',
  },
  hint: {
    ...TYPE.body,
    color: T.ink2,
    textAlign: 'center',
  },
  cta: {
    ...TYPE.eyebrow,
    color: T.brand,
    marginTop: 2,
  },
})
