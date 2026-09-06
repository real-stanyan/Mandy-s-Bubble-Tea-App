// Restrict the Android resource languages to the ones the app actually
// ships. Google Play rejected the 1.3.0 bundle (versionCode 12) because a
// third-party AAR carries resource folders for "languages" that are not
// languages — by, cz, dk, fl, fp, gr, jp, kh (country codes used as locale
// qualifiers). Play's own advice is Gradle's `resConfigs`; the app has no
// translations, so "en" is the whole list. Applied at prebuild (the
// android/ folder is generated, not committed).
const { withAppBuildGradle } = require('expo/config-plugins')

const withAndroidResConfigs = (config, { locales = ['en'] } = {}) =>
  withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') return c
    if (c.modResults.contents.includes('resConfigs')) return c
    const line = `        resConfigs ${locales.map((l) => `"${l}"`).join(', ')}`
    c.modResults.contents = c.modResults.contents.replace(/defaultConfig\s*\{/, (m) => `${m}\n${line}`)
    return c
  })

module.exports = withAndroidResConfigs
