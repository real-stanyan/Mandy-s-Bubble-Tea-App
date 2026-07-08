import { Text, View } from 'react-native'
import { DIAMOND_MONTHLY_FREE_TOPPINGS, type MembershipTier } from '@/lib/membership-tier'

// Diamond accent, matching TierCardShell's diamond keyLight / TierDiscountChip.
const ICE = '#8ec5ff'
const ICE_SOFT = '#BFD6FF'

interface Props {
  tier: MembershipTier
  /** Free paid-topping units left this Brisbane month (from /api/tier/toppings). */
  remaining?: number | null
}

/**
 * Diamond-only: this month's free-topping allowance as a 10-pip bar
 * (bright pips = still available), echoing the star-cup row above it.
 * `limit` is the checked-in constant DIAMOND_MONTHLY_FREE_TOPPINGS (10) —
 * the source of truth on both web + app — so only `remaining` is dynamic.
 *
 * Renders nothing for non-diamond tiers or while `remaining` is unknown
 * (null: not diamond, in flight, or the request failed) — same fail-open
 * rule as the account subline this replaces.
 */
export function TierToppingsProgress({ tier, remaining }: Props) {
  if (tier !== 'diamond' || remaining == null) return null

  const total = DIAMOND_MONTHLY_FREE_TOPPINGS
  const left = Math.max(0, Math.min(total, remaining))

  return (
    <View
      style={{
        marginTop: 16,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(150,180,235,0.16)',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 9,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13 }}>🧋</Text>
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              letterSpacing: 0.2,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            Free toppings this month
          </Text>
        </View>
        {left > 0 ? (
          <Text style={{ fontFamily: 'Fraunces_500Medium', fontSize: 12, color: ICE_SOFT }}>
            {`${left} of ${total} left`}
          </Text>
        ) : (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            used up · resets monthly
          </Text>
        )}
      </View>

      {/* 10 pips; bright = still available. Solid fills only — no per-pip
          shadow, to stay cheap on Android (see TierCardShell 3D gating). */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 7,
              borderRadius: 999,
              backgroundColor: i < left ? ICE : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </View>
    </View>
  )
}
