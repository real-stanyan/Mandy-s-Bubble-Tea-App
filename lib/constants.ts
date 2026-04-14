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

export const CATEGORY_SLUGS: Record<string, string> = {
  'MILKY': 'milky',
  'FRUITY': 'fruity',
  'SPECIAL MIX': 'special-mix',
  'FRESH BREW': 'fresh-brew',
  'FRUITY BLACK TEA': 'fruity-black-tea',
  'FROZEN': 'frozen',
  'CHEESE CREAM': 'cheese-cream',
}
