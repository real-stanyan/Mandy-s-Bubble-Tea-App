import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { T, RADIUS, PIN } from '@/constants/theme'
import { apiFetch, ApiError } from '@/lib/api'
import { chatUiStrings } from '@/lib/chat/ui-strings'

// RN port of web's MysteryBoxCard — same contract: the card is a CLOSED
// box, the tap is the draw (server-side odds), the prize lands in Rewards.
// Shake invites the tap (reanimated rotate loop), the reveal pops in on a
// spring, confetti rains six emoji.

type Phase = 'closed' | 'opening' | 'won' | 'already' | 'signin' | 'error'

type OpenResponse = {
  ok?: boolean
  label?: string
  expiresAt?: string
  reason?: string
  signIn?: boolean
}

const CONFETTI = ['🎉', '✨', '🧋', '⭐', '🎊', '✨']

function ShakingBox() {
  const rot = useSharedValue(0)
  useEffect(() => {
    rot.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(5, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(-4, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(3, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800 }),
      ),
      -1,
    )
  }, [rot])
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }))
  return <Animated.Text style={[styles.boxEmoji, style]}>🎁</Animated.Text>
}

function PopIn({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(0.3)
  const opacity = useSharedValue(0)
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 160 })
    opacity.value = withTiming(1, { duration: 180 })
  }, [scale, opacity])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  return <Animated.View style={style}>{children}</Animated.View>
}

function ConfettiPiece({ char, index }: { char: string; index: number }) {
  const y = useSharedValue(-4)
  const opacity = useSharedValue(1)
  useEffect(() => {
    y.value = withDelay(index * 90, withTiming(64, { duration: 1100, easing: Easing.in(Easing.quad) }))
    opacity.value = withDelay(index * 90, withTiming(0, { duration: 1100 }))
  }, [y, opacity, index])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }))
  return <Animated.Text style={[styles.confetti, style]}>{char}</Animated.Text>
}

export function MysteryBoxCard({ code }: { code: string }) {
  const t = chatUiStrings()
  const [phase, setPhase] = useState<Phase>('closed')
  const [prize, setPrize] = useState<{ label: string; expiresAt: string } | null>(null)

  async function open() {
    if (phase !== 'closed' && phase !== 'error') return
    setPhase('opening')
    const suspense = new Promise((r) => setTimeout(r, 700))
    try {
      const body = await apiFetch<OpenResponse>('/api/chat/mystery-box/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      await suspense
      if (body?.ok && body.label && body.expiresAt) {
        setPrize({ label: body.label, expiresAt: body.expiresAt })
        setPhase('won')
      } else if (body?.reason === 'already-used' || body?.reason === 'invalid-code') {
        // invalid-code = the code was retired between offer and tap — same
        // customer answer: watch the Instagram for the next one.
        setPhase('already')
      } else {
        setPhase('error')
      }
    } catch (err) {
      await suspense
      if (err instanceof ApiError && err.status === 401) setPhase('signin')
      else setPhase('error')
    }
  }

  const expiresLabel = prize
    ? new Date(prize.expiresAt).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Australia/Brisbane',
      })
    : ''

  return (
    <View style={styles.card}>
      {phase === 'won' ? (
        <>
          <View pointerEvents="none" style={styles.confettiRow}>
            {CONFETTI.map((c, i) => (
              <ConfettiPiece key={i} char={c} index={i} />
            ))}
          </View>
          <PopIn>
            <Text style={styles.boxEmojiSmall}>🎁</Text>
            <Text style={styles.prizeLabel}>{prize?.label}</Text>
            <Text style={styles.detail}>
              {t.mysteryInRewards} · {t.mysteryExpires(expiresLabel)}
            </Text>
          </PopIn>
        </>
      ) : phase === 'already' ? (
        <PopIn>
          <Text style={styles.boxEmojiSmall}>📦</Text>
          <Text style={styles.stateText}>{t.mysteryAlready}</Text>
        </PopIn>
      ) : phase === 'signin' ? (
        <View>
          <Text style={styles.boxEmojiSmall}>🎁</Text>
          <Text style={styles.stateText}>{t.mysterySignIn}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => void open()}
          disabled={phase === 'opening'}
          accessibilityLabel={t.mysteryTapAria}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <ShakingBox />
          <Text style={styles.stateText}>
            {phase === 'opening'
              ? t.mysteryOpening
              : phase === 'error'
                ? t.mysteryError
                : t.mysteryTap}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.cream,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confettiRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  confetti: { fontSize: 15 },
  boxEmoji: { fontSize: 44, textAlign: 'center' },
  boxEmojiSmall: { fontSize: 30, textAlign: 'center' },
  prizeLabel: {
    marginTop: 8,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: PIN.ink,
    textAlign: 'center',
  },
  detail: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: PIN.ink2,
    textAlign: 'center',
  },
  stateText: {
    marginTop: 8,
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    color: PIN.ink,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
})
