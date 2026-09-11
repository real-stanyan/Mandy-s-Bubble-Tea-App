// The light round the bottom dock (Rick, 2026-09-11: the tab bar and the
// bag capsule should glow). Warm light hugging the dock:
//   - a halo round the tab pill, in the pill's own shape, that breathes;
//   - a brighter pool under the tab that is showing, which follows the
//     pages under the finger;
//   - a halo round the bag capsule, warmer, that breathes and flares when a
//     drink lands in the bag.
// The halos are box shadows of views the shape of the pill and the capsule,
// so the light follows their outline — brightest at the edge, falling away
// outward — instead of sitting as a blob behind them where the dock hides
// its brightest part. The pool is a drawing made once (components/ui/Glow).
// Every loop reads the ambient clock (lib/motion/ambient). This is the
// arithmetic; components/ui/DockGlow draws it.

/** One breath of the pill's halo, and how dim it breathes down to against
 *  1 at its brightest. */
export const HALO_BREATH_MS = 4800
export const HALO_FLOOR = 0.72

/** The pool under the showing tab: its width in tab slots, and how far
 *  above and below the dock it reaches, in points. */
export const POOL_SLOTS = 1.5
export const POOL_REACH = 22

/** The capsule's halo: one breath, and how dim it breathes down to. */
export const CAPSULE_BREATH_MS = 3600
export const CAPSULE_FLOOR = 0.7
/** At rest the capsule's halo shows this share of itself; a flare takes it
 *  to all of it and lights a wider burst round it. The burst is a second
 *  shadow, not the halo grown: a box shadow is cut out of its own view, so
 *  a halo scaled past the capsule shows a ring of bare page between them. */
export const CAPSULE_REST = 0.62
export const FLARE_IN_MS = 110
export const FLARE_OUT_MS = 720
/** How long after the bag's count changes to decide whether to flare: an
 *  add from the item sheet sends a dot flying to the bag a beat after the
 *  store changes (ItemDetailContent), and then the bag flares when the dot
 *  lands, not twice. */
export const FLARE_WAIT_MS = 140

/** While the page is read down the dock shrinks (lib/motion/chrome), and
 *  the light dims this much with it. */
export const SHRINK_DIM = 0.45

/** A breath, 0 → 1: in the middle at phase zero — where a loop holds under
 *  Reduce Motion — then up, down, and back. */
export function breath(phase: number): number {
  'worklet'
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * phase)
}

/** The x of the pool's centre: the middle of the slot the pager is on —
 *  fractional while it moves, so the light slides with the pages. */
export function poolCenter(position: number, slot: number, pad: number): number {
  'worklet'
  return pad + (position + 0.5) * slot
}

/** How much of the light shows while the dock is `shrink` (0..1) shrunk. */
export function glowDim(shrink: number): number {
  'worklet'
  const s = shrink < 0 ? 0 : shrink > 1 ? 1 : shrink
  return 1 - SHRINK_DIM * s
}

/** The capsule's light for a flare 0..1: how much of its halo shows —
 *  CAPSULE_REST of it at rest, all of it at the top of a flare — and how
 *  much of the burst round it, none at rest. */
export function capsuleFlare(flare: number): { halo: number; burst: number } {
  'worklet'
  const f = flare < 0 ? 0 : flare > 1 ? 1 : flare
  return { halo: CAPSULE_REST + (1 - CAPSULE_REST) * f, burst: f }
}
