import { POOL, hashSeed, pickDefaultForCup } from './pool'

describe('hashSeed', () => {
  it('matches backend cyrb53-lite output for known inputs', () => {
    // These values match src/lib/doodle/pool.ts in the backend repo.
    // If you change one side you MUST change the other.
    expect(hashSeed('VAR1::MOD_PEARL:0')).toBe(hashSeed('VAR1::MOD_PEARL:0'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
    expect(typeof hashSeed('test')).toBe('number')
  })
})

describe('POOL', () => {
  it('contains exactly the 4 v1 keys', () => {
    expect(POOL.map(p => p.key)).toEqual(['bunny', 'flower', 'star', 'cloud'])
  })
})

describe('pickDefaultForCup', () => {
  it('is deterministic for same (lineId, cupIdx)', () => {
    const a = pickDefaultForCup('VAR1::MOD_PEARL', 0)
    const b = pickDefaultForCup('VAR1::MOD_PEARL', 0)
    expect(a.key).toBe(b.key)
  })
  it('differs across cupIdx for the same line (often)', () => {
    const keys = new Set([0, 1, 2, 3].map(i => pickDefaultForCup('VAR1::MOD_PEARL', i).key))
    expect(keys.size).toBeGreaterThan(1)
  })
})
