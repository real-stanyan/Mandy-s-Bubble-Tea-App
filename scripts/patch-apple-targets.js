#!/usr/bin/env node
/* global __dirname */
/**
 * Patches @bacons/apple-targets v4.0.7 target-update idempotency crash.
 *
 * This repo commits the generated ios/ directory (CNG artifacts in git) and
 * NEVER runs `prebuild --clean` (it wipes signing config — historical
 * landmine). apple-targets' "target already exists, update it" path crashes
 * on such re-runs:
 *
 *   TypeError: Cannot read properties of undefined (reading 'removeFromProject')
 *
 * Root cause (build/with-xcode-changes.js): when replacing the existing
 * target's XCConfigurationList it first strips the list's referrers — which
 * includes the PBXNativeTarget itself, nulling
 * `targetToUpdate.props.buildConfigurationList` — and then dereferences that
 * now-undefined property again to call `.removeFromProject()`. Fix: capture
 * the list in a local before detaching referrers. Also iterate a copy of
 * buildConfigurations since removeFromProject() mutates the live array.
 *
 * Mirrors the patch-square-sdk.js postinstall approach. Remove once the
 * upstream fix ships (check the update path in with-xcode-changes.js).
 */
const fs = require('fs')
const path = require('path')

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@bacons',
  'apple-targets',
  'build',
  'with-xcode-changes.js'
)

if (!fs.existsSync(filePath)) {
  console.log('[patch-apple-targets] Package not found, skipping')
  process.exit(0)
}

const src = fs.readFileSync(filePath, 'utf8')

const PATCHED_MARKER = 'const existingConfigurationList ='

if (src.includes(PATCHED_MARKER)) {
  console.log('[patch-apple-targets] Already patched')
  process.exit(0)
}

const BROKEN = `    if (targetToUpdate) {
        // Remove existing build phases
        targetToUpdate.props.buildConfigurationList.props.buildConfigurations.forEach((config) => {
            config.getReferrers().forEach((ref) => {
                ref.removeReference(config.uuid);
            });
            config.removeFromProject();
        });
        // Remove existing build configuration list
        targetToUpdate.props.buildConfigurationList
            .getReferrers()
            .forEach((ref) => {
            ref.removeReference(targetToUpdate.props.buildConfigurationList.uuid);
        });
        targetToUpdate.props.buildConfigurationList.removeFromProject();`

const FIXED = `    if (targetToUpdate) {
        // PATCHED (scripts/patch-apple-targets.js): capture the list before
        // detaching referrers — removing the target's own reference nulls
        // targetToUpdate.props.buildConfigurationList mid-flight.
        const existingConfigurationList = targetToUpdate.props.buildConfigurationList;
        // Remove existing build phases (copy: removeFromProject mutates the array)
        [...existingConfigurationList.props.buildConfigurations].forEach((config) => {
            config.getReferrers().forEach((ref) => {
                ref.removeReference(config.uuid);
            });
            config.removeFromProject();
        });
        // Remove existing build configuration list
        existingConfigurationList
            .getReferrers()
            .forEach((ref) => {
            ref.removeReference(existingConfigurationList.uuid);
        });
        existingConfigurationList.removeFromProject();`

if (!src.includes(BROKEN)) {
  // WARN, don't fail: the patch only matters for `expo prebuild -p ios`
  // re-runs — holding every environment's `npm install` hostage over it
  // would be far worse than a noisy prebuild crash later. The dependency is
  // pinned to exactly 4.0.7 in package.json, so hitting this means someone
  // bumped the package: re-check whether upstream fixed the update path
  // (then delete this script) or port the patch to the new code.
  console.warn(
    '[patch-apple-targets] WARNING: expected code not found (package updated?). ' +
      'Skipping patch — verify `npx expo prebuild -p ios` works twice in a row ' +
      'before trusting CNG re-runs, or update/remove scripts/patch-apple-targets.js.'
  )
  process.exit(0)
}

fs.writeFileSync(filePath, src.replace(BROKEN, FIXED))
console.log('[patch-apple-targets] Patched with-xcode-changes.js update path')
