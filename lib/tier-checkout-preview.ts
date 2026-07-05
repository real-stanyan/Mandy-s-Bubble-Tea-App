// lib/tier-checkout-preview.ts
import { TIER_DISCOUNT_PERCENT, type MembershipTier } from '@/lib/membership-tier'
import {
  collectPaidToppingUnits,
  coverFreeToppings,
  type CupRecord,
} from '@/lib/tier-toppings'

/**
 * Client-side preview of the server's tier discount math (orders route is
 * authoritative; this mirrors it so the displayed total equals the charge).
 *
 * Ported from web src/lib/tier-checkout-preview.ts (origin/main) with
 * bigint → number. The web version computes the 5% with bigint division
 * `(base * 5n) / 100n`, which truncates toward zero; base is clamped to
 * >= 0 first, so Math.floor here is exactly equivalent.
 */
export function tierCheckoutPreview(args: {
  tier: MembershipTier
  cups: CupRecord[]
  rewardCount: number
  toppingsRemaining: number
  subtotal: number
  rewardDiscount: number
  welcomeDiscount: number
  igFollowDiscount: number
}): { tierDiscountCents: number; toppingCoveredCents: number; toppingCoveredCount: number } {
  if (args.tier === 'silver') {
    return { tierDiscountCents: 0, toppingCoveredCents: 0, toppingCoveredCount: 0 }
  }
  let toppingCoveredCents = 0
  let toppingCoveredCount = 0
  if (args.tier === 'diamond') {
    const pool = collectPaidToppingUnits(args.cups, args.rewardCount)
    const cover = coverFreeToppings(pool, args.toppingsRemaining)
    toppingCoveredCents = cover.amount
    toppingCoveredCount = cover.coveredCount
  }
  let base =
    args.subtotal -
    args.rewardDiscount -
    args.welcomeDiscount -
    args.igFollowDiscount -
    toppingCoveredCents
  if (base < 0) base = 0
  return {
    tierDiscountCents: Math.floor((base * TIER_DISCOUNT_PERCENT) / 100),
    toppingCoveredCents,
    toppingCoveredCount,
  }
}
