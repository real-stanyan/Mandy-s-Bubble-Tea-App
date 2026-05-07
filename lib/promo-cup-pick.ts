export interface PickPromoCupsArgs {
  unitPrices: number[]
  welcomeK: number
  igFollowK: number
  loyaltyRewardCount?: number
}

export interface PickPromoCupsResult {
  loyaltyRewardCups: number[]
  welcomeCups: number[]
  igFollowCups: number[]
}

/**
 * Allocate cups to loyalty rewards and promotional discounts, sorted
 * by unit price (cheapest first).
 *
 * Allocation order:
 *  1. Loyalty rewards eat the cheapest `loyaltyRewardCount` cups.
 *  2. From the remaining cups, welcome takes its share.
 *  3. From cups left after welcome, IG takes its share (cooperative
 *     behavior unique to app — web is mutually exclusive; this
 *     divergence is pre-existing and out of scope here).
 *
 * One-cup-with-welcome-priority rule still holds for the `remaining`
 * slice when len === 1 and both welcomeK & igFollowK >= 1.
 */
export function pickPromoCups(args: PickPromoCupsArgs): PickPromoCupsResult {
  const sorted = [...args.unitPrices].sort((a, b) => a - b)

  const rewardTake = Math.min(
    Math.max(0, args.loyaltyRewardCount ?? 0),
    sorted.length,
  )
  const loyaltyRewardCups = sorted.slice(0, rewardTake)
  const remaining = sorted.slice(rewardTake)

  if (remaining.length === 1 && args.welcomeK >= 1 && args.igFollowK >= 1) {
    return {
      loyaltyRewardCups,
      welcomeCups: [remaining[0]],
      igFollowCups: [],
    }
  }

  const welcomeTake = Math.min(Math.max(0, args.welcomeK), remaining.length)
  const igTake = Math.min(
    Math.max(0, args.igFollowK),
    Math.max(0, remaining.length - welcomeTake),
  )

  return {
    loyaltyRewardCups,
    welcomeCups: remaining.slice(0, welcomeTake),
    igFollowCups: remaining.slice(welcomeTake, welcomeTake + igTake),
  }
}
