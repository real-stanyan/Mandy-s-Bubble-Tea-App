// The menu grid's geometry, as pure maths: two cards to a row, sized from the
// window width, and every height fixed so SectionList can seek to any section
// by pixel offset (getItemLayout) instead of virtualising forward and firing
// onScrollToIndexFailed on far jumps. Kept out of the screen so the numbers
// can be unit-tested and so the skeleton draws the same shapes.

export const GRID_PAD = 16
export const GRID_GAP = 12

/** Name (two lines) + price row, with the card's inner padding. */
export const CARD_INFO_H = 96

/** The illustrated category card: marginTop 20 + card 144 + marginBottom 8. */
export const SECTION_CARD_H = 144
export const SECTION_H = 20 + SECTION_CARD_H + 8

export type GridMetrics = {
  /** One card, across. */
  cardW: number
  /** The photo ground: a square, so every cup has the same room. */
  thumbH: number
  cardH: number
  /** A row of two cards plus the gap below it. */
  rowH: number
}

export function gridMetrics(windowWidth: number): GridMetrics {
  const cardW = Math.floor((windowWidth - GRID_PAD * 2 - GRID_GAP) / 2)
  const thumbH = cardW
  const cardH = thumbH + CARD_INFO_H
  return { cardW, thumbH, cardH, rowH: cardH + GRID_GAP }
}

/** Two to a row; the last row may hold one. */
export function pairs<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += 2) {
    out.push(i + 1 < items.length ? [items[i], items[i + 1]] : [items[i]])
  }
  return out
}

/**
 * SectionList flat-index → { length, offset } for sections whose rows are all
 * `rowH` tall and whose headers are all `SECTION_H`. SectionList's flat index
 * counts, per section: the header, each row, then a (zero-height) footer.
 *
 * `baseOffset` is everything above the first cell in scroll coordinates —
 * the content padding that keeps the grid out from under the floating head,
 * plus any list header. VirtualizedList takes these offsets as absolute scroll
 * positions (and uses them to pick which cells to mount), so leaving that out
 * lands every seek a head-height short with a blank band under it.
 */
export function buildGridLayout(rowCounts: readonly number[], rowH: number, baseOffset = 0) {
  return (_data: unknown, flatIndex: number) => {
    let offset = baseOffset
    let counter = 0
    for (const rows of rowCounts) {
      if (counter === flatIndex) return { length: SECTION_H, offset, index: flatIndex }
      counter++
      offset += SECTION_H
      for (let i = 0; i < rows; i++) {
        if (counter === flatIndex) return { length: rowH, offset, index: flatIndex }
        counter++
        offset += rowH
      }
      if (counter === flatIndex) return { length: 0, offset, index: flatIndex }
      counter++
    }
    return { length: 0, offset, index: flatIndex }
  }
}

/** Square category names come in caps (MILK TEA); the rail reads them as titles. */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
