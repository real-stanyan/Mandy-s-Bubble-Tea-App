export const BRAND = {
  name: "Mandy's Bubble Tea",
  address: '34 Davenport St, Southport QLD 4215',
  phone: '0404 978 238',
  color: '#8D5524',
  secondaryColor: '#A2AD91',
  tertiaryColor: '#FFB380',
  accentColor: '#FFF9F0',
} as const

export const LOYALTY = {
  starsForReward: 9,
  rewardName: 'Free Drink of Your Choice',
} as const

// ---- Limited-time campaigns ----
// Home "Buy 2 drinks, get a fragrance-tag blind box" promo. Flip to false
// to retire the campaign — the home card disappears, no other cleanup.
export const FRAGRANCE_BLIND_BOX_PROMO = false

// Map of Square category name → canonical app slug. Keys are the current
// Square Dashboard category names; slugs flow into home tiles, deep
// links, and banner keys.
export const CATEGORY_SLUGS: Record<string, string> = {
  'TOP 10': 'top-10',
  'MILK TEA': 'milk-tea',
  'FRUITY GREEN TEA': 'fruity-green-tea',
  'FRUITY BLACK TEA': 'fruity-black-tea',
  'FRESH BREW': 'fresh-brew',
  'FROZEN': 'frozen',
  'CHEESE CREAM': 'cheese-cream',
  'SPECIAL MIX': 'special-mix',
}

// ---- Card surcharge ----
// Mirrors the SUBTOTAL_PHASE Square service charge attached in /api/orders.
export const CARD_SURCHARGE = {
  name: 'Card Surcharge',
  /** Percentage as a string — matches Square's OrderServiceCharge.percentage. */
  percentage: '1.9',
} as const

/** 1.9% as basis-points-per-10000 for BigInt math: 190 / 10000. */
export const CARD_SURCHARGE_BPS = 190n

// ---- Platform Fee ----
// Additional online-ordering pass-through. Same SUBTOTAL_PHASE pattern as
// CARD_SURCHARGE; visible to the customer on every receipt surface.
export const PLATFORM_FEE = {
  name: 'Platform Fee',
  percentage: '0.5',
} as const

/** 0.5% as basis-points-per-10000 for BigInt math: 50 / 10000. */
export const PLATFORM_FEE_BPS = 50n

// ---- Public holiday surcharge ----

export const PH_SURCHARGE = {
  name: 'Public holiday surcharge',
  percentage: '10',
} as const

/** 10% as basis-points-per-10000 for BigInt math: 1000 / 10000. */
export const PH_SURCHARGE_BPS = 1000n

export type PublicHolidayDef = {
  name: string
  date: string       // YYYY-MM-DD in Brisbane TZ
  startHour?: number // Brisbane local hour; default 0 (whole day)
}

// QLD 2026 public holidays.
// TODO: refresh for 2027 before 2026-12-31.
export const PUBLIC_HOLIDAYS_2026: PublicHolidayDef[] = [
  { name: "New Year's Day",        date: '2026-01-01' },
  { name: 'Australia Day',         date: '2026-01-26' },
  { name: 'Good Friday',           date: '2026-04-03' },
  { name: 'Easter Saturday',       date: '2026-04-04' },
  { name: 'Easter Sunday',         date: '2026-04-05' },
  { name: 'Easter Monday',         date: '2026-04-06' },
  { name: 'ANZAC Day',             date: '2026-04-25' },
  { name: 'Labour Day',            date: '2026-05-04' },
  { name: "King's Birthday",       date: '2026-10-05' },
  { name: 'Christmas Eve',         date: '2026-12-24', startHour: 18 },
  { name: 'Christmas Day',         date: '2026-12-25' },
  { name: 'Boxing Day',            date: '2026-12-26' },
  { name: 'Boxing Day (observed)', date: '2026-12-28' },
]
