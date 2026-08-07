/**
 * In-app destination carried by a campaign push (`data.url`).
 *
 * Only a single-slash relative path is accepted. A push payload is
 * attacker-reachable in principle — anyone holding an Expo push token can send
 * to it — so `//evil.example` (protocol-relative) and `myapp://…` must never
 * become navigation. Anything else returns null and the tap just opens the
 * app, which is the pre-existing behaviour for every campaign push.
 */
export function safeInAppPath(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  // A backslash is treated as a slash by some URL parsers, so `/\evil.example`
  // is protocol-relative in disguise.
  if (trimmed.startsWith('/\\')) return null
  return trimmed
}
