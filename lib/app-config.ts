// Remote app config (min-version gate). Server: web /api/app-config —
// a tiny CDN-cached JSON with per-platform minimum build numbers, so a
// binary with a known-broken payment flow can be forced to update without
// waiting for users to notice.

export interface PlatformConfig {
  minBuild: number
  latestBuild: number
  storeUrl: string
}

export interface AppConfig {
  ok: boolean
  ios: PlatformConfig | null
  android: PlatformConfig | null
}

export type UpdateGateDecision =
  | { required: false }
  | { required: true; storeUrl: string }

/**
 * Decide whether to show the full-screen UpdateRequired gate.
 *
 * FAIL-OPEN by design: any missing/undecidable input → don't block.
 * We only intercept when we have a config, a platform entry, a numeric
 * build number, AND that build is strictly below minBuild.
 */
export function decideUpdateGate(
  config: AppConfig | null | undefined,
  platform: string,
  buildNumber: string | number | null | undefined,
): UpdateGateDecision {
  if (!config || config.ok === false) return { required: false }
  const platformConfig =
    platform === 'ios' ? config.ios : platform === 'android' ? config.android : null
  if (!platformConfig || typeof platformConfig.minBuild !== 'number') {
    return { required: false }
  }
  if (buildNumber == null) return { required: false }
  const build = Number(buildNumber)
  if (!Number.isFinite(build)) return { required: false }
  // Self-consistency: a config demanding a build NEWER than the newest one
  // on the store (minBuild > latestBuild) would lock users behind a wall
  // with nothing to update to — e.g. minBuild bumped before the release
  // actually shipped. Fail open until the config is coherent.
  if (
    typeof platformConfig.latestBuild === 'number' &&
    platformConfig.minBuild > platformConfig.latestBuild
  ) {
    return { required: false }
  }
  if (build >= platformConfig.minBuild) return { required: false }
  if (typeof platformConfig.storeUrl !== 'string' || !platformConfig.storeUrl) {
    // No store URL to send the user to — an unactionable wall is worse
    // than letting an old build through.
    return { required: false }
  }
  return { required: true, storeUrl: platformConfig.storeUrl }
}
