import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/brand/Icon';
import { StarCupsRow } from '@/components/brand/StarCupsRow';
import { T, TYPE } from '@/constants/theme';
import { tierFor } from '@/lib/membership-tier';
import { TierCardShell, TIER_VISUALS } from '@/components/ui/TierCardShell';
import { TierDiscountChip } from '@/components/ui/TierDiscountChip';
import { TierToppingsProgress } from '@/components/ui/TierToppingsProgress';
import { useTierToppings } from '@/hooks/use-tier-toppings';

export function HomeLoyaltyHero() {
  const router = useRouter();
  const { profile, loyalty, starsPerReward } = useAuth();
  // Membership tier — derived from lifetime points, never stored.
  const tier = tierFor(loyalty?.lifetimePoints ?? 0);
  // Diamond-only free-topping allowance (null otherwise / on failure).
  const { remaining: freeToppingsRemaining } = useTierToppings(tier);

  if (!profile) return null;

  const balance = loyalty?.balance ?? 0;
  const goal = starsPerReward ?? 9;
  // Show progress within the current cycle (balance mod goal) so the cup row
  // reflects "stars until next free drink" — even when the user already has
  // one or more unredeemed rewards (balance >= goal).
  const currentStars = goal > 0 ? balance % goal : 0;
  const toGo = Math.max(0, goal - currentStars);
  const reached = balance >= goal;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      {/* Same dark-luxe shell as the Account card; no 3D entrance on Home —
          it renders on every app launch, the reveal is an account-page moment. */}
      <TierCardShell tier={tier} onPress={() => router.push('/promotions')}>
        {/* Top row */}
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
                {balance}
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

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
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
            <TierDiscountChip tier={tier} />
          </View>
        </View>

        <StarCupsRow value={currentStars} total={goal} />

        <TierToppingsProgress tier={tier} remaining={freeToppingsRemaining} />

        {/* Bottom row */}
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)', flex: 1, paddingRight: 12 }]}>
            {reached ? (
              '🎉 Free drink ready to redeem'
            ) : (
              <>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fff' }}>{toGo}</Text>
                {` stars until a free drink`}
              </>
            )}
          </Text>
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
  );
}
