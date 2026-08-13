// gallery-remote reaches API_BASE through lib/api, which constructs the
// Supabase client on import and throws without env. Only the constant is
// needed here.
jest.mock('@/lib/api', () => ({ API_BASE: 'https://mandybubbletea.com' }))

import { presetRemoteCandidates, bundledPreset } from './gallery-remote'
import { GALLERY_HASHES } from './gallery-manifest.generated'

/**
 * A cart selection stores only `{ kind: 'preset', hash }`, so the checkout
 * preview has to find the art from the hash. It lives in three places and
 * the first fix only knew one of them:
 *
 *   bundled   225 builtins shipped in this binary
 *   Storage   227 uploads, on Supabase
 *   web app   the builtins added since the binary was cut
 *
 * Because the bundled lookup covers the common case, a resolver that only
 * knows the web-app path still looks correct on most presets and draws a
 * blank white square on every upload — which is exactly what shipped
 * (2026-08-13, second attempt).
 *
 * These are the shapes, checked without a network call. The counts above
 * came from the live gallery API and will drift; the URL patterns are what
 * must not.
 */
describe('preset art locations', () => {
  const HASH = 'deadbeefdeadbeefdeadbeefdeadbeef'

  it('offers Supabase Storage before the web app', () => {
    // Read inside the function, so setting it here is enough — and the test
    // below covers the environment where it is missing.
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    const [first, second] = presetRemoteCandidates(HASH)
    // Uploads outnumber unbundled builtins, so Storage is the better guess
    // to make first — a wrong first guess costs a failed request.
    expect(first).toContain('/storage/v1/object/public/cup-label-gallery/')
    expect(first).toContain(HASH)
    expect(second).toContain('/cup-label/gallery/')
    expect(second).toContain(HASH)
  })

  it('always offers at least the web-app path', () => {
    // EXPO_PUBLIC_SUPABASE_URL is absent in some environments; the list must
    // never come back empty or the image has nowhere to go.
    delete process.env.EXPO_PUBLIC_SUPABASE_URL
    const only = presetRemoteCandidates(HASH)
    expect(only.length).toBe(1)
    expect(only[0]).toContain('/cup-label/gallery/')
  })

  it('ends every candidate at the binarized asset', () => {
    for (const url of presetRemoteCandidates(HASH)) {
      expect(url.endsWith('/binarized.png')).toBe(true)
    }
  })

  it('resolves a bundled hash without needing the network at all', () => {
    const known = GALLERY_HASHES[0]!
    expect(bundledPreset(known)).not.toBeNull()
  })

  it('returns null for a hash this binary does not carry', () => {
    // The case that produced the blank square: not an error, just absent,
    // so the caller has to fall through rather than render nothing.
    expect(bundledPreset(HASH)).toBeNull()
  })
})
