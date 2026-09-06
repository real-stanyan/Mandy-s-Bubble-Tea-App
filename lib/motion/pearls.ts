// Where pearls settle in the launch cup: a tidy hex stack on the floor —
// a full row along the bottom, the next row nested in its gaps, the way
// boba actually piles when it's poured. Scattered "natural" placement read
// as untidy on Stan's phone (2026-09-06). Pure, so the layout is testable
// against the cup's walls without mounting an SVG.

export type Pearl = { cx: number; cy: number }

export type PearlStackSpec = {
  /** Pearls per row, floor row first. */
  rows: number[]
  /** Centre-to-centre distance within a row (diameter + a hair). */
  gap: number
  centerX: number
  /** cy of the floor row. */
  floorY: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function pearlStack({ rows, gap, centerX, floorY }: PearlStackSpec): Pearl[] {
  // Hexagonal packing: each row sits gap·sin60° above the one below.
  const rowH = gap * Math.sin(Math.PI / 3)
  const out: Pearl[] = []
  rows.forEach((n, r) => {
    const cy = floorY - r * rowH
    const x0 = centerX - ((n - 1) * gap) / 2
    for (let i = 0; i < n; i++) out.push({ cx: r1(x0 + i * gap), cy: r1(cy) })
  })
  return out
}

/** The launch cup's interior, in its 120×168 box (LiquidCup's CUP path). */
export const LAUNCH_CUP = {
  top: 44,
  floor: 160,
  /** Half width at the rim and at the floor (the wall tapers). */
  halfAtTop: 38,
  halfAtFloor: 30,
  /** Rim/floor corner radius. */
  corner: 8,
  stroke: 3,
  centerX: 60,
} as const

/** Inner half-width of the cup at height y, inside the stroke. */
export function launchCupInnerHalfWidth(y: number): number {
  const t = (y - LAUNCH_CUP.top) / (LAUNCH_CUP.floor - LAUNCH_CUP.top)
  const wall = LAUNCH_CUP.halfAtTop + (LAUNCH_CUP.halfAtFloor - LAUNCH_CUP.halfAtTop) * t
  return wall - LAUNCH_CUP.stroke / 2
}

export const LAUNCH_PEARL_R = 6.5

/** The seven pearls the launch cup drops: four on the floor, three nested above. */
export const LAUNCH_PEARLS: Pearl[] = pearlStack({
  rows: [4, 3],
  gap: LAUNCH_PEARL_R * 2 + 1,
  centerX: LAUNCH_CUP.centerX,
  floorY: LAUNCH_CUP.floor - LAUNCH_CUP.stroke / 2 - LAUNCH_PEARL_R,
})
