import { CAPSULE_REST, SHRINK_DIM, breath, capsuleFlare, glowDim, poolCenter } from './glow'

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

describe('poolCenter', () => {
  it('sits in the middle of the slot the pager rests on', () => {
    expect(poolCenter(0, 85, 4)).toBeCloseTo(46.5)
    expect(poolCenter(2, 85, 4)).toBeCloseTo(216.5)
  })

  it('slides between two slots while the pages move', () => {
    const between = poolCenter(0.5, 85, 4)
    expect(between).toBeCloseTo((poolCenter(0, 85, 4) + poolCenter(1, 85, 4)) / 2)
  })

  it('stays under the pill when its slots narrow for the capsule', () => {
    // Four slots in a 250pt pill with 4pt ends: the last slot's middle is inside.
    const slot = (250 - 8) / 4
    expect(poolCenter(3, slot, 4)).toBeLessThan(250)
    expect(poolCenter(0, slot, 4)).toBeGreaterThan(0)
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
  it('rests at CAPSULE_REST of the halo, with no burst', () => {
    const rest = capsuleFlare(0)
    expect(rest.halo).toBeCloseTo(CAPSULE_REST)
    expect(rest.burst).toBe(0)
  })

  it('takes the halo to all of itself and lights the burst at the top of a flare', () => {
    const top = capsuleFlare(1)
    expect(top.halo).toBeCloseTo(1)
    expect(top.burst).toBe(1)
  })

  it('rises with the flare', () => {
    expect(capsuleFlare(0.5).halo).toBeGreaterThan(capsuleFlare(0.2).halo)
    expect(capsuleFlare(0.5).burst).toBeGreaterThan(capsuleFlare(0.2).burst)
  })

  it('never shows more than all of itself, nor less than its rest', () => {
    expect(capsuleFlare(3).halo).toBeLessThanOrEqual(1)
    expect(capsuleFlare(3).burst).toBe(1)
    expect(capsuleFlare(-1).halo).toBeCloseTo(CAPSULE_REST)
    expect(capsuleFlare(-1).burst).toBe(0)
  })
})
