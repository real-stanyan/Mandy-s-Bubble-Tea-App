import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { apiFetch, ApiError } from '@/lib/api'
import { brisbaneClockLabel } from '@/lib/pickup-schedule'
import { T, RADIUS, PIN, IS_EVENING, SHADOW } from '@/constants/theme'

// App port of the web ScheduledPickupCard: the chosen collection time and
// the early-arrival escape hatch. "I'm here" is one POST that pulls the
// held cup-sticker's due time to now — the store's printer picks it up
// within seconds. Outcomes are honest (the server says what actually
// happened): released → "counter's on it"; already printed / hold lapsed →
// "already being made".

type Phase = 'idle' | 'sending' | 'released' | 'already' | 'failed'

export function ScheduledPickupCard({
  orderId,
  pickupAt,
}: {
  orderId: string
  pickupAt: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const ms = Date.parse(pickupAt)
  if (!Number.isFinite(ms)) return null
  const label = brisbaneClockLabel(new Date(ms))

  async function makeNow() {
    setPhase('sending')
    try {
      const body = await apiFetch<{ ok?: boolean; outcome?: string }>(
        `/api/orders/${orderId}/make-now`,
        { method: 'POST' },
      )
      if (body?.ok) setPhase(body.outcome === 'released' ? 'released' : 'already')
      else setPhase('failed')
    } catch (err) {
      // 403/404 etc. — the honest answer is "ask at the counter".
      setPhase(err instanceof ApiError ? 'failed' : 'failed')
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PICKUP TIME YOU CHOSE</Text>
      <Text style={styles.title}>Ready at the counter around {label}</Text>

      {phase === 'released' ? (
        <Text style={styles.body}>
          The counter&apos;s on it — your drinks are being made now.
        </Text>
      ) : phase === 'already' ? (
        <Text style={styles.body}>
          Your drinks are already being made — see you at the counter!
        </Text>
      ) : (
        <>
          <Text style={styles.body}>
            We&apos;ll start making them a few minutes before, so they&apos;re
            fresh when you arrive. Here early? Tell us and we&apos;ll start now.
          </Text>
          <Pressable
            onPress={() => void makeNow()}
            disabled={phase === 'sending'}
            style={({ pressed }) => [
              styles.cta,
              (pressed || phase === 'sending') && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaText}>
              {phase === 'sending' ? 'Telling the counter…' : "I'm here — make it now"}
            </Text>
          </Pressable>
          {phase === 'failed' ? (
            <Text style={styles.failed}>
              That didn&apos;t reach the store — try again, or just ask at the
              counter.
            </Text>
          ) : null}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    padding: 16,
    marginBottom: 14,
    ...SHADOW.card,
  },
  eyebrow: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: T.brand,
  },
  title: {
    marginTop: 4,
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 16,
    color: T.ink,
  },
  body: {
    marginTop: 6,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink2,
  },
  cta: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: T.brand,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 13.5,
    // Evening brand is light gold; white on it is unreadable — same rule
    // as every brand CTA in the app.
    color: IS_EVENING ? PIN.ink : '#fff',
  },
  failed: {
    marginTop: 8,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 11.5,
    color: T.brand,
  },
})
