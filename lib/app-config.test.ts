/**
 * Min-version gate decision — the gate must be FAIL-OPEN everywhere except
 * the one case where we positively know the build is below minBuild.
 */
import { decideUpdateGate, type AppConfig } from '@/lib/app-config'

const config: AppConfig = {
  ok: true,
  ios: {
    minBuild: 23,
    latestBuild: 23,
    storeUrl: 'https://apps.apple.com/au/app/id6762111842',
  },
  android: null,
}

describe('decideUpdateGate', () => {
  it('blocks an iOS build below minBuild', () => {
    expect(decideUpdateGate(config, 'ios', '22')).toEqual({
      required: true,
      storeUrl: 'https://apps.apple.com/au/app/id6762111842',
    })
  })

  it('allows a build equal to minBuild', () => {
    expect(decideUpdateGate(config, 'ios', '23')).toEqual({ required: false })
  })

  it('allows a build above minBuild', () => {
    expect(decideUpdateGate(config, 'ios', '24')).toEqual({ required: false })
  })

  it('fails open when the config fetch failed (null config)', () => {
    expect(decideUpdateGate(null, 'ios', '1')).toEqual({ required: false })
  })

  it('fails open when the platform has no config entry (android: null)', () => {
    expect(decideUpdateGate(config, 'android', '1')).toEqual({ required: false })
  })

  it('fails open on an unknown platform', () => {
    expect(decideUpdateGate(config, 'web', '1')).toEqual({ required: false })
  })

  it('fails open when the build number is missing or not numeric', () => {
    expect(decideUpdateGate(config, 'ios', undefined)).toEqual({ required: false })
    expect(decideUpdateGate(config, 'ios', null)).toEqual({ required: false })
    expect(decideUpdateGate(config, 'ios', 'abc')).toEqual({ required: false })
  })

  it('fails open when config reports ok:false', () => {
    expect(decideUpdateGate({ ...config, ok: false }, 'ios', '1')).toEqual({
      required: false,
    })
  })

  it('fails open when minBuild > latestBuild (config demands an unreleased build)', () => {
    // e.g. minBuild bumped ahead of the store release — blocking here would
    // wall users off with nothing to update to.
    const incoherent: AppConfig = {
      ...config,
      ios: {
        minBuild: 25,
        latestBuild: 23,
        storeUrl: 'https://apps.apple.com/au/app/id6762111842',
      },
    }
    expect(decideUpdateGate(incoherent, 'ios', '22')).toEqual({ required: false })
  })

  it('still gates when latestBuild is missing (self-check needs both numbers)', () => {
    const noLatest = {
      ...config,
      ios: {
        minBuild: 23,
        storeUrl: 'https://apps.apple.com/au/app/id6762111842',
      },
    } as unknown as AppConfig
    expect(decideUpdateGate(noLatest, 'ios', '22')).toEqual({
      required: true,
      storeUrl: 'https://apps.apple.com/au/app/id6762111842',
    })
  })

  it('fails open when storeUrl is missing (unactionable wall)', () => {
    const noUrl: AppConfig = {
      ...config,
      ios: { minBuild: 23, latestBuild: 23, storeUrl: '' },
    }
    expect(decideUpdateGate(noUrl, 'ios', '1')).toEqual({ required: false })
  })

  it('accepts numeric build numbers (android versionCode is a number)', () => {
    const androidConfig: AppConfig = {
      ok: true,
      ios: null,
      android: { minBuild: 10, latestBuild: 12, storeUrl: 'https://play.google.com/x' },
    }
    expect(decideUpdateGate(androidConfig, 'android', 9)).toEqual({
      required: true,
      storeUrl: 'https://play.google.com/x',
    })
    expect(decideUpdateGate(androidConfig, 'android', 10)).toEqual({ required: false })
  })
})
