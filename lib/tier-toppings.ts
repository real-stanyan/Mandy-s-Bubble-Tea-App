// lib/tier-toppings.ts
/**
 * Diamond-tier free toppings: pure allocation math. Ported from web
 * src/lib/tier-toppings.ts (origin/main) with bigint → number — the app
 * handles all money as number cents (BigInt is converted server-side).
 * Semantics are identical to the web/server version.
 *
 * Rules: only PAID toppings (price > 0) count against the monthly quota;
 * most-expensive-first (max value to customer); cups covered by loyalty
 * rewards are excluded (their toppings are already free).
 */

export type CupRecord = {
  /** Full cup price in cents (variation + modifiers) — matches pickPromoCups units. */
  unitPrice: number
  /** Catalog price in cents of each topping/modifier on this cup. */
  toppingPrices: number[]
}

/**
 * Paid topping unit prices across cups, sorted most-expensive-first.
 * `excludeRewardCount` cheapest cups (by unitPrice, stable ties — same
 * ordering pickPromoCups uses) are excluded from the pool.
 */
export function collectPaidToppingUnits(
  cups: CupRecord[],
  excludeRewardCount: number,
): number[] {
  const exclude = Math.max(0, Math.floor(excludeRewardCount))
  // Sort ascending then drop the first `exclude` entries: the CHEAPEST cups
  // are the reward cups (pickPromoCups allocation), so `kept` = pricier rest.
  const kept = [...cups]
    .sort((a, b) => (a.unitPrice < b.unitPrice ? -1 : a.unitPrice > b.unitPrice ? 1 : 0))
    .slice(Math.min(exclude, cups.length))
  return kept
    .flatMap((c) => c.toppingPrices.filter((p) => p > 0))
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
}

/** Cover up to `remaining` toppings from a most-expensive-first pool. */
export function coverFreeToppings(
  toppingUnitsDesc: number[],
  remaining: number,
): { coveredCount: number; amount: number } {
  const take = Math.min(Math.max(0, Math.floor(remaining)), toppingUnitsDesc.length)
  let amount = 0
  for (let i = 0; i < take; i++) amount += toppingUnitsDesc[i]
  return { coveredCount: take, amount }
}
