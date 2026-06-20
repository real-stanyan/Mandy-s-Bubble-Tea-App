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
  const uri = item.thumbUrl.startsWith('http') ? item.thumbUrl : `${API_BASE}${item.thumbUrl}`
  return { uri }
}
