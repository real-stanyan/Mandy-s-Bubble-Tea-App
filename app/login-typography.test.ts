import { readFileSync } from 'node:fs'

const SRC = readFileSync('app/login.tsx', 'utf8')
const STYLES = SRC.slice(SRC.indexOf('const styles = StyleSheet.create('))

/** Families loaded in app/_layout.tsx. Naming one that is not loaded does not
 *  throw — the text silently falls back to the system font, which is the
 *  whole bug this file exists to stop. */
const LOADED = [
  'ShantellSans_400Regular',
  'ShantellSans_500Medium',
  'ShantellSans_600SemiBold',
  'ShantellSans_700Bold',
  'JetBrainsMono_700Bold',
]

function styleBlocks(): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  // Single-line styles first: with the multi-line branch leading, a one-liner
  // matches it instead and swallows the block below it, so a violation gets
  // reported against its innocent neighbour. That is exactly what the first
  // run of this test did — it blamed dividerLine for dividerLabel's leftover
  // fontWeight.
  const re = /^ {2}([a-zA-Z0-9]+):\s*\{([^}\n]*)\},|^ {2}([a-zA-Z0-9]+):\s*\{([\s\S]*?)^ {2}\},/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(STYLES))) {
    out.push({ name: m[1] ?? m[3]!, body: m[2] ?? m[4] ?? '' })
  }
  return out
}

/**
 * Sign-in used to be set in Georgia with the system sans under it while the
 * rest of the app is Shantell Sans. Stan's words, looking at the rebuilt
 * screen: "字体没有统一".
 *
 * Two things make this worth a test rather than a careful read. Text with no
 * fontFamily silently takes the system font, so a missed style looks fine to
 * whoever wrote it and wrong beside everything else. And React Native ignores
 * fontWeight once a family is named, so a leftover fontWeight is not a style
 * that is heavier — it is a style whose author thought it was.
 */
describe('sign-in typography', () => {
  const blocks = styleBlocks()

  it('parses the stylesheet', () => {
    expect(blocks.length).toBeGreaterThan(20)
  })

  it('names a font family on every style that sets a size', () => {
    const missing = blocks
      .filter((b) => /fontSize/.test(b.body) && !/fontFamily/.test(b.body))
      .map((b) => b.name)
    expect(missing).toEqual([])
  })

  it('uses only families that are actually loaded', () => {
    const named = [...STYLES.matchAll(/fontFamily:\s*(?:TYPE\.(\w+)|'([^']+)')/g)]
    expect(named.length).toBeGreaterThan(10)
    const literals = named.map((m) => m[2]).filter(Boolean) as string[]
    for (const lit of literals) expect(LOADED).toContain(lit)
    // TYPE's own values are the other half of the promise.
    const typeMap = SRC.slice(SRC.indexOf('const TYPE = {'), SRC.indexOf('} as const'))
    for (const face of [...typeMap.matchAll(/'([^']+)'/g)].map((m) => m[1]!)) {
      expect(LOADED).toContain(face)
    }
  })

  it('carries no fontWeight, which a named family makes a lie', () => {
    const offenders = blocks.filter((b) => /fontWeight/.test(b.body)).map((b) => b.name)
    expect(offenders).toEqual([])
  })

  it('has no Georgia or generic serif left', () => {
    expect(STYLES).not.toMatch(/Georgia|'serif'/)
  })
})
