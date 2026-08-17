import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { T, TYPE, RADIUS, SHADOW, PIN, IS_EVENING } from '@/constants/theme'

// Mystery-box coupons on the Promotions screen — the "where did my prize
// go" answer after opening a box in the chat (Stan's screenshot,
// 2026-08-17: coupon existed, nothing showed it, no path to use it).
// Labels + expiry from /api/me/mystery-coupons; ids stay server-side
// because checkout picks and burns the coupon itself. The CTA is the
// usage path: order — the best coupon applies at checkout on its own.

type Coupon = { label: string; expiresAt: string }

export function useMysteryCoupons(): Coupon[] {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  useEffect(() => {
    let cancelled = false
    apiFetch<{ coupons?: Coupon[] }>('/api/me/mystery-coupons')
      .then((body) => {
        if (!cancelled && body?.coupons) setCoupons(body.coupons)
      })
      .catch(() => {
        /* signed out or offline — the section just stays absent */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return coupons
}

export function MysteryCouponCards({ coupons }: { coupons: Coupon[] }) {
  if (coupons.length === 0) return null
  return (
    <>
      {coupons.map((c) => {
        const until = new Date(c.expiresAt).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Australia/Brisbane',
        })
        return (
          <View key={`${c.label}-${c.expiresAt}`} style={styles.card}>
            <Text style={styles.badge}>🎁 MYSTERY BOX PRIZE</Text>
            <Text style={styles.title}>{c.label}</Text>
            <Text style={styles.hint}>
              Auto-applied at checkout · valid until {until}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/menu')}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>Use it — order now →</Text>
            </Pressable>
          </View>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    ...SHADOW.card,
  },
  badge: {
    ...TYPE.eyebrow,
    fontSize: 12,
    letterSpacing: 1,
    color: T.brand,
  },
  title: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
    color: T.ink,
  },
  hint: {
    ...TYPE.body,
    color: T.ink3,
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: T.brand,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 13.5,
    // Evening brand is light gold; white on it is unreadable — same call
    // as the chat PromotionCard's CTA.
    color: IS_EVENING ? PIN.ink : '#fff',
  },
})
