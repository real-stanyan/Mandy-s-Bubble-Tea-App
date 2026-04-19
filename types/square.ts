export interface CatalogCategory {
  id: string
  name: string
}

export interface ModifierOption {
  id: string
  name: string
  priceCents: number | null
  ordinal: number
  onByDefault: boolean
}

export interface ModifierList {
  id: string
  name: string
  minSelected: number
  maxSelected: number | null
  modifiers: ModifierOption[]
}

export interface CatalogItemVariation {
  id: string
  itemVariationData?: {
    name?: string
    priceMoney?: { amount?: number | string; currency?: string }
  }
}

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

export interface CartModifier {
  id: string
  name: string
  listName: string // e.g. "SUGAR", "ICE", "TOPPING"
  priceCents: number
}

export interface CartItem {
  lineId: string // unique per variation + modifier combination
  id: string
  variationId: string
  name: string
  price: number // cents, including modifier add-ons
  quantity: number
  imageUrl?: string
  variationName?: string
  modifiers: CartModifier[]
}

export interface LoyaltyAccount {
  id: string
  balance: number
  lifetimePoints: number
  enrolledAt?: string
}

export interface LoyaltyEvent {
  id: string
  type: 'ACCUMULATE_POINTS' | 'REDEEM_REWARD' | string
  createdAt: string
  accumulatePoints?: { points: number; orderId?: string }
  redeemReward?: { rewardId: string }
}

export interface Order {
  id: string
  referenceId?: string
  totalMoney?: { amount: number | string; currency: string }
  lineItems?: Array<{
    name: string
    quantity: string
    basePriceMoney: { amount: number | string; currency: string }
  }>
}
