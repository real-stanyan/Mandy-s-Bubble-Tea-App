# Catalog — Menu & Items

## API Endpoints (served by Next.js backend)

### GET /api/catalog
Returns all items and categories from Square.

```typescript
const { items, categories } = await apiFetch<{
  items: CatalogItem[]
  categories: CatalogCategory[]
}>('/api/catalog')
```

### GET /api/catalog/[id]
Returns single item with variations.

## Screens

- **Menu Tab** — category list (7 categories as image cards, vertical scroll)
- **Category Screen** `menu/[category]` — items in that category (grid or list)

## Category Slugs

| Display name | Slug |
|---|---|
| MILKY | `milky` |
| FRUITY | `fruity` |
| SPECIAL MIX | `special-mix` |
| FRESH BREW | `fresh-brew` |
| FRUITY BLACK TEA | `fruity-black-tea` |
| FROZEN | `frozen` |
| CHEESE CREAM | `cheese-cream` |

## Key Components

- `CategoryList` — scrollable list of category image cards (FlatList or ScrollView)
- `ItemCard` — product image, name, price, "Add to cart" button
- Use `expo-image` `<Image>` for all product/category images (caching, placeholder built-in)

## Types

```typescript
// types/square.ts
export interface CatalogItem {
  id: string
  type: string
  imageUrl?: string
  itemData?: {
    name?: string
    description?: string
    categories?: Array<{ id: string; name?: string }>
    variations?: CatalogItemVariation[]
  }
}

export interface CatalogItemVariation {
  id: string
  itemVariationData?: {
    name?: string
    priceMoney?: { amount?: number | string; currency?: string }
  }
}
```

## Notes

- Images come from Square Catalog — uploaded in Square Dashboard
- Variations = different sizes/options for one item
- Default to first variation price if no selection UI needed
- Consider pull-to-refresh for catalog data
