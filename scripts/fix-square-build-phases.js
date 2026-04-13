#!/usr/bin/env node
/**
 * Fix Square SDK build phase ordering.
 * Moves "[CP] Square In-App Payments SDK Setup" after "[CP] Embed Pods Frameworks".
 * Run this after `npx expo prebuild` / `pod install`.
 */
const fs = require('fs')
const path = require('path')

const iosDir = path.join(__dirname, '..', 'ios')
const entries = fs.readdirSync(iosDir)
const xcodeproj = entries.find((e) => e.endsWith('.xcodeproj'))
if (!xcodeproj) {
  console.log('[SQIP] No .xcodeproj found')
  process.exit(0)
}

const pbxprojPath = path.join(iosDir, xcodeproj, 'project.pbxproj')
let content = fs.readFileSync(pbxprojPath, 'utf8')

const buildPhasesRegex = /(buildPhases\s*=\s*\()([\s\S]*?)(\);)/
const match = content.match(buildPhasesRegex)
if (!match) {
  console.log('[SQIP] No buildPhases found')
  process.exit(0)
}

const lines = match[2]
  .trim()
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
const embedIdx = lines.findIndex((l) => l.includes('Embed Pods Frameworks'))
const setupIdx = lines.findIndex((l) =>
  l.includes('Square In-App Payments SDK Setup')
)

if (embedIdx === -1 || setupIdx === -1) {
  console.log('[SQIP] Phases not found, embed=' + embedIdx + ' setup=' + setupIdx)
  process.exit(0)
}
if (setupIdx > embedIdx) {
  console.log('[SQIP] Already in correct order')
  process.exit(0)
}

const [setupLine] = lines.splice(setupIdx, 1)
const newEmbedIdx = lines.findIndex((l) => l.includes('Embed Pods Frameworks'))
lines.splice(newEmbedIdx + 1, 0, setupLine)

const newBlock =
  '\n' + lines.map((l) => '\t\t\t\t' + l).join('\n') + '\n\t\t\t'
content = content.replace(buildPhasesRegex, '$1' + newBlock + '$3')
fs.writeFileSync(pbxprojPath, content)
console.log('[SQIP] Reordered: setup now after Embed Pods Frameworks')
