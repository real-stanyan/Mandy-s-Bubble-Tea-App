import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Lives in lib/, not app/: expo-router pulls every file under app/ into the
// bundle, and node:fs in there breaks the Metro build (see
// constants/login-typography.test.ts for the first time that happened).

const ROOTS = ['app', 'components']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const files = ROOTS.flatMap((r) => sourceFiles(r))
const read = (f: string) => readFileSync(f, 'utf8')
const rel = (f: string) => f.replace(/\\/g, '/')

/**
 * The motion vocabulary (lib/motion) is decorative by definition: a pour, a
 * pulse, a slide, a flight. Every screen or component that uses it has to
 * be able to not — Reduce Motion is the one accessibility setting a motion
 * pass can violate silently, because nothing breaks, it just keeps moving.
 * The rule is mechanical, so it is checked mechanically.
 */
describe('motion vocabulary respects Reduce Motion', () => {
  const consumers = files.filter((f) => /from '@\/lib\/motion\//.test(read(f)))

  it('finds the vocabulary in use', () => {
    expect(consumers.length).toBeGreaterThanOrEqual(5)
  })

  it('every consumer reads useReducedMotion', () => {
    const offenders = consumers.filter((f) => !/useReducedMotion\(/.test(read(f))).map(rel)
    expect(offenders).toEqual([])
  })

  it('every looping animation in the new motion components can be switched off', () => {
    const NEW = ['components/brand/LiquidCup.tsx', 'components/menu/CupPreview.tsx']
    for (const f of NEW) {
      const src = read(f)
      expect(src).toMatch(/withRepeat\(/)
      expect(src).toMatch(/useReducedMotion\(/)
      // A loop that is started must also be stopped when the component goes.
      expect(src).toMatch(/cancelAnimation\(/)
    }
  })

  it('the live dot rides the ambient clock, not a loop of its own', () => {
    // A ring pulsing at the display rate on every page that showed the shop
    // open was a shadow-tree commit per frame on Android, at rest, and on
    // pages nobody was looking at (2026-09-11).
    const src = read('components/ui/PulseDot.tsx')
    expect(src).toMatch(/\bambientClock\b/)
    expect(src).toMatch(/useReducedMotion\(/)
    expect(src).not.toMatch(/withRepeat\(/)
  })
})

/**
 * rn-svg groups animate through their NATIVE props only (`matrix`,
 * `opacity`); translateX/Y on a <G> are folded into `matrix` at JS render
 * time and do nothing from a worklet. Two shipped cup animations have
 * already been written the wrong way once (#122). Any animatedProps that
 * names translateX/translateY in an SVG file is that bug coming back.
 */
describe('svg groups animate native props', () => {
  const svgFiles = files.filter((f) => /from 'react-native-svg'/.test(read(f)) && /useAnimatedProps\(/.test(read(f)))

  it('covers the animated cups', () => {
    expect(svgFiles.map(rel)).toEqual(
      expect.arrayContaining(['components/brand/LiquidCup.tsx', 'components/menu/CupPreview.tsx']),
    )
  })

  it('never animates translateX/translateY/x/y on a group', () => {
    const offenders: string[] = []
    for (const f of svgFiles) {
      const src = read(f)
      const blocks = src.match(/useAnimatedProps\(\(\) => \(\{[\s\S]*?\}\)\)/g) ?? []
      for (const b of blocks) {
        if (/\b(translateX|translateY|x|y)\s*:/.test(b)) offenders.push(`${rel(f)}: ${b.slice(0, 80)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

/**
 * react-native-svg on Android rasterises a whole <Svg> into a fresh software
 * bitmap on every change to any part of it, so a drawing that moves costs a
 * bitmap the size of the drawing per tick, on the UI thread (2026-09-11:
 * iOS smooth after the ambient clock, Android still not). Every SVG scene
 * therefore gates its motion on SVG_MOTION (lib/motion/ambient), which is
 * false on Android. A new scene that forgets is Android stuttering again.
 */
describe('svg scenes hold still on Android', () => {
  const SCENES = [
    'components/brand/CategoryArt.tsx',
    'components/brand/CheckoutHero.tsx',
    'components/brand/OrderHero.tsx',
    'components/menu/CupPreview.tsx',
    'components/brand/LiquidCup.tsx',
  ]

  it.each(SCENES)('%s gates its motion on SVG_MOTION', (f) => {
    expect(read(f)).toMatch(/\bSVG_MOTION\b/)
  })

  it('SVG_MOTION is the platform switch', () => {
    const src = read('lib/motion/ambient.ts')
    expect(src).toMatch(/export const SVG_MOTION = Platform\.OS !== 'android'/)
  })
})

/**
 * The light round the bottom dock (components/ui/DockGlow) breathes,
 * follows the pill and the pager, and flares, under the tab bar on every
 * page. Its pool is an <Svg>, and any change to an <Svg> re-rasterises it in
 * software on Android (above), so the pool is a drawing made once and every
 * bit of the light's motion is on the views that hold it. A glow that
 * animated its drawing would put a bitmap per tick back under the tab bar.
 */
describe('the dock glow never redraws its drawings', () => {
  it('draws its light as a static SVG', () => {
    const src = read('components/ui/Glow.tsx')
    expect(src).not.toMatch(/useAnimatedProps|animatedProps|createAnimatedComponent|react-native-reanimated/)
  })

  it('moves only the views around the drawings', () => {
    const src = read('components/ui/DockGlow.tsx')
    expect(src).not.toMatch(/useAnimatedProps|animatedProps/)
    expect(src).toMatch(/<GlowBlob/)
  })

  it('lights the floating controls with a shadow, never a drawing', () => {
    // The item sheet's stepper and Add to cart, and checkout's Place order,
    // float in the dock's light (components/ui/Halo): a box shadow the shape
    // of the control, breathing as a view's opacity. A drawing there would
    // be a bitmap per breath on Android.
    const src = read('components/ui/Halo.tsx')
    expect(src).not.toMatch(/react-native-svg|useAnimatedProps|animatedProps/)
    expect(src).toMatch(/boxShadow/)
  })
})

/**
 * The launch screen opens on the colour the native splash left behind, so
 * the hand-off has no seam. app.json owns that colour (expo-splash-screen
 * → backgroundColor); the screen must not drift from it.
 */
describe('launch screen matches the native splash', () => {
  it('starts on app.json’s splash background', () => {
    const appJson = JSON.parse(readFileSync('app.json', 'utf8'))
    const splash = appJson.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    )
    expect(splash).toBeDefined()
    const native = splash[1].backgroundColor as string
    const src = read('components/launch/LaunchScreen.tsx')
    const m = src.match(/const NATIVE_SPLASH_BG = '(#[0-9A-Fa-f]{6})'/)
    expect(m?.[1]).toBe(native)
  })

  it('ships the assets it draws', () => {
    for (const asset of ['assets/images/wordmark.webp', 'assets/images/grain.png']) {
      const size = statSync(asset).size
      expect(size).toBeGreaterThan(1000)
      expect(size).toBeLessThan(200 * 1024)
    }
  })

  it('is guarded so a crash cannot trap the app', () => {
    const gate = read('components/auth/AuthGate.tsx')
    expect(gate).toMatch(/class LaunchBoundary/)
    expect(gate).toMatch(/getDerivedStateFromError/)
    expect(gate).toMatch(/<LaunchBoundary onFail=/)
  })
})

/**
 * One radius per level, and a nested corner is the outer one minus the
 * padding — so the ladder must actually descend.
 */
describe('radius ladder', () => {
  it('descends card → tile → small, with pills on top', () => {
    const src = readFileSync('constants/theme.ts', 'utf8')
    const num = (k: string) => Number(src.match(new RegExp(`\\b${k}:\\s*(\\d+)`))?.[1])
    expect(num('pill')).toBe(999)
    expect(num('card')).toBeGreaterThan(num('tile'))
    expect(num('tile')).toBeGreaterThan(num('small'))
    expect(num('sheetTop')).toBeGreaterThanOrEqual(num('card'))
  })
})

/**
 * A frame function does not run here. It is serialised and called on the UI
 * thread, inside the `useAnimatedProps` in art-kit's Motion — so it, and
 * everything it reaches, has to carry a 'worklet' directive. Miss one and
 * react-native-worklets clones it as a RemoteFunction and throws the moment
 * the scene mounts: "Tried to synchronously call a non-worklet function on
 * the UI thread." That is a crash on the customer's screen, not a wrong
 * pixel, and it took the order hero down once already (#163) — one factory
 * out of ten was written `=> ({ … })`, and a concise arrow body has nowhere
 * to put the directive.
 *
 * Neither of the gates in place could see it: tsc types the return, and the
 * pure-function tests call it on the JS thread, where a plain function works
 * perfectly. So the check is on the source itself.
 *
 * The rule: in lib/motion, a function returned by a function IS a frame
 * function. It must be a block body, and the block must open with 'worklet'.
 */
describe('every frame function is a worklet', () => {
  const parser = require('@babel/parser') as typeof import('@babel/parser')

  const modules = readdirSync('lib/motion')
    .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => path.join('lib/motion', f))

  /** Every function literal that is handed back by another function. */
  function returnedFunctions(file: string): { line: number; ok: boolean }[] {
    const ast = parser.parse(read(file), { sourceType: 'module', plugins: ['typescript'] })
    const found: { line: number; ok: boolean }[] = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(walk)
      const n = node as { type?: string; argument?: any; loc?: any }
      if (n.type === 'ReturnStatement') {
        const a = n.argument
        if (a && (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')) {
          const directives = a.body?.type === 'BlockStatement' ? a.body.directives ?? [] : []
          found.push({
            line: a.loc?.start.line ?? 0,
            ok: directives.some((d: any) => d.value?.value === 'worklet'),
          })
        }
      }
      for (const [k, v] of Object.entries(n)) if (k !== 'loc') walk(v)
    }
    walk(ast.program.body)
    return found
  }

  it('finds the frame factories', () => {
    const total = modules.reduce((sum, m) => sum + returnedFunctions(m).length, 0)
    expect(total).toBeGreaterThanOrEqual(8)
  })

  it.each(modules)('%s returns only worklets', (mod) => {
    const offenders = returnedFunctions(mod)
      .filter((f) => !f.ok)
      .map((f) => `${rel(mod)}:${f.line}`)
    expect(offenders).toEqual([])
  })
})
