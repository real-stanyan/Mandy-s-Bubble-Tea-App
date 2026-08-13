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
  // No thumbUrl means the caller built this from a bare hash; fall back to
  // the first reconstructed location.
  if (!item.thumbUrl) return { uri: presetRemoteCandidates(item.hash)[0]! }
  const uri = item.thumbUrl.startsWith('http') ? item.thumbUrl : `${API_BASE}${item.thumbUrl}`
  return { uri }
}

/**
 * Where a preset's art can live, given only its hash.
 *
 * A cart selection records `{ kind: 'preset', hash }` and nothing else, so
 * anything rendering from a selection has to reconstruct the location. There
 * are two, and the first version of this only knew one:
 *
 *   uploads  (227 of 462 today) — Supabase Storage
 *   builtins (235) — the web app's public folder
 *
 * 225 builtins ship in the binary, so the bundled lookup covers most of them
 * and hides how much the fallback matters: every upload, plus the ten
 * builtins added since this binary was cut. Guessing the site path for an
 * upload gives a 404 and a blank white square, which is the bug that
 * survived the first fix.
 *
 * Both URLs are deterministic from the hash — verified against production,
 * each returning 200 image/png — so the caller tries them in turn rather
 * than fetching the gallery to look one up. Uploads are the larger group, so
 * Storage goes first.
 */
export function presetRemoteCandidates(hash: string): string[] {
  const supabase = process.env.EXPO_PUBLIC_SUPABASE_URL
  const out: string[] = []
  if (supabase) {
    out.push(`${supabase}/storage/v1/object/public/cup-label-gallery/${hash}/binarized.png`)
  }
  out.push(`${API_BASE}/cup-label/gallery/${hash}/binarized.png`)
  return out
}

/** The bundled asset when there is one; otherwise null, and the caller walks
 *  presetRemoteCandidates(). */
export function bundledPreset(hash: string): ImageSourcePropType | null {
  const bundled = GALLERY_MANIFEST[hash]
  return bundled === undefined ? null : (bundled as ImageSourcePropType)
}
