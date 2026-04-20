import { memo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS, SPACING } from '@/constants/theme'

interface Props {
  rewardsCount: number
}

export const PromotionsCard = memo(function PromotionsCard({ rewardsCount }: Props) {
  if (rewardsCount <= 0) return null

  const label = `${rewardsCount} free drink${rewardsCount === 1 ? '' : 's'} ready`

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[T.peach, T.cream]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconTile}>
          <Icon name="gift" color={T.cream} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.sub}>Redeem at pickup — any size, any flavor.</Text>
        </View>
        <TouchableOpacity
          style={styles.useBtn}
          onPress={() => router.push('/promotions')}
          activeOpacity={0.85}
        >
          <Text style={styles.useText}>Use</Text>
          <Icon name="chevR" color={T.cream} size={12} />
        </TouchableOpacity>
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
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(141,85,36,0.12)',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.ink2,
    marginTop: 1,
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
  },
  useText: {
    color: T.cream,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
})
