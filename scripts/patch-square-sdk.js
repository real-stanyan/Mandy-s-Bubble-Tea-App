#!/usr/bin/env node
/**
 * Patches react-native-square-in-app-payments v2.0.0
 * The published package is missing the compiled lib/ directory.
 * This redirects the main entry to src/index.ts so Metro can resolve it.
 */
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-square-in-app-payments',
  'package.json'
)

if (!fs.existsSync(pkgPath)) {
  console.log('[patch-square-sdk] Package not found, skipping')
  process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (pkg.main === './src/index.ts') {
  console.log('[patch-square-sdk] Already patched')
  process.exit(0)
}

pkg.main = './src/index.ts'
if (pkg.exports && pkg.exports['.']) {
  pkg.exports['.'].default = './src/index.ts'
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('[patch-square-sdk] Patched main → ./src/index.ts')
