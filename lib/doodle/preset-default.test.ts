import { pickDeterministicHash, fnv1a32 } from './preset-default'

const GALLERY_HASHES = [
  '0a9461b3dcac852906537057ca2edfd3',
  '0c6e25241c77325c567263ce68292cd9',
  '0cbec725b49891337dbb897c29a06fdf',
  '174f4fe0beb8335332d7824449bb9bab',
]

describe('fnv1a32', () => {
  it('returns 0x811c9dc5 for empty string', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
  })
  it('is deterministic for the same input', () => {
    expect(fnv1a32('a:b')).toBe(fnv1a32('a:b'))
  })
  it('differs on different inputs', () => {
    expect(fnv1a32('a:0')).not.toBe(fnv1a32('a:1'))
  })
})

describe('pickDeterministicHash', () => {
  it('returns a hash from the provided pool', () => {
    const hash = pickDeterministicHash('LINE_A', 0, GALLERY_HASHES)
    expect(GALLERY_HASHES).toContain(hash)
  })
  it('is deterministic across calls', () => {
    const a = pickDeterministicHash('LINE_X', 2, GALLERY_HASHES)
    const b = pickDeterministicHash('LINE_X', 2, GALLERY_HASHES)
    expect(a).toBe(b)
  })
  it('different cupIdx produces (usually) different hashes', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) seen.add(pickDeterministicHash('SAME_LINE', i, GALLERY_HASHES))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('throws when pool empty', () => {
    expect(() => pickDeterministicHash('x', 0, [])).toThrow(/empty/)
  })
})
