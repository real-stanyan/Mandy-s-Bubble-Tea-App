// lib/doodle/clientLineId.ts
// MIRROR of mandys_bubble_tea/src/lib/cup-label/client-line-id.ts.
// Also matches store/cart.ts:buildLineId so cart entries flow straight through.

export function clientLineId(variationId: string, modifierIds: string[]): string {
  return `${variationId}::${[...modifierIds].sort().join(',')}`
}
