import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SPACING } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import type { LoyaltyAccount } from '@/types/square'

interface Props {
  account: LoyaltyAccount
  starsPerReward?: number
}

export const LoyaltyCard = memo(function LoyaltyCard({
  account,
  starsPerReward = LOYALTY.starsForReward,
}: Props) {
  const goal = starsPerReward > 0 ? starsPerReward : 1
  const currentStars = account.balance % goal
  const remaining = Math.max(0, goal - currentStars)
  const pct = Math.min(1, currentStars / goal)
  const lifetime = account.lifetimePoints ?? account.balance

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[T.brand, T.brandDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>YOUR STARS</Text>
            <View style={styles.starsRow}>
              <Text style={styles.starsBig}>{currentStars}</Text>
              <Text style={styles.starsSep}> / {goal}</Text>
            </View>
          </View>
          <View style={styles.lifetimePill}>
            <Icon name="star" color={T.peach} size={11} />
            <Text style={styles.lifetimeText}>{lifetime} drinks</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[T.peach, '#FFD9A3']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${pct * 100}%` }]}
          />
        </View>
        <Text style={styles.caption}>
          {remaining === 0
            ? 'Free drink unlocked — redeem at pickup'
            : `${remaining} star${remaining === 1 ? '' : 's'} until your next free drink`}
        </Text>
      </LinearGradient>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  card: {
    borderRadius: RADIUS.card,
    padding: 18,
    shadowColor: '#6B3E15',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...TYPE.eyebrow,
    color: 'rgba(255,255,255,0.7)',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  starsBig: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: '#fff',
  },
  starsSep: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 30,
  },
  lifetimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  lifetimeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  progressTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter_400Regular',
  },
})
