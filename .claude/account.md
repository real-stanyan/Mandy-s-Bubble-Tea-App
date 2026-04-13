# Account — Tab Screen

## Overview

No password login. Phone-number based lookup against Square API (via backend).

## States

```
1. No phone saved        → show phone input form
2. Loading               → ActivityIndicator
3. Account not found     → "Visit us in store" message + try again
4. Account found         → LoyaltyCard + OrderHistory + "Use different number"
5. Error                 → error message + retry
```

## Persistence

```typescript
// On successful lookup:
await AsyncStorage.setItem('mandy_phone', phoneNumber)

// On mount:
const saved = await AsyncStorage.getItem('mandy_phone')
if (saved) fetchLoyalty(saved)

// On "Use different number":
await AsyncStorage.removeItem('mandy_phone')
```

## Phone Input

- Placeholder: `04xx xxx xxx`
- `keyboardType="phone-pad"`
- Submit on done key or button press
- Format before API call: `formatAUPhone()`

## Screen Layout

```
1. <LoyaltyCard />             ← stars, progress, reward status
2. "Use a different number"    ← small text button
3. How it works box            ← cream bg #F5E6C8, rounded, 3 bullet points
4. Recent activity heading
5. <ActivityHistory />         ← FlatList of loyalty events
```

## How It Works Box Content

```
Buy any drink = earn 1 star
9 stars = 1 free drink of your choice
Show this screen at the counter to redeem
```

## Navigation

- Account is a **tab** in the bottom tab bar
- Tab icon: star or user icon
- Show badge on tab icon if phone is saved (indicating active loyalty)
