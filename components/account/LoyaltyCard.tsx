import { View, Text, StyleSheet } from 'react-native'
import { StarsProgress } from './StarsProgress'
import { BRAND, LOYALTY } from '@/lib/constants'
import type { LoyaltyAccount } from '@/types/square'

interface Props {
  account: LoyaltyAccount
}

export function LoyaltyCard({ account }: Props) {
  const currentStars = account.balance % LOYALTY.starsForReward
  const hasReward = (account.availableRewards?.length ?? 0) > 0

  return (
    <View style={styles.card}>
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
          {LOYALTY.starsForReward - currentStars} more star
          {LOYALTY.starsForReward - currentStars !== 1 ? 's' : ''} until your
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
