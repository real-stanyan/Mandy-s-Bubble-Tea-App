import { memo } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Icon } from '@/components/brand/Icon'
import { StarCupsRow } from '@/components/brand/StarCupsRow'
import { T, TYPE } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import { TierCardShell, TIER_VISUALS } from '@/components/ui/TierCardShell'
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

export const LoyaltyCard = memo(function LoyaltyCard({
  account,
  starsPerReward = LOYALTY.starsForReward,
  tier,
  nextTier,
  starsToNext,
  freeToppingsRemaining,
}: Props) {
  const router = useRouter()

  const goal = starsPerReward > 0 ? starsPerReward : 1
  const currentStars = account.balance % goal
  const toGo = Math.max(0, goal - currentStars)
  const reached = account.balance >= goal

  const tierSubline =
    tier === 'diamond' && freeToppingsRemaining != null
      ? `${freeToppingsRemaining} free toppings left this month`
      : starsToNext != null
        ? `${starsToNext} stars to ${nextTier === 'gold' ? 'Gold' : 'Diamond'}`
        : 'Top tier member'

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <TierCardShell tier={tier} entrance onPress={() => router.push('/promotions')}>
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
              {TIER_VISUALS[tier].label}
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
      </TierCardShell>
    </View>
  )
})
