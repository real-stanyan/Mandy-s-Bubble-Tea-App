import { axisKindFor, axisOptions, iceLevel, nearestIndex, shortLabel, sugarPercent } from './option-axis'

// Catalog order as Square returns it (2026-09-06), deliberately unsorted.
const SUGAR = ['Standard Sugar', 'Less Sugar (75%)', 'Half Sugar', 'Little Sugar (25%)', 'No Sugar', 'Extra Sugar'].map(
  (name) => ({ name }),
)
const ICE = ['Normal Ice', 'Less Ice', 'Extra Ice', 'No Ice', 'Warm'].map((name) => ({ name }))

describe('axis kind', () => {
  it('puts SUGAR and ICE lists (in every spelling Square has) on a slider', () => {
    expect(axisKindFor('SUGAR')).toBe('sugar')
    expect(axisKindFor('SUGAR LEVEL')).toBe('sugar')
    expect(axisKindFor('ICE')).toBe('ice')
    expect(axisKindFor('Ice Level')).toBe('ice')
  })

  it('leaves toppings, milk and size as they are', () => {
    expect(axisKindFor('TOPPING')).toBeNull()
    expect(axisKindFor('AlTERNATIVE MILK')).toBeNull()
    expect(axisKindFor('SIZE')).toBeNull()
    expect(axisKindFor(undefined)).toBeNull()
  })
})

describe('sugar axis', () => {
  it('orders the real options from none to extra', () => {
    expect(axisOptions('sugar', SUGAR).map((o) => o.option.name)).toEqual([
      'No Sugar',
      'Little Sugar (25%)',
      'Half Sugar',
      'Less Sugar (75%)',
      'Standard Sugar',
      'Extra Sugar',
    ])
  })

  it('labels ticks as percentages', () => {
    expect(axisOptions('sugar', SUGAR).map((o) => o.short)).toEqual(['0%', '25%', '50%', '75%', '100%', '125%'])
  })

  it('agrees with the cup preview on every name', () => {
    expect(sugarPercent('Standard Sugar')).toBe(100)
    expect(sugarPercent('Less Sugar (75%)')).toBe(75)
    expect(sugarPercent('Half Sugar')).toBe(50)
    expect(sugarPercent('Little Sugar (25%)')).toBe(25)
    expect(sugarPercent('No Sugar')).toBe(0)
    expect(sugarPercent('Extra Sugar')).toBe(125)
  })

  it('handles the shorter lists some drinks carry', () => {
    const two = axisOptions('sugar', [{ name: 'Standard Sugar' }, { name: 'Extra Sugar' }])
    expect(two.map((o) => o.short)).toEqual(['100%', '125%'])
  })
})

describe('ice axis', () => {
  it('runs warm → no ice → less → normal → extra', () => {
    expect(axisOptions('ice', ICE).map((o) => o.option.name)).toEqual([
      'Warm',
      'No Ice',
      'Less Ice',
      'Normal Ice',
      'Extra Ice',
    ])
    expect(axisOptions('ice', ICE).map((o) => o.short)).toEqual(['Warm', 'None', 'Less', 'Normal', 'Extra'])
  })

  it('works without Warm (the four-option list)', () => {
    expect(axisOptions('ice', ICE.slice(0, 4)).map((o) => o.short)).toEqual(['None', 'Less', 'Normal', 'Extra'])
    expect(iceLevel('Hot')).toBe(-1)
  })
})

describe('unknown names', () => {
  it('still get a slot, after the known ones, with their own name as the label', () => {
    const out = axisOptions('sugar', [{ name: 'Honey (new)' }, ...SUGAR])
    expect(out[out.length - 1]!.option.name).toBe('Honey (new)')
    expect(out[out.length - 1]!.short).toBe('Honey (new)')
    expect(shortLabel('ice', 'Slushy')).toBe('Slushy')
  })
})

describe('nearest index', () => {
  it('rounds to the closest tick and clamps to the track', () => {
    expect(nearestIndex(2.4, 6)).toBe(2)
    expect(nearestIndex(2.6, 6)).toBe(3)
    expect(nearestIndex(-3, 6)).toBe(0)
    expect(nearestIndex(9, 6)).toBe(5)
  })

  it('skips a disabled tick to the nearest enabled one, by distance', () => {
    // Warm (index 0) disabled by cheese cream: a release near it lands on No Ice.
    expect(nearestIndex(0.2, 5, [true, false, false, false, false])).toBe(1)
    // Disabled in the middle: whichever enabled neighbour the finger is closer to.
    expect(nearestIndex(1.6, 5, [false, false, true, false, false])).toBe(1)
    expect(nearestIndex(2.3, 5, [false, false, true, false, false])).toBe(3)
    expect(nearestIndex(2.7, 5, [false, false, true, false, false])).toBe(3)
  })

  it('returns the target when everything is disabled rather than looping', () => {
    expect(nearestIndex(1, 3, [true, true, true])).toBe(1)
  })
})
