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

// Map of Square category name → canonical app slug. Both the original
// category names and the renamed ones keep pointing at the same app
// slug so existing home tiles / deep links keep working after a Square
// Dashboard rename.
export const CATEGORY_SLUGS: Record<string, string> = {
  'MILKY': 'milky',
  'MILK TEA': 'milky',
  'FRUITY': 'fruity',
  'FRUITY GREEN TEA': 'fruity',
  'SPECIAL MIX': 'special-mix',
  'FRESH BREW': 'fresh-brew',
  'FRUITY BLACK TEA': 'fruity-black-tea',
  'FROZEN': 'frozen',
  'CHEESE CREAM': 'cheese-cream',
  'TOP 10': 'top-10',
}
