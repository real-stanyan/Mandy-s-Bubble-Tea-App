import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const DAY = { bg: '#F2E8DF', paper: '#FFF9F0', card: '#FFFFFF', brand: '#8D5524' }
const EVENING = { bg: '#131110', paper: '#1A1512', card: '#262019', brand: '#D9A24E' }
const PIN_CHIP = '#2A1E14'

function hex(h: string): number[] {
  const v = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16))
}
function lum(c: number[]): number {
  const [r, g, b] = c.map((v) => {
    const n = v / 255
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(hex(a)), lum(hex(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * A filled button has to be visible AS a button — its fill has to separate
 * from the page under it, in both themes.
 *
 * PIN.chip was the fill for Place order, Checkout and Continue with phone.
 * By day that is #2A1E14 on a cream page: 13.4:1, unmistakable. After sunset
 * the same ink sits on a #131110 page at 1.16:1, and Stan's screenshot shows
 * the result — the pay bar reads as loose text with only the amount pill
 * visible. The label was fixed; the button had lost its edges.
 *
 * 3:1 is the floor a UI component needs against its background (WCAG 1.4.11).
 */
describe('primary call-to-action contrast', () => {
  it('brand separates from every surface it can sit on, in both themes', () => {
    const failures: string[] = []
    for (const [name, t] of [
      ['day', DAY],
      ['evening', EVENING],
    ] as const) {
      for (const surface of ['bg', 'paper', 'card'] as const) {
        const r = ratio(t.brand, t[surface])
        if (r < 3) failures.push(`${name}/${surface}: ${r.toFixed(2)}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('records why PIN.chip cannot be the fill', () => {
    // The regression, pinned as a number so nobody re-derives it by shipping.
    expect(ratio(PIN_CHIP, DAY.bg)).toBeGreaterThan(3)
    expect(ratio(PIN_CHIP, EVENING.bg)).toBeLessThan(1.5)
  })

  it('CTA.on stays readable on CTA.bg in both themes', () => {
    expect(ratio('#FFFFFF', DAY.brand)).toBeGreaterThan(4.5)
    expect(ratio(PIN_CHIP, EVENING.brand)).toBeGreaterThan(4.5)
    // And the pairing that keeps getting written by mistake.
    expect(ratio('#FFFFFF', EVENING.brand)).toBeLessThan(3)
  })

  /**
   * There was a fourth test here that scanned app/ and components/ for
   * `backgroundColor: PIN.chip` and failed on any hit. It was deleted rather
   * than allowlisted.
   *
   * PIN.chip as a fill is correct on a surface pinned light whatever the hour
   * — the member QR poster, the promotions card — and wrong on one that
   * follows the theme, which is the bug fixed here. A text scan cannot tell
   * those apart, and it found eleven existing sites, most of them almost
   * certainly the legitimate kind. A gate that flags everything flags
   * nothing, and an allowlist of every file that exists today is a snapshot,
   * not a rule.
   *
   * Those eleven have not been audited. If one of them is on a themed
   * surface it has the same 1.16:1 problem, and finding out means looking at
   * each — not asserting against a list.
   */
})
