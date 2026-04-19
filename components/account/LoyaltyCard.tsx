import { View, Text, StyleSheet } from 'react-native'
import { StarsProgress } from './StarsProgress'
import { BRAND, LOYALTY } from '@/lib/constants'
import type { LoyaltyAccount } from '@/types/square'

interface Props {
  account: LoyaltyAccount
  starsPerReward?: number
}

export function LoyaltyCard({ account, starsPerReward = LOYALTY.starsForReward }: Props) {
  const currentStars = account.balance % starsPerReward
  const hasReward = starsPerReward > 0 && account.balance >= starsPerReward

  return (
    <View style={styles.card}>
      <View style={styles.badgeStack}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            ⭐ {starsPerReward} STARS = 1 FREE DRINK
          </Text>
        </View>
        <View style={[styles.badge, styles.badgeHint]}>
          <Text style={styles.badgeText}>☕ BUY ANY DRINK = EARN 1 STAR</Text>
        </View>
      </View>
      <Text style={styles.starsLabel}>Your Stars</Text>
      <Text style={styles.starsCount}>{account.balance}</Text>
      <StarsProgress current={currentStars} />
      {hasReward ? (
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardText}>
            🎉 You have a free drink reward!
          </Text>
        </View>
      ) : (
        <Text style={styles.nextReward}>
          {starsPerReward - currentStars} more star
          {starsPerReward - currentStars !== 1 ? 's' : ''} until your
          free drink
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.color,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    position: 'relative',
  },
  badgeStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeHint: {
    marginTop: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  starsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  starsCount: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
  },
  nextReward: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  rewardBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  rewardText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
})
