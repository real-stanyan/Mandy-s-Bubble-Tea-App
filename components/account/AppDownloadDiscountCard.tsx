import { memo, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { apiFetch } from '@/lib/api'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

// "You have 20% off your first order" — the app-download promo claimed on the
// web by phone. Self-fetches its own status (like IgFollowPromoCard) rather
// than riding /api/me, so it needs no shared-context or backend change. The
// backend resolves the grant by the signed-in user's phone and auto-applies it
// at checkout, so this card is display-only. Hides itself when unavailable or
// already redeemed.

export type AppDownloadStatus = {
  ok: boolean
  available: boolean
  percentage: number
  claimedAt: string | null
  redeemedAt: string | null
}

// Shared fetch hook. A screen that needs to know availability up front (e.g.
// the Promotions screen's "no active promotions" empty state) can call this and
// pass the result to the card as a prop to avoid a second request.
//
// `enabled` guards the request on sign-in state. Checkout can be reached signed
// out, and the endpoint resolves the grant from the caller's phone — so firing
// at mount would 401 and then never retry once the user signs in on that same
// screen. Passing `!!profile` makes the fetch run on the false->true flip.
export function useAppDownloadStatus(enabled = true): AppDownloadStatus | null {
  const [status, setStatus] = useState<AppDownloadStatus | null>(null)
  useEffect(() => {
    if (!enabled) {
      setStatus(null)
      return
    }
    let alive = true
    apiFetch<AppDownloadStatus>('/api/promotions/app-download/status')
      .then((d) => {
        if (alive) setStatus(d)
      })
      .catch(() => {
        if (alive) setStatus(null)
      })
    return () => {
      alive = false
    }
  }, [enabled])
  return status
}

export function appDownloadAvailable(status: AppDownloadStatus | null): boolean {
  return !!status?.available && !status.redeemedAt
}

// Pure/presentational — the parent screen owns the fetch (via
// useAppDownloadStatus) so it can also drive its own empty-state logic without
// a duplicate request. Renders nothing until the grant is available.
export const AppDownloadDiscountCard = memo(function AppDownloadDiscountCard({
  status,
}: {
  status: AppDownloadStatus | null
}) {
  if (!appDownloadAvailable(status)) return null

  return (
    <View style={styles.card}>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotPrimary]} />
        <View style={[styles.dot, styles.dotSecondary]} />
        <View style={[styles.dot, styles.dotTertiary]} />
      </View>
      <Text style={styles.label}>APP DOWNLOAD GIFT</Text>
      <Text style={styles.badge}>{status!.percentage}% OFF</Text>
      <Text style={styles.hint}>Your first order — auto-applied at checkout</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.paper,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    ...SHADOW.card,
  },
  dots: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPrimary: { backgroundColor: T.brand },
  dotSecondary: { backgroundColor: T.peach },
  dotTertiary: { backgroundColor: T.sage },
  label: {
    ...TYPE.eyebrow,
    color: T.ink3,
  },
  badge: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 32,
    letterSpacing: -0.5,
    color: T.brand,
  },
  hint: {
    ...TYPE.body,
    color: T.ink2,
    textAlign: 'center',
  },
})
