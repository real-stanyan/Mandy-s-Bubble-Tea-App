#!/usr/bin/env node
/* global __dirname */
/**
 * Patches expo-notifications' unhandled floating promise in
 * DevicePushTokenAutoRegistration.fx.js.
 *
 * On import the module fires `getRegistrationInfoAsync().then(...)` with NO
 * .catch. When the app is launched while the device is locked (dev installs
 * via `expo run:ios`, background wakes), the iOS keychain read rejects with
 * "Keychain access failed: User interaction is not allowed" and surfaces as
 * an uncaught promise rejection — a dev redbox on every locked launch.
 *
 * Fix: append a .catch that downgrades it to the same console.warn the rest
 * of the file already uses. Registration retries on the next (unlocked)
 * launch, so swallowing here loses nothing.
 *
 * Mirrors the patch-square-sdk.js postinstall approach. Remove once upstream
 * adds the .catch (check the tail of DevicePushTokenAutoRegistration.fx.js).
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'DevicePushTokenAutoRegistration.fx.js',
)

const BROKEN =
  '    ServerRegistrationModule.getRegistrationInfoAsync().then(__handlePersistedRegistrationInfoAsync);'
const FIXED = `    ServerRegistrationModule.getRegistrationInfoAsync()
        .then(__handlePersistedRegistrationInfoAsync)
        // PATCHED (scripts/patch-expo-notifications.js): keychain is
        // unavailable while the device is locked — warn instead of an
        // uncaught rejection; registration retries next launch.
        .catch((e) => console.warn('[expo-notifications] Could not read auto-registration state (device locked?). Will retry next launch.', e));`

if (!fs.existsSync(filePath)) {
  console.log('[patch-expo-notifications] file not found — skipping (module layout changed?)')
  process.exit(0)
}

const src = fs.readFileSync(filePath, 'utf8')
if (src.includes('PATCHED (scripts/patch-expo-notifications.js)')) {
  console.log('[patch-expo-notifications] already patched — skipping')
  process.exit(0)
}
if (!src.includes(BROKEN)) {
  console.error(
    '[patch-expo-notifications] expected line not found — upstream changed, re-check whether the patch is still needed',
  )
  process.exit(1)
}

fs.writeFileSync(filePath, src.replace(BROKEN, FIXED))
console.log('[patch-expo-notifications] patched DevicePushTokenAutoRegistration.fx.js')
