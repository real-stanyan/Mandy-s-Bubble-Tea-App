import { API_BASE } from '@/lib/api'

// Kill-switch: set to false to serve raw Square S3 URLs everywhere again.
// Single-line rollback — no call sites need to change.
export const OPTIMIZER_ENABLED = true

// Width tiers. Only values from the web app's Next.js image whitelist are
// legal (`deviceSizes` + `imageSizes` in the web repo's next.config.ts);
// any other `w` — or any `q` other than 75 — makes /_next/image return 400.
export const IMG_THUMB = 384 // list thumbnails (36–76pt → ≤228px @3x)
export const IMG_HERO = 1080 // item-detail full-width hero

const ALLOWED_WIDTHS = new Set([
  32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
])

// Hosts the web optimizer accepts (mirrors images.remotePatterns in the web
// repo's next.config.ts). Anything else passes through untouched so a future
// catalog change can never produce a 400-ing optimizer URL.
const OPTIMIZABLE_HOSTS = new Set([
  'items-images-production.s3.us-west-2.amazonaws.com',
  'items-images-sandbox.s3.us-west-2.amazonaws.com',
  'square-catalog-sandbox.s3.amazonaws.com',
])
const OPTIMIZABLE_SUFFIX = '.squarecdn.com'

// The optimizer negotiates output format via the Accept header. Without
// `image/webp` it returns PNG (~25KB at w=384); with it, webp (~2.4KB).
// expo-image's default Accept is not guaranteed to include webp, so every
// request (render + prefetch) must send this explicitly.
export const SQUARE_IMAGE_HEADERS: Record<string, string> = {
  Accept: 'image/webp,image/*;q=0.8,*/*;q=0.5',
}

function hostnameOf(url: string): string | null {
  // React Native's Hermes supports the WHATWG URL constructor well enough
  // for absolute http(s) URLs, but guard against anything malformed.
  try {
    const host = new URL(url).hostname
    return host || null
  } catch {
    return null
  }
}

/**
 * Rewrite a Square catalog image URL to go through the web app's
 * `/_next/image` optimizer (same host as `API_BASE`, so dev/prod/sandbox
 * all resolve consistently). Non-Square hosts, malformed URLs, and
 * non-whitelisted widths pass through unchanged.
 */
export function optimizedImageUrl(url: string, w: number): string {
  if (!OPTIMIZER_ENABLED) return url
  if (!ALLOWED_WIDTHS.has(w)) return url
  const host = hostnameOf(url)
  if (!host) return url
  if (!OPTIMIZABLE_HOSTS.has(host) && !host.endsWith(OPTIMIZABLE_SUFFIX)) {
    return url
  }
  return `${API_BASE}/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75`
}

/**
 * Pure fallback policy for <SquareImage>. Given the raw URL and whether the
 * previous attempt failed, return the URI to load. The state machine is
 * one-way (ok → failed); once we're on the raw URL there is nowhere further
 * to fall, so onError after failure is a no-op — no retry loop is possible.
 */
export function imageUriFor(rawUrl: string, w: number, failed: boolean): string {
  return failed ? rawUrl : optimizedImageUrl(rawUrl, w)
}

/**
 * Whether an onError on the currently displayed URI should trigger a
 * fallback re-render. False when we already fell back, and false when the
 * optimized URL is identical to the raw one (nothing to fall back to).
 */
export function shouldFallback(rawUrl: string, w: number, failed: boolean): boolean {
  return !failed && optimizedImageUrl(rawUrl, w) !== rawUrl
}

/**
 * URLs worth prefetching for a list of raw image URLs: only those the
 * optimizer actually rewrites. Pass-throughs (kill-switch off, non-Square
 * hosts, malformed URLs) are excluded — prefetching them would bulk-download
 * full-size originals (~1.5MB each), which lazy loading should absorb instead.
 */
export function prefetchableThumbUrls(rawUrls: (string | null | undefined)[]): string[] {
  return rawUrls.flatMap((raw) => {
    if (!raw) return []
    const u = optimizedImageUrl(raw, IMG_THUMB)
    return u === raw ? [] : [u]
  })
}
