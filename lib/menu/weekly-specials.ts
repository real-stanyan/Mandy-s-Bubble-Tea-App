// This week's specials shelf: a virtual, code-defined category (not a real
// Square category) pinned first on the Menu tab. Square holds the CURRENT
// (discounted) price directly — Stan edits it there. This file is the only
// place the ORIGINAL price is remembered, so the UI can show the
// struck-through comparison. Kept in sync with the web repo's config of the
// same name (src/lib/menu/weekly-specials.ts) — update both when the promo
// rotates.
//
// Names must match the Square catalog item name EXACTLY (case-insensitive) —
// a mismatch fails silently (the item just won't show as a special), so
// double-check against Square Dashboard > Items, not the poster copy.

export const WEEKLY_SPECIALS_CATEGORY_ID = 'weekly-specials'
export const WEEKLY_SPECIALS_CATEGORY_NAME = 'WEEKLY SPECIALS'

export type WeeklySpecial = {
  name: string
  originalPriceCents: number
}

export const WEEKLY_SPECIALS: WeeklySpecial[] = [
  { name: 'Grapefruit Black Tea', originalPriceCents: 620 },
  { name: 'Grapefruit Iced Green Tea', originalPriceCents: 620 },
  { name: 'Blueberry Iced Green Tea', originalPriceCents: 620 },
  { name: 'Honeydew Milk Tea', originalPriceCents: 620 },
  { name: 'Blueberry Slushy', originalPriceCents: 620 },
]

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * The original (pre-discount) price for this item, or null if it isn't
 * currently a weekly special. Compare against the item's live price before
 * rendering a strikethrough — if Stan hasn't dropped the price yet, or
 * already restored it, there's nothing to show.
 */
export function originalPriceCentsFor(itemName: string): number | null {
  const hit = WEEKLY_SPECIALS.find((s) => norm(s.name) === norm(itemName))
  return hit ? hit.originalPriceCents : null
}

/** Names in display order, normalized — used to build the virtual shelf. */
export function orderedWeeklySpecialNames(): string[] {
  return WEEKLY_SPECIALS.map((s) => norm(s.name))
}
