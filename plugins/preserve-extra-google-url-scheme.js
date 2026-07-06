// The committed ios/ Info.plist carries a SECOND Google OAuth reversed
// client id URL scheme (…-mv53v6ceothme1qo7th84lopg00vhpun) that was added
// directly to the native project — the @react-native-google-signin config
// plugin only writes the single iosUrlScheme from app.json, so a bare
// `npx expo prebuild -p ios` silently drops the second scheme. This plugin
// pins it so prebuild output keeps parity with the shipped binary.
const { withInfoPlist } = require('expo/config-plugins')

const EXTRA_SCHEME =
  'com.googleusercontent.apps.744591425203-mv53v6ceothme1qo7th84lopg00vhpun'

module.exports = function withExtraGoogleUrlScheme(config) {
  return withInfoPlist(config, (c) => {
    const types = c.modResults.CFBundleURLTypes ?? []
    const present = types.some((t) =>
      Array.isArray(t.CFBundleURLSchemes) && t.CFBundleURLSchemes.includes(EXTRA_SCHEME),
    )
    if (!present) {
      // Append into the existing Google entry when there is one, else add
      // a standalone entry (URL scheme resolution treats both the same).
      const googleEntry = types.find((t) =>
        Array.isArray(t.CFBundleURLSchemes) &&
        t.CFBundleURLSchemes.some((s) => s.startsWith('com.googleusercontent.apps.')),
      )
      if (googleEntry) {
        googleEntry.CFBundleURLSchemes.push(EXTRA_SCHEME)
      } else {
        types.push({ CFBundleURLSchemes: [EXTRA_SCHEME] })
      }
      c.modResults.CFBundleURLTypes = types
    }
    return c
  })
}
