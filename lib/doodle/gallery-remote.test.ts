import { presetImageSource, fetchGallery } from './gallery-remote'

jest.mock('./gallery-manifest.generated', () => ({
  GALLERY_MANIFEST: { b1: 42 },
  GALLERY_HASHES: ['b1'],
}))

jest.mock('@/lib/api', () => ({
  API_BASE: 'https://mandybubbletea.com',
}))

describe('presetImageSource', () => {
  it('uses bundled require when hash is bundled', () => {
    expect(presetImageSource({ hash: 'b1', thumbUrl: '/x', source: 'builtin' })).toBe(42)
  })

  it('uses remote uri for absolute uploads', () => {
    const src = presetImageSource({
      hash: 'u1',
      thumbUrl: 'https://web/u1/color.png',
      source: 'upload',
    })
    expect(src).toEqual({ uri: 'https://web/u1/color.png' })
  })

  it('prepends API_BASE for site-relative thumbUrl', () => {
    const src = presetImageSource({
      hash: 'u2',
      thumbUrl: '/cup-label/u2/color.png',
      source: 'builtin',
    })
    expect(src).toEqual({ uri: 'https://mandybubbletea.com/cup-label/u2/color.png' })
  })
})

describe('fetchGallery', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns presets on success', async () => {
    const mockPresets = [{ hash: 'abc', thumbUrl: '/cup-label/abc/color.png', source: 'builtin' as const }]
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, presets: mockPresets }),
    }) as jest.Mock
    const result = await fetchGallery()
    expect(result).toEqual(mockPresets)
  })

  it('returns [] when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as jest.Mock
    const result = await fetchGallery()
    expect(result).toEqual([])
  })

  it('returns [] when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as jest.Mock
    const result = await fetchGallery()
    expect(result).toEqual([])
  })
})
