export interface PickPromoCupsArgs {
  unitPrices: number[]
  welcomeK: number
  igFollowK: number
}

export interface PickPromoCupsResult {
  welcomeCups: number[]
  igFollowCups: number[]
}

/**
 * Allocate cups to promotional discounts by sorted unit price.
 * One-cup-with-welcome-priority rule: when there is exactly one cup
 * and both promos want a slice, welcome wins (more savings to user)
 * and IG ticket is preserved. The caller must therefore NOT call
 * `consumeIgFollowDiscount` when `igFollowCups.length === 0`.
 */
export function pickPromoCups(args: PickPromoCupsArgs): PickPromoCupsResult {
  const sorted = [...args.unitPrices].sort((a, b) => a - b)

  if (sorted.length === 1 && args.welcomeK >= 1 && args.igFollowK >= 1) {
    return { welcomeCups: [sorted[0]], igFollowCups: [] }
  }

  const welcomeTake = Math.min(Math.max(0, args.welcomeK), sorted.length)
  const igTake = Math.min(
    Math.max(0, args.igFollowK),
    Math.max(0, sorted.length - welcomeTake),
  )

  return {
    welcomeCups: sorted.slice(0, welcomeTake),
    igFollowCups: sorted.slice(welcomeTake, welcomeTake + igTake),
  }
}
