const BESTSELLER_NAMES = new Set([
  'Brown Sugar Milk Tea',
  'Mango Slushy',
  'Oreo Brulee Milk Tea',
  'Lychee Black Tea',
  'Red Dragon Fruit Slushy',
  'Taro Milk Tea',
])

export function isBestseller(name: string | undefined): boolean {
  if (!name) return false
  return BESTSELLER_NAMES.has(name)
}
