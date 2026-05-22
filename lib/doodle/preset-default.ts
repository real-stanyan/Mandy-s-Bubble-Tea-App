// lib/doodle/preset-default.ts
//
// Deterministically pick a default preset hash for a cup based on its
// `${lineId}:${cupIdx}` identity. Same cup row → same hash across app
// reloads, so users see a stable default sticker before they open the
// label picker. Mirrors server-side `pickDefaultForCup` semantics from
// the web codebase but bound to the 78-PNG gallery pool, not the legacy
// 8-SVG POOL.

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export function fnv1a32(input: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME) >>> 0
  }
  return h >>> 0
}

export function pickDeterministicHash(
  lineId: string,
  cupIdx: number,
  pool: readonly string[],
): string {
  if (pool.length === 0) {
    throw new Error('pickDeterministicHash: pool is empty')
  }
  const idx = fnv1a32(`${lineId}:${cupIdx}`) % pool.length
  return pool[idx]!
}
