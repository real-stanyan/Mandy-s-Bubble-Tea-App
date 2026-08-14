import { readFileSync } from 'node:fs'

const SRC = readFileSync('components/menu/ItemDetailContent.tsx', 'utf8')

/**
 * The topping rule lives in two codebases and is written twice — once in the
 * web menu's topping-rules.ts, once here, because the app computes it from
 * the list name rather than reading a bound off the API.
 *
 * They had already drifted: the web exempted Oreo from the cap for months
 * and the app did not, so the same drink cost a customer one of their three
 * toppings on a phone and nothing on the website. Nobody noticed because
 * both screens looked internally consistent.
 *
 * This does not check behaviour — a React Native screen is the wrong thing to
 * unit-test for that. It checks that the rule has not silently reverted to
 * the shape it had before, which is the failure that actually happened.
 */
describe('topping cap in the app', () => {
  it('caps the total, not the number of kinds', () => {
    expect(SRC).toContain('TOPPING_MAX_TOTAL = 3')
    // The old pair. Their return would mean nine toppings on a cup again.
    expect(SRC).not.toContain('TOPPING_MAX_DISTINCT')
    expect(SRC).not.toContain('TOPPING_MAX_PER_KIND')
  })

  it('exempts Oreo, like the web menu does', () => {
    expect(SRC).toContain('isUncountedTopping')
    expect(SRC).toMatch(/includes\('oreo'\)/)
  })

  it('tells the customer the rule it actually enforces', () => {
    // The caption said "3 kinds · max 3 of each" while describing a drink
    // that could carry nine. Whatever it says now must name the total.
    expect(SRC).toMatch(/toppings in total/)
    expect(SRC).not.toMatch(/kinds · max/)
  })
})
