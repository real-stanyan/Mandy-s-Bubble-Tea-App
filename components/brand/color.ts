import { T } from '@/constants/theme';

const PALETTE = [T.peach, T.cream, T.star, T.brand, T.sage] as const;

// Deterministic color for fallback thumbnails. Same id → same color, always.
// djb2 string hash (`h = h * 33 ^ c`), then mod PALETTE.length.
// @verification
// hashColor('ABC123') === hashColor('ABC123') // deterministic
// PALETTE.includes(hashColor('anything')) // always in palette
export function hashColor(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 33) ^ id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
