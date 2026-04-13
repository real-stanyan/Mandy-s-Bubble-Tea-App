# Cart & Checkout

## Cart State (Zustand + AsyncStorage)

```typescript
// store/cart.ts
// Persisted to AsyncStorage as 'mandys-cart'
// Use zustand/middleware persist with AsyncStorage adapter

interface CartItem {
  id: string           // catalog object id
  variationId: string  // variation id (used as unique key)
  name: string
  price: number        // in cents
  quantity: number
  imageUrl?: string
}

// Actions: addItem, removeItem, updateQuantity, clearCart
// Computed: total() → cents, itemCount()
```

## Checkout Flow

```
Cart Screen → Checkout Screen → POST /api/orders → Payment → POST /api/payment → Order Confirmation
```

## Order Creation

```typescript
// POST /api/orders (on backend)
// Body: { items: CartItem[], pickupTime?: string }
// Returns: Square Order object with orderId

const order = await apiFetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({ items: cartItems }),
})
```

## Checkout Screen Logic

1. Show order summary (items, quantities, total)
2. Collect phone number (optional — for loyalty)
3. Call `/api/orders` to create order → get `orderId`
4. Present payment UI (Apple Pay / Google Pay / Card)
5. On payment success → `clearCart()` → navigate to order confirmation

## Phone Number Field

- Optional but encouraged ("Enter for loyalty stars")
- Pass to `/api/payment` for loyalty accrual after payment
- Persist to AsyncStorage so user doesn't re-enter

## Order Confirmation Screen

Show:
- Order number
- Items ordered
- Pickup location: 34 Davenport St, Southport QLD 4215
- Stars earned (if phone provided)
- Link to Account tab to check loyalty balance
- Haptic feedback on success (`expo-haptics`)
