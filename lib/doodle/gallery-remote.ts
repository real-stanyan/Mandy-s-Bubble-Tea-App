import { GALLERY_MANIFEST } from './gallery-manifest.generated'
import type { ImageSourcePropType } from 'react-native'
import { API_BASE } from '@/lib/api'

export type RemotePreset = {
  hash: string
  thumbUrl: string
  source: 'builtin' | 'upload'
}

/**
 * Fetch the merged gallery (builtin + uploaded presets) from the web API.
 * Returns [] on any error so callers can fall back to the bundled GALLERY_HASHES.
 */
export async function fetchGallery(): Promise<RemotePreset[]> {
  try {
    const res = await fetch(`${API_BASE}/api/cup-label/gallery`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.presets ?? []) as RemotePreset[]
  } catch {
    return []
  }
}

/**
 * Resolve the image source for a RemotePreset.
 * - If the hash is in the bundled GALLERY_MANIFEST, return the bundled require().
 * - Otherwise return a { uri } object; absolute URLs are used as-is,
 *   site-relative paths are prefixed with API_BASE.
 */
export function presetImageSource(item: RemotePreset): ImageSourcePropType {
  const bundled = GALLERY_MANIFEST[item.hash]
  if (bundled !== undefined) return bundled as ImageSourcePropType
  if (!item.thumbUrl) return presetImageSourceForHash(item.hash)
  const uri = item.thumbUrl.startsWith('http') ? item.thumbUrl : `${API_BASE}${item.thumbUrl}`
  return { uri }
}

/**
 * Same resolution from a hash alone, for the places that only stored one.
 *
 * A cart selection records `{ kind: 'preset', hash }` and nothing else, so
 * the checkout preview looked the hash up in GALLERY_MANIFEST directly. That
 * works for the art shipped in the binary and returns undefined for anything
 * the server added later — the customer picked a design from the gallery and
 * got a blank white square on their cup card (Stan's screenshot, 2026-08-13).
 *
 * The path is derivable: the gallery API builds thumbUrl as
 * /cup-label/gallery/<hash>/binarized.png, verified serving 200 image/png.
 * So the hash is enough, and no cart migration is needed to carry a URL that
 * was always reconstructible.
 */
export function presetImageSourceForHash(hash: string): ImageSourcePropType {
  const bundled = GALLERY_MANIFEST[hash]
  if (bundled !== undefined) return bundled as ImageSourcePropType
  return { uri: `${API_BASE}/cup-label/gallery/${hash}/binarized.png` }
}
