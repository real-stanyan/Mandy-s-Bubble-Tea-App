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
    const NEW = ['components/ui/PulseDot.tsx', 'components/brand/LiquidCup.tsx', 'components/menu/CupPreview.tsx']
    for (const f of NEW) {
      const src = read(f)
      expect(src).toMatch(/withRepeat\(/)
      expect(src).toMatch(/useReducedMotion\(/)
      // A loop that is started must also be stopped when the component goes.
      expect(src).toMatch(/cancelAnimation\(/)
    }
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
