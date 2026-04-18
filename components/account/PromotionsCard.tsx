import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { useWelcomeDiscountStore } from '@/store/welcomeDiscount'

interface Props {
  rewardsCount: number
}

export function PromotionsCard({ rewardsCount }: Props) {
  const welcomeAvailable = useWelcomeDiscountStore((s) => s.available)
  const welcomePct = useWelcomeDiscountStore((s) => s.percentage)

  const badgeCount =
    (welcomeAvailable ? 1 : 0) + (rewardsCount > 0 ? rewardsCount : 0)

  const subtitle = (() => {
    if (rewardsCount > 0 && welcomeAvailable) {
      return `${rewardsCount} free drink${rewardsCount > 1 ? 's' : ''} + ${welcomePct}% off welcome gift`
    }
    if (rewardsCount > 0) {
      return `${rewardsCount} free drink${rewardsCount > 1 ? 's' : ''} ready to redeem`
    }
    if (welcomeAvailable) {
      return `${welcomePct}% off your first order`
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
        <Ionicons name="chevron-forward" size={22} color="#a1a1aa" />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  left: { flex: 1, paddingRight: 12 },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: BRAND.color,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#3f3f46',
    fontWeight: '500',
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
    backgroundColor: BRAND.color,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
})
