/**
 * Expo config plugin: injects a post_install hook into the Podfile
 * that calls a Node script to reorder Xcode build phases.
 *
 * The Square SDK setup script must run AFTER "Embed Pods Frameworks".
 */
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

function withEmbedSquareFrameworks(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot
      const podfilePath = path.join(iosDir, 'Podfile')

      if (!fs.existsSync(podfilePath)) return config

      let podfile = fs.readFileSync(podfilePath, 'utf8')
      if (podfile.includes('fix-square-build-order')) return config

      // Write the fix script into the ios/ directory
      const fixScriptPath = path.join(iosDir, 'fix-square-build-order.js')
      fs.writeFileSync(fixScriptPath, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const iosDir = __dirname;
const entries = fs.readdirSync(iosDir);
const xcodeproj = entries.find(e => e.endsWith('.xcodeproj'));
if (!xcodeproj) { console.log('[SQIP] No xcodeproj'); process.exit(0); }
const pbxprojPath = path.join(iosDir, xcodeproj, 'project.pbxproj');
let content = fs.readFileSync(pbxprojPath, 'utf8');
const re = /(buildPhases\\s*=\\s*\\()([\\s\\S]*?)(\\);)/;
const m = content.match(re);
if (!m) { console.log('[SQIP] No buildPhases'); process.exit(0); }
const lines = m[2].trim().split('\\n').map(l => l.trim()).filter(Boolean);
const ei = lines.findIndex(l => l.includes('Embed Pods Frameworks'));
const si = lines.findIndex(l => l.includes('Square In-App Payments SDK Setup'));
if (ei === -1 || si === -1 || si > ei) { console.log('[SQIP] OK or not found'); process.exit(0); }
const [sl] = lines.splice(si, 1);
const nei = lines.findIndex(l => l.includes('Embed Pods Frameworks'));
lines.splice(nei + 1, 0, sl);
const nb = '\\n' + lines.map(l => '\\t\\t\\t\\t' + l).join('\\n') + '\\n\\t\\t\\t';
content = content.replace(re, '$1' + nb + '$3');
fs.writeFileSync(pbxprojPath, content);
console.log('[SQIP] Reordered build phases');
`)

      // Inject system() call right before the closing "end" of post_install
      // The Podfile ends with:
      //   ...react_native_post_install(...)
      //   end
      // end
      //
      // We want to insert before the first "end" after react_native_post_install
      const insertLine = '    system("node", "' + fixScriptPath.replace(/\\/g, '/') + '")'
      const marker = '    # [SQIP] fix-square-build-order'

      // Replace the pattern: react_native_post_install(...)\n  end\nend
      // with: react_native_post_install(...)\n  [our code]\n  end\nend
      podfile = podfile.replace(
        /(react_native_post_install\([\s\S]*?\)\n)(\s+end\nend)/,
        `$1\n${marker}\n${insertLine}\n$2`
      )

      fs.writeFileSync(podfilePath, podfile)
      return config
    },
  ])
}

module.exports = withEmbedSquareFrameworks
