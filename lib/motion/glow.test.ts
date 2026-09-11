import {
  CAPSULE_REST,
  FLARE_GROW,
  HALO_CENTERS,
  HALO_DRIFT,
  HALO_WIDTH,
  SHRINK_DIM,
  SPOT_BODY,
  breath,
  capsuleFlare,
  drift,
  glowDim,
  haloCenter,
  poolCenter,
} from './glow'

describe('breath', () => {
  it('rests in the middle at phase zero, where a loop holds under Reduce Motion', () => {
    expect(breath(0)).toBeCloseTo(0.5)
  })

  it('spans the whole range and comes back to where it began', () => {
    expect(breath(0.25)).toBeCloseTo(1)
    expect(breath(0.75)).toBeCloseTo(0)
    expect(breath(1)).toBeCloseTo(breath(0))
  })
})

describe('drift', () => {
  it('starts at its place and never strays further than HALO_DRIFT of its width', () => {
    expect(drift(0, 200)).toBeCloseTo(0)
    for (let p = 0; p <= 1; p += 0.05) {
      expect(Math.abs(drift(p, 200))).toBeLessThanOrEqual(HALO_DRIFT * 200 + 1e-9)
    }
  })
})

describe('the halo along the pill', () => {
  // The spots are laid out for the full row and scale with the pill, so
  // at any pill width each is HALO_WIDTH of it.
  for (const pillW of [350, 250]) {
    const half = (HALO_WIDTH * pillW) / 2
    const reach = HALO_DRIFT * HALO_WIDTH * pillW

    it(`reaches past both ends of a ${pillW}pt pill`, () => {
      expect(haloCenter(0, pillW) - half).toBeLessThan(0)
      expect(haloCenter(HALO_CENTERS.length - 1, pillW) + half).toBeGreaterThan(pillW)
    })

    it(`keeps every point of a ${pillW}pt pill inside the body of some spot, however they drift`, () => {
      for (let x = 0; x <= pillW; x += 2) {
        const nearest = Math.min(
          ...HALO_CENTERS.map((_, i) => Math.abs(x - haloCenter(i, pillW)) + reach),
        )
        expect(nearest).toBeLessThanOrEqual(half * SPOT_BODY)
      }
    })
  }

  it('orders the spots left to right', () => {
    expect(haloCenter(0, 300)).toBeLessThan(haloCenter(1, 300))
    expect(haloCenter(1, 300)).toBeLessThan(haloCenter(2, 300))
  })
})

describe('poolCenter', () => {
  it('sits in the middle of the slot the pager rests on', () => {
    expect(poolCenter(0, 85, 4)).toBeCloseTo(46.5)
    expect(poolCenter(2, 85, 4)).toBeCloseTo(216.5)
  })

  it('slides between two slots while the pages move', () => {
    const between = poolCenter(0.5, 85, 4)
    expect(between).toBeCloseTo((poolCenter(0, 85, 4) + poolCenter(1, 85, 4)) / 2)
  })
})

describe('glowDim', () => {
  it('shows all the light while the dock is whole and dims it as it shrinks', () => {
    expect(glowDim(0)).toBe(1)
    expect(glowDim(1)).toBeCloseTo(1 - SHRINK_DIM)
    expect(glowDim(0.5)).toBeGreaterThan(glowDim(1))
  })

  it('stays within its range past either end', () => {
    expect(glowDim(-1)).toBe(1)
    expect(glowDim(2)).toBeCloseTo(1 - SHRINK_DIM)
  })
})

describe('capsuleFlare', () => {
  it('rests at CAPSULE_REST, its own size', () => {
    expect(capsuleFlare(0)).toEqual({ opacity: CAPSULE_REST, grow: 1 })
  })

  it('takes the glow to all of itself at the top of a flare, and larger', () => {
    const top = capsuleFlare(1)
    expect(top.opacity).toBeCloseTo(1)
    expect(top.grow).toBeCloseTo(1 + FLARE_GROW)
  })

  it('never shows more than all of itself', () => {
    expect(capsuleFlare(3).opacity).toBeLessThanOrEqual(1)
    expect(capsuleFlare(-1).opacity).toBeCloseTo(CAPSULE_REST)
  })
})
