export const toDollars = (cents: number | string): number => Number(cents) / 100

export const formatPrice = (cents: number | string): string =>
  `A$${toDollars(cents).toFixed(2)}`

export function formatAUPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '')
  return cleaned.startsWith('+61')
    ? cleaned
    : `+61${cleaned.replace(/^0/, '')}`
}
