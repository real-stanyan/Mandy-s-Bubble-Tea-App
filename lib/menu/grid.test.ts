import {
  buildGridLayout,
  gridMetrics,
  pairs,
  titleCase,
  CARD_INFO_H,
  GRID_GAP,
  GRID_PAD,
  SECTION_H,
} from './grid'

describe('gridMetrics', () => {
  it('splits the width into two cards with the gap between and the pad outside', () => {
    const m = gridMetrics(390)
    expect(m.cardW).toBe(Math.floor((390 - GRID_PAD * 2 - GRID_GAP) / 2))
    expect(m.thumbH).toBe(m.cardW)
    expect(m.cardH).toBe(m.cardW + CARD_INFO_H)
    expect(m.rowH).toBe(m.cardH + GRID_GAP)
  })

  it('never produces a fractional card width (layout stays pixel-aligned)', () => {
    for (const w of [320, 375, 390, 393, 412, 430]) {
      expect(Number.isInteger(gridMetrics(w).cardW)).toBe(true)
    }
  })
})

describe('pairs', () => {
  it('chunks two to a row and leaves a lone card in the last row', () => {
    expect(pairs([1, 2, 3, 4, 5])).toEqual([[1, 2], [3, 4], [5]])
    expect(pairs([1, 2])).toEqual([[1, 2]])
    expect(pairs([])).toEqual([])
  })
})

describe('buildGridLayout', () => {
  const rowH = 250
  // Two sections: 2 rows, then 1 row.
  const layout = buildGridLayout([2, 1], rowH)

  it('walks header → rows → footer per section, with the fixed heights', () => {
    expect(layout(null, 0)).toEqual({ length: SECTION_H, offset: 0, index: 0 })
    expect(layout(null, 1)).toEqual({ length: rowH, offset: SECTION_H, index: 1 })
    expect(layout(null, 2)).toEqual({ length: rowH, offset: SECTION_H + rowH, index: 2 })
    // Footer of section 1: zero height.
    expect(layout(null, 3)).toEqual({ length: 0, offset: SECTION_H + rowH * 2, index: 3 })
    // Header of section 2 sits right after.
    expect(layout(null, 4)).toEqual({ length: SECTION_H, offset: SECTION_H + rowH * 2, index: 4 })
    expect(layout(null, 5)).toEqual({ length: rowH, offset: SECTION_H * 2 + rowH * 2, index: 5 })
  })

  it('answers past the end with a zero-length slot instead of throwing', () => {
    expect(layout(null, 99).length).toBe(0)
  })

  it('starts counting from the base offset (the padding under the floating head)', () => {
    const padded = buildGridLayout([1], rowH, 240)
    expect(padded(null, 0)).toEqual({ length: SECTION_H, offset: 240, index: 0 })
    expect(padded(null, 1)).toEqual({ length: rowH, offset: 240 + SECTION_H, index: 1 })
  })
})

describe('titleCase', () => {
  it('turns Square caps into a title', () => {
    expect(titleCase('MILK TEA')).toBe('Milk Tea')
    expect(titleCase('TOP 10')).toBe('Top 10')
    expect(titleCase('weekly specials')).toBe('Weekly Specials')
  })
})
