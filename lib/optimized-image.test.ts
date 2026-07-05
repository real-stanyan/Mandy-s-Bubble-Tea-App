// Mock the api module so this test doesn't pull in supabase (and so the
// base URL is deterministic regardless of local .env).
jest.mock('@/lib/api', () => ({ API_BASE: 'https://mandybubbletea.com' }))

import {
  IMG_HERO,
  IMG_THUMB,
  imageUriFor,
  optimizedImageUrl,
  shouldFallback,
  SQUARE_IMAGE_HEADERS,
} from './optimized-image'

const PROD_URL =
  'https://items-images-production.s3.us-west-2.amazonaws.com/files/ccd6c37f1157494ebdbfb66f91e6b5251711b0a6/original.png'
const SANDBOX_URL =
  'https://items-images-sandbox.s3.us-west-2.amazonaws.com/files/abc/original.png'
const LEGACY_SANDBOX_URL =
  'https://square-catalog-sandbox.s3.amazonaws.com/files/abc/original.png'
const SQUARECDN_URL = 'https://items-images.squarecdn.com/files/abc/original.png'

describe('optimizedImageUrl', () => {
  it('routes production S3 URLs through /_next/image with encoded url, whitelisted w, q=75', () => {
    expect(optimizedImageUrl(PROD_URL, IMG_THUMB)).toBe(
      `https://mandybubbletea.com/_next/image?url=${encodeURIComponent(PROD_URL)}&w=384&q=75`,
    )
    expect(optimizedImageUrl(PROD_URL, IMG_HERO)).toContain('&w=1080&q=75')
  })

  it('supports every whitelisted Square host', () => {
    for (const url of [SANDBOX_URL, LEGACY_SANDBOX_URL, SQUARECDN_URL]) {
      const out = optimizedImageUrl(url, IMG_THUMB)
      expect(out).toBe(
        `https://mandybubbletea.com/_next/image?url=${encodeURIComponent(url)}&w=384&q=75`,
      )
    }
  })

  it('fully percent-encodes the source URL (no raw ?, &, or /)', () => {
    const tricky = `${PROD_URL}?a=1&b=2`
    const out = optimizedImageUrl(tricky, IMG_THUMB)
    const encoded = out.slice(out.indexOf('url=') + 4, out.indexOf('&w='))
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('?')
    expect(encoded).not.toContain('&')
    expect(decodeURIComponent(encoded)).toBe(tricky)
  })

  it('passes non-Square hosts through unchanged', () => {
    const supabase = 'https://kqasifwkvhaafcwqgpph.supabase.co/storage/v1/x.png'
    expect(optimizedImageUrl(supabase, IMG_THUMB)).toBe(supabase)
    // suffix match must not be fooled by lookalike hosts
    const evil = 'https://notsquarecdn.com/x.png'
    expect(optimizedImageUrl(evil, IMG_THUMB)).toBe(evil)
  })

  it('passes malformed / relative / empty URLs through unchanged', () => {
    for (const bad of ['', 'not a url', '/files/abc/original.png', 'ftp://x/y.png']) {
      expect(optimizedImageUrl(bad, IMG_THUMB)).toBe(bad)
    }
  })

  it('refuses non-whitelisted widths (optimizer would 400) and returns the raw URL', () => {
    for (const w of [16, 100, 383, 0, -1, NaN]) {
      expect(optimizedImageUrl(PROD_URL, w)).toBe(PROD_URL)
    }
  })

  it('always pins q=75 (any other q returns 400 from the optimizer)', () => {
    expect(optimizedImageUrl(PROD_URL, IMG_THUMB)).toMatch(/&q=75$/)
  })
})

describe('fallback policy (imageUriFor / shouldFallback)', () => {
  it('serves the optimized URL before any failure, raw URL after', () => {
    expect(imageUriFor(PROD_URL, IMG_THUMB, false)).toContain('/_next/image?')
    expect(imageUriFor(PROD_URL, IMG_THUMB, true)).toBe(PROD_URL)
  })

  it('falls back exactly once — never loops', () => {
    // 1st error: on optimized URL → fallback allowed
    expect(shouldFallback(PROD_URL, IMG_THUMB, false)).toBe(true)
    // 2nd error: already failed → no further transition, uri stays raw
    expect(shouldFallback(PROD_URL, IMG_THUMB, true)).toBe(false)
    expect(imageUriFor(PROD_URL, IMG_THUMB, true)).toBe(PROD_URL)
  })

  it('never falls back when there is nothing to fall back to (pass-through URLs)', () => {
    const supabase = 'https://example.supabase.co/x.png'
    expect(shouldFallback(supabase, IMG_THUMB, false)).toBe(false)
  })
})

describe('SQUARE_IMAGE_HEADERS', () => {
  it('asks for webp first — without it the optimizer serves ~10× larger PNG', () => {
    expect(SQUARE_IMAGE_HEADERS.Accept).toMatch(/^image\/webp/)
  })
})
