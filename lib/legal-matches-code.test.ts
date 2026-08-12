import { LEGAL_CONTENT } from '@/lib/legal'
import pkg from '../package.json'

const privacyText = LEGAL_CONTENT.privacy.sections
  .flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])])
  .join('\n')

const deps = Object.keys(pkg.dependencies ?? {})

/**
 * The privacy policy has to describe what the app actually does.
 *
 * It said "We do not collect precise location, contacts, photos" while
 * app/order-complaint.tsx was uploading customer photos multipart to the
 * complaint endpoint (found 2026-08-12, while filling in Play's Data safety
 * form — which must match the published policy, so the contradiction was
 * about to block the release).
 *
 * Nobody caught it because the app copy and the web copy were kept in sync
 * with each other, and both were wrong. Syncing two documents does not check
 * either against the code. This does: it ties the claims to the dependency
 * that would make them false.
 */
describe('privacy policy matches what the app collects', () => {
  it('declares photos when the app can pick them', () => {
    if (!deps.includes('expo-image-picker')) return // no picker, no claim owed
    expect(privacyText).toMatch(/photos? you (choose to )?attach/i)
  })

  it('never claims photos are uncollected while the picker ships', () => {
    if (!deps.includes('expo-image-picker')) return
    // The exact shape of the sentence that shipped: a "we do not collect"
    // list with photos inside it.
    const denial = /do not collect[^.]*\bphotos\b/i
    expect(privacyText).not.toMatch(denial)
  })

  it('declares the push token when notifications ship', () => {
    if (!deps.includes('expo-notifications')) return
    expect(privacyText).toMatch(/push notification token/i)
  })

  it('only claims no analytics while no analytics SDK is installed', () => {
    const claimsNoAnalytics = /does not use third-party advertising or analytics/i.test(
      privacyText,
    )
    if (!claimsNoAnalytics) return
    const trackers = deps.filter((d) =>
      /sentry|firebase|amplitude|mixpanel|bugsnag|crashlytics|segment|posthog/i.test(d),
    )
    expect(trackers).toEqual([])
  })

  it('only claims no location while no location SDK is installed', () => {
    const claimsNoLocation = /do not collect precise location/i.test(privacyText)
    if (!claimsNoLocation) return
    expect(deps.filter((d) => /expo-location|geolocation/i.test(d))).toEqual([])
  })
})
