// lib/doodle/gallery-manifest.generated.test.ts
import { GALLERY_MANIFEST, GALLERY_HASHES } from './gallery-manifest.generated'

describe('gallery-manifest.generated', () => {
  it('exports exactly 78 entries', () => {
    expect(GALLERY_HASHES).toHaveLength(78)
  })

  it('GALLERY_MANIFEST and GALLERY_HASHES are aligned 1:1', () => {
    expect(Object.keys(GALLERY_MANIFEST).sort()).toEqual([...GALLERY_HASHES].sort())
  })

  it('every entry is a non-null require() result', () => {
    for (const key of GALLERY_HASHES) {
      const src = GALLERY_MANIFEST[key]
      expect(src).toBeTruthy()
    }
  })

  it('includes both hash-format and named entries (web mixes both)', () => {
    const hashCount = GALLERY_HASHES.filter((k) => /^[0-9a-f]{32}$/.test(k)).length
    const namedCount = GALLERY_HASHES.length - hashCount
    // Both buckets should have at least one entry — defends against a
    // future sync that accidentally filters out one format.
    expect(hashCount).toBeGreaterThan(0)
    expect(namedCount).toBeGreaterThan(0)
  })
})
