#!/usr/bin/env node
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
if (!m) { console.log('[SQIP] No buildPhases'); process.exit(0); }
const lines = m[2].trim().split('\n').map(l => l.trim()).filter(Boolean);
const ei = lines.findIndex(l => l.includes('Embed Pods Frameworks'));
const si = lines.findIndex(l => l.includes('Square In-App Payments SDK Setup'));
if (ei === -1 || si === -1 || si > ei) { console.log('[SQIP] OK or not found'); process.exit(0); }
const [sl] = lines.splice(si, 1);
const nei = lines.findIndex(l => l.includes('Embed Pods Frameworks'));
lines.splice(nei + 1, 0, sl);
const nb = '\n' + lines.map(l => '\t\t\t\t' + l).join('\n') + '\n\t\t\t';
content = content.replace(re, '$1' + nb + '$3');
fs.writeFileSync(pbxprojPath, content);
console.log('[SQIP] Reordered build phases');
