import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOTS = ['app', 'components']
const SELF = 'theme-surfaces.test.ts'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') && entry !== SELF) {
      out.push(full)
    }
  }
  return out
}

/**
 * T.ink is a TEXT colour. Using it as a surface says "dark background", which
 * is only true before sunset — Evening Mode flips it to #F5EDE1, and whatever
 * sat on top was chosen to read against dark ink.
 *
 * That shipped three times, all invisible after 18:00:
 *   - checkout.tsx  the Place order button: T.ink pill, T.cream label. T.cream
 *                   has no evening override, so pale label on pale pill. The
 *                   customer could not read the control that takes their money
 *                   (screenshot, 2026-08-13).
 *   - order.tsx     the sign-in button: T.ink pill, #fff label.
 *   - BreathingGlow the launch backdrop, which also stopped matching the
 *                   native splash colour app.json pins to #2A1E14.
 *
 * PIN exists for exactly this: a deliberately-dark chip keeps day values so
 * its light-on-dark contrast survives the theme. The rule is mechanical, so
 * check it mechanically rather than hoping the next person reads the comment
 * in constants/theme.ts — the first two of these landed after that comment
 * was written.
 */
describe('theme surfaces', () => {
  const files = ROOTS.flatMap((r) => sourceFiles(r))

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('never uses the ink text token as a background', () => {
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        // T.ink / T.ink2 / T.ink3 — any of them as a surface has the same
        // inversion problem. PIN.chip is the pinned alternative.
        if (/backgroundColor:\s*T\.ink\b/.test(line)) {
          offenders.push(`${file.replace(/\\/g, '/')}:${i + 1} — use PIN.chip`)
        }
      })
    }
    // Jest's expect takes no message argument, so the offending paths have to
    // BE the assertion for the failure to say which file is wrong.
    expect(offenders).toEqual([])
  })
})
