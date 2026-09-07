import { miniCartCue, restingOpacity } from './mini-cart'

describe('mini cart cue table', () => {
  it('does nothing on the first run after mount', () => {
    expect(miniCartCue(null, 3)).toEqual({ enter: false, bump: false, rest: false })
  })

  it('enters when the cart goes from empty to holding something', () => {
    expect(miniCartCue(0, 1)).toEqual({ enter: true, bump: true, rest: false })
  })

  it('bumps, without re-entering, when a drink joins a visible cart', () => {
    expect(miniCartCue(1, 2)).toEqual({ enter: false, bump: true, rest: false })
  })

  it('stays still when the count drops but the cart is still not empty', () => {
    expect(miniCartCue(3, 1)).toEqual({ enter: false, bump: false, rest: false })
  })

  it('parks the resting pose on empty, never the hidden one', () => {
    expect(miniCartCue(2, 0)).toEqual({ enter: false, bump: false, rest: true })
  })
})

describe('the bar is never left invisible with a full cart', () => {
  // The regression this file exists for. Every one of these ends on a
  // non-empty cart, so every one must settle fully opaque — including the
  // sequences that pass through zero, which is where the old version parked
  // opacity at 0 and had exactly one edge to get it back.
  const sequences: readonly (readonly number[])[] = [
    [1],
    [0, 1],
    [1, 0, 1],
    [1, 2, 3, 0, 1],
    [2, 0, 2, 0, 2],
    [1, 1, 1, 0, 0, 1],
    [3, 1, 0, 5],
    // Counts the runtime skipped: a batched render can hand the bar 0 then 2
    // with nothing in between, or jump 2 -> 0 -> 3 in one go.
    [2, 0, 3],
    [0, 4],
    [5, 0, 0, 0, 1],
  ]

  it.each(sequences.map((s) => [s.join(' -> '), s] as const))(
    'settles opaque after %s',
    (_label, counts) => {
      expect(restingOpacity(counts)).toBe(1)
    },
  )

  it('holds for every short sequence of counts ending non-empty', () => {
    const counts = [0, 1, 2, 3]
    for (const a of counts) {
      for (const b of counts) {
        for (const c of counts) {
          if (c === 0) continue
          expect(restingOpacity([a, b, c])).toBe(1)
        }
      }
    }
  })
})
