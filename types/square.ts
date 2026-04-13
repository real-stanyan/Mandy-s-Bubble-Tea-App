export interface CatalogCategory {
  id: string
  name: string
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

export interface CartItem {
  id: string
  variationId: string
  name: string
  price: number // cents
  quantity: number
  imageUrl?: string
  variationName?: string
}

export interface LoyaltyAccount {
  id: string
  balance: number
  lifetimePoints: number
  enrolledAt?: string
  availableRewards?: Array<{ id: string; status: string }>
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
  totalMoney?: { amount: number | string; currency: string }
  lineItems?: Array<{
    name: string
    quantity: string
    basePriceMoney: { amount: number | string; currency: string }
  }>
}
