// The light behind the bottom dock (Rick, 2026-09-11: the tab bar and the
// bag capsule should glow). Warm light pooled under the dock:
//   - a halo of three soft spots along the pill that drift and breathe out
//     of step with each other, so the light is never quite still — an
//     aurora, not a lamp;
//   - a brighter pool under the tab that is showing, which follows the
//     pages under the finger;
//   - behind the bag capsule, a glow of its own that breathes, and flares
//     when a drink lands in the bag.
// The spots are drawings that never change (components/ui/Glow) — only the
// views that hold them move — and every loop reads the ambient clock
// (lib/motion/ambient). This is the arithmetic; components/ui/DockGlow
// draws it.

/** How far the light reaches above and below the dock, in points. */
export const GLOW_Y = 22
/** How far past the capsule's ends its glow reaches, in points. */
export const GLOW_X = 26
/** The light sits this much below the dock's centre: it pools under it. */
export const GLOW_DROP = 4

/** The halo along the pill: where the three spots' centres sit as a share
 *  of the pill's width, how wide each is as a share of it, their loops'
 *  periods and head starts. Periods that share no small multiple keep the
 *  three out of step, so the light never settles into a pattern. */
export const HALO_CENTERS = [0.16, 0.5, 0.84] as const
export const HALO_WIDTH = 0.6
export const HALO_PERIODS = [7200, 9600, 8400] as const
export const HALO_DELAYS = [0, 1800, 3600] as const
/** How far a spot drifts either way, as a share of its own width. */
export const HALO_DRIFT = 0.06
/** The dimmest a spot breathes down to, against 1 at its brightest. */
export const HALO_FLOOR = 0.62
/** Inside this share of a spot's half-width its light has body; further
 *  out it is the long soft edge (components/ui/Glow's falloff). */
export const SPOT_BODY = 0.7

/** The pool under the showing tab: its width in tab slots, and how much
 *  further than the halo it reaches above and below. */
export const POOL_SLOTS = 1.7
export const POOL_LIFT = 8

/** The capsule's glow: one breath, how dim it breathes down to, how much
 *  it swells and settles either way. */
export const CAPSULE_BREATH_MS = 3600
export const CAPSULE_FLOOR = 0.6
export const CAPSULE_SWELL = 0.05
/** At rest the capsule's glow shows this share of itself; a flare takes it
 *  to all of it and grows it by FLARE_GROW. */
export const CAPSULE_REST = 0.62
export const FLARE_GROW = 0.24
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

/** Where a halo spot's drift puts it, in points either side of its place. */
export function drift(phase: number, width: number): number {
  'worklet'
  return HALO_DRIFT * width * Math.sin(2 * Math.PI * phase)
}

/** The x of halo spot `i`'s centre in a pill `pillW` wide. */
export function haloCenter(i: number, pillW: number): number {
  'worklet'
  const at = i === 0 ? HALO_CENTERS[0] : i === 1 ? HALO_CENTERS[1] : HALO_CENTERS[2]
  return at * pillW
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

/** How much of the capsule's glow shows, and how big it is, for a flare
 *  0..1: at rest CAPSULE_REST of it at its own size, at the top of a flare
 *  all of it, FLARE_GROW larger. */
export function capsuleFlare(flare: number): { opacity: number; grow: number } {
  'worklet'
  const f = flare < 0 ? 0 : flare > 1 ? 1 : flare
  return { opacity: CAPSULE_REST + (1 - CAPSULE_REST) * f, grow: 1 + FLARE_GROW * f }
}
