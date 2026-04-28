#!/usr/bin/env node
// Force the [CP] Square In-App Payments SDK Setup build phase to be the LAST
// phase in the target's buildPhases. The Square SDK setup script must run
// AFTER [CP] Embed Pods Frameworks (otherwise the App Store rejects the
// upload with code 90205 / 90206 — disallowed nested Frameworks inside
// SquareInAppPaymentsSDK.framework — and code 90035 — unsigned `setup`
// file).
//
// The Podfile post_install hook calls this, but Cocoapods integrates the
// freshly-added Pods phases (Embed Pods Frameworks, Copy Pods Resources,
// etc.) AFTER post_install returns, so the post_install run can't always
// see the final phase order. Always re-run this script standalone after
// `pod install` finishes to be sure:
//
//     cd ios && pod install && node fix-square-build-order.js
const fs = require('fs');
const path = require('path');
const iosDir = __dirname;
const entries = fs.readdirSync(iosDir);
const xcodeproj = entries.find(e => e.endsWith('.xcodeproj'));
if (!xcodeproj) { console.log('[SQIP] No xcodeproj'); process.exit(0); }
const pbxprojPath = path.join(iosDir, xcodeproj, 'project.pbxproj');
let content = fs.readFileSync(pbxprojPath, 'utf8');
const re = /(buildPhases\s*=\s*\()([\s\S]*?)(\);)/;
const m = content.match(re);
if (!m) { console.log('[SQIP] No buildPhases block'); process.exit(0); }
const lines = m[2].trim().split('\n').map(l => l.trim()).filter(Boolean);
const si = lines.findIndex(l => l.includes('Square In-App Payments SDK Setup'));
if (si === -1) { console.log('[SQIP] Setup phase not found in buildPhases'); process.exit(0); }
if (si === lines.length - 1) { console.log('[SQIP] Already last — no change'); process.exit(0); }
const [sl] = lines.splice(si, 1);
lines.push(sl);
const nb = '\n' + lines.map(l => '\t\t\t\t' + l).join('\n') + '\n\t\t\t';
content = content.replace(re, '$1' + nb + '$3');
fs.writeFileSync(pbxprojPath, content);
console.log('[SQIP] Moved Square setup phase to last position');
