// lib/membership-tier.ts
/**
 * Membership tiers derived from Square loyalty lifetimePoints.
 * Tier is NEVER stored — always recomputed from lifetimePoints, so
 * existing members qualify automatically and there is no sync path.
 * Thresholds: Gold = 30 lifetime stars; Diamond = 80 (30 + 50 more).
 *
 * Ported line-for-line from web src/lib/membership-tier.ts (origin/main).
 * brisbaneMonthKey intentionally NOT ported — the app never computes the
 * month key; the server owns the monthly quota window.
 */

export type MembershipTier = 'silver' | 'gold' | 'diamond'

export const TIER_THRESHOLDS = { gold: 30, diamond: 80 } as const
/** Gold + Diamond: percent off online orders (web + app). */
export const TIER_DISCOUNT_PERCENT = 5
/** Diamond: free paid-topping units per Brisbane calendar month. */
export const DIAMOND_MONTHLY_FREE_TOPPINGS = 10

export function tierFor(lifetimePoints: number): MembershipTier {
  const pts = Number.isFinite(lifetimePoints) ? lifetimePoints : 0
  if (pts >= TIER_THRESHOLDS.diamond) return 'diamond'
  if (pts >= TIER_THRESHOLDS.gold) return 'gold'
  return 'silver'
}

export function tierProgress(lifetimePoints: number): {
  tier: MembershipTier
  nextTier: Exclude<MembershipTier, 'silver'> | null
  starsToNext: number | null
} {
  const pts = Number.isFinite(lifetimePoints) ? Math.max(0, lifetimePoints) : 0
  const tier = tierFor(pts)
  if (tier === 'silver') {
    return { tier, nextTier: 'gold', starsToNext: TIER_THRESHOLDS.gold - pts }
  }
  if (tier === 'gold') {
    return { tier, nextTier: 'diamond', starsToNext: TIER_THRESHOLDS.diamond - pts }
  }
  return { tier, nextTier: null, starsToNext: null }
}
