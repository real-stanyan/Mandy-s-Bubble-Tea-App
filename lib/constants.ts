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

export const STORAGE_KEYS = {
  phone: 'mbt:account:phone',
  deviceToken: 'mbt_account_deviceToken',
  name: 'mbt:account:name',
} as const

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
