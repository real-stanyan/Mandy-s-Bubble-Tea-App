# Square API — App Integration

## Architecture

The app does NOT call Square API directly. All Square calls go through the **existing Next.js backend** (or a dedicated API server). The app is a client that talks to REST endpoints.

```
App → fetch('https://mandybubbletea.com/api/catalog') → Next.js API route → Square API
```

## API Base URL

```typescript
// lib/api.ts
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}
```

## Environment Variables

```bash
# In .env or app.json extra
EXPO_PUBLIC_API_BASE_URL=https://mandybubbletea.com
EXPO_PUBLIC_SQUARE_APP_ID=           # Only if using In-App Payments SDK directly
EXPO_PUBLIC_SQUARE_LOCATION_ID=
```

## BigInt Handling

BigInt is serialized to string on the server side. The app receives money amounts as **string or number**. Always convert to number for display:

```typescript
// lib/utils.ts
export const toDollars = (cents: number | string): number => Number(cents) / 100
export const formatPrice = (cents: number | string): string =>
  `A$${toDollars(cents).toFixed(2)}`
```

## Error Handling

```typescript
// lib/api.ts
export async function safeApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await apiFetch<T>(path, options)
    return { data, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Something went wrong' }
  }
}
```

## Constants

```typescript
// lib/constants.ts
export const BRAND = {
  name: "Mandy's Bubble Tea",
  address: '34 Davenport St, Southport QLD 4215',
  phone: '0404 978 238',
  color: '#C43A10',
  accentColor: '#F5E6C8',
} as const

export const LOYALTY = {
  starsForReward: 9,
  rewardName: 'Free Drink of Your Choice',
} as const

export const MENU_CATEGORIES = [
  'MILKY', 'FRUITY', 'SPECIAL MIX',
  'FRESH BREW', 'FRUITY BLACK TEA', 'FROZEN', 'CHEESE CREAM',
] as const
```

## Phone Number Formatting (AU)

```typescript
export function formatAUPhone(phone: string): string {
  return phone.startsWith('+61')
    ? phone
    : `+61${phone.replace(/^0/, '')}`
}
```
