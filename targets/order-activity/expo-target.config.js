/**
 * Order-tracking Live Activity widget extension.
 *
 * Generated into the committed ios/ project by `npx expo prebuild -p ios`
 * via @bacons/apple-targets (files under targets/order-activity are linked
 * into the Xcode target; edits here don't need a --clean prebuild).
 *
 * The App Group entitlement is mirrored automatically from
 * app.json ios.entitlements["com.apple.security.application-groups"].
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'MandysOrderActivity',
  displayName: "Mandy's Order",
  // → com.mandysbubbletea.app.orderactivity
  bundleIdentifier: '.orderactivity',
  // ActivityKit push-token API (Activity.request(pushType:)) needs 16.2+.
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  // Same App Group as the main app (app.json ios.entitlements) — the widget
  // reads the MKMapSnapshotter PNG the app writes into this container.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.mandysbubbletea.app'],
  },
}
