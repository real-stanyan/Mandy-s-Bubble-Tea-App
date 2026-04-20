import { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '@/components/brand/Icon'
import { useAuth } from '@/components/auth/AuthProvider'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

interface Props {
  rewardsCount: number
}

export const PromotionsCard = memo(function PromotionsCard({ rewardsCount }: Props) {
  const { welcomeDiscount } = useAuth()
  const welcomeAvailable = welcomeDiscount.available
  const welcomePct = welcomeDiscount.percentage

  const badgeCount =
    (welcomeAvailable ? 1 : 0) + (rewardsCount > 0 ? rewardsCount : 0)

  const remaining = welcomeDiscount.drinksRemaining
  const remainingLabel = `${remaining} drink${remaining === 1 ? '' : 's'} left`

  const subtitle = (() => {
    if (rewardsCount > 0 && welcomeAvailable) {
      return `${rewardsCount} free drink${rewardsCount > 1 ? 's' : ''} + ${welcomePct}% off welcome (${remainingLabel})`
    }
    if (rewardsCount > 0) {
      return `${rewardsCount} free drink${rewardsCount > 1 ? 's' : ''} ready to redeem`
    }
    if (welcomeAvailable) {
      return `${welcomePct}% off your first 2 drinks — ${remainingLabel}`
    }
    return 'Earn stars to unlock free drinks'
  })()

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/promotions')}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <Text style={styles.title}>PROMOTIONS</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.right}>
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount}</Text>
          </View>
        )}
        <Icon name="chevR" color={T.ink4} size={18} />
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOW.card,
  },
  left: { flex: 1, paddingRight: 12 },
  title: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPE.bodyStrong,
    color: T.ink,
    fontSize: 14,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_600SemiBold',
  },
})
