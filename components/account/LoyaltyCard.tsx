import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Icon } from '@/components/brand/Icon'
import { StarCupsRow } from '@/components/brand/StarCupsRow'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import type { MembershipTier } from '@/lib/membership-tier'
import type { LoyaltyAccount } from '@/types/square'

interface Props {
  account: LoyaltyAccount
  starsPerReward?: number
  tier: MembershipTier
  nextTier: Exclude<MembershipTier, 'silver'> | null
  starsToNext: number | null
  freeToppingsRemaining?: number | null
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Tier-specific card materials — colors mirror the web dark-luxe
// TIER_VISUALS gradients (web src/components/account/LoyaltyCard.tsx).
const TIER_VISUALS: Record<
  MembershipTier,
  { label: string; gradient: [string, string, ...string[]] }
> = {
  silver: {
    label: 'SILVER',
    gradient: ['#2c313d', '#485064', '#707a8c', '#414958', '#2d3340'],
  },
  gold: {
    label: 'GOLD',
    gradient: ['#392a0d', '#654c16', '#c2a045', '#574012', '#322307'],
  },
  diamond: {
    label: 'DIAMOND',
    gradient: ['#04050a', '#10121d', '#04050a'],
  },
}

export const LoyaltyCard = memo(function LoyaltyCard({
  account,
  starsPerReward = LOYALTY.starsForReward,
  tier,
  nextTier,
  starsToNext,
  freeToppingsRemaining,
}: Props) {
  const router = useRouter()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const goal = starsPerReward > 0 ? starsPerReward : 1
  const currentStars = account.balance % goal
  const toGo = Math.max(0, goal - currentStars)
  const reached = account.balance >= goal

  const visual = TIER_VISUALS[tier]
  const tierSubline =
    tier === 'diamond' && freeToppingsRemaining != null
      ? `${freeToppingsRemaining} free toppings left this month`
      : starsToNext != null
        ? `${starsToNext} stars to ${nextTier === 'gold' ? 'Gold' : 'Diamond'}`
        : 'Top tier member'

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <AnimatedPressable
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 160 }) }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 160 }) }}
        onPress={() => router.push('/promotions')}
        style={[animatedStyle, { borderRadius: RADIUS.card, ...SHADOW.miniCart, shadowColor: T.brandDark }]}
      >
        <LinearGradient
          colors={visual.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: RADIUS.card, padding: 22, overflow: 'hidden' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: T.peach }} />
                <Text style={[TYPE.eyebrow, { color: 'rgba(255,255,255,0.7)' }]}>
                  MANDY&apos;S REWARDS
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 36,
                    lineHeight: 36,
                    letterSpacing: -0.8,
                    color: '#fff',
                  }}
                >
                  {account.balance}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 24,
                    color: 'rgba(255,255,255,0.45)',
                    marginLeft: 6,
                  }}
                >
                  {` / ${goal} stars`}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.22)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Icon
                name={tier === 'diamond' ? 'gem' : 'star'}
                color={tier === 'diamond' ? '#8ec5ff' : T.peach}
                size={12}
              />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 10.5,
                  letterSpacing: 1.6,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {visual.label}
              </Text>
            </View>
          </View>

          <StarCupsRow value={currentStars} total={goal} />

          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)' }]}>
                {reached ? (
                  '🎉 Free drink ready to redeem'
                ) : (
                  <>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fff' }}>{toGo}</Text>
                    {` stars until a free drink`}
                  </>
                )}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 11,
                  lineHeight: 15,
                  letterSpacing: 0.3,
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {tierSubline}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: reached ? T.peach : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12.5,
                  color: reached ? T.brandDark : '#fff',
                }}
              >
                {reached ? 'Redeem' : 'View'}
              </Text>
              <Icon name="arrow" color={reached ? T.brandDark : '#fff'} size={12} />
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  )
})
