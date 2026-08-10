import { Text, View } from 'react-native'
import {
  TIER_DISCOUNT_PERCENT,
  tierHasDiscount,
  type MembershipTier,
} from '@/lib/membership-tier'

// Per-tier tint for the "5% OFF" pill — warm gold on the gold card, icy blue
// on the diamond card, mirroring each tier's badge accent. Silver has no
// discount, so the chip renders nothing there.
const CHIP_TINT: Record<'gold' | 'diamond', { bg: string; border: string; text: string }> = {
  gold: { bg: 'rgba(255,224,150,0.16)', border: 'rgba(255,224,150,0.42)', text: '#FFE6A6' },
  diamond: { bg: 'rgba(150,180,255,0.16)', border: 'rgba(150,180,255,0.40)', text: '#BFD6FF' },
}

/**
 * Small "5% OFF" pill shown under the tier badge on the member card, for the
 * tiers that earn the online product discount (Gold + Diamond). Returns null
 * for Silver so callers can drop it in unconditionally.
 */
export function TierDiscountChip({ tier }: { tier: MembershipTier }) {
  if (!tierHasDiscount(tier)) return null
  const tint = CHIP_TINT[tier as 'gold' | 'diamond']
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: tint.bg,
        borderWidth: 1,
        borderColor: tint.border,
      }}
    >
      <Text
        style={{
          fontFamily: 'ShantellSans_600SemiBold',
          fontSize: 10,
          letterSpacing: 0.6,
          color: tint.text,
        }}
      >
        {TIER_DISCOUNT_PERCENT}% OFF
      </Text>
    </View>
  )
}
