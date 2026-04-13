# Loyalty — Stars System

## Configuration (set in Square Dashboard — do not hardcode rules)

- 1 drink from any of 7 categories = **1 star**
- **9 stars** = Free Drink of Your Choice
- Configured under: Customers → Loyalty → Settings

## API Endpoints (on backend)

### GET /api/loyalty/account?phone=04xx
Looks up loyalty account by AU phone number.
Returns `{ account }` or `{ account: null }` if not found.

Key fields from `account`:
- `account.balance` → current stars
- `account.lifetimePoints` → total ever earned
- `account.availableRewards` → redeemable rewards
- `account.enrolledAt` → join date

### GET /api/loyalty/events?accountId=xxx
Returns last 20 loyalty events for history display.

Event types:
- `ACCUMULATE_POINTS` → stars earned (show `+N`)
- `REDEEM_REWARD` → reward redeemed (show gift icon)

## Components

### LoyaltyCard
- Background: `#C43A10`
- Shows: current stars (large number), progress bar, next reward message
- If `availableRewards.length > 0`: show "You have a free drink reward!"
- Use `react-native-reanimated` for progress bar animation

### StarsProgress
- 9 segments, filled white = earned, translucent white = remaining
- `current = balance % 9`

## Account Lookup Flow

```
User inputs phone → GET /api/loyalty/account
  → found: show LoyaltyCard + activity history
  → not found: "Visit us in store to start earning stars!"
```

Save phone to AsyncStorage key `mandy_phone` so user doesn't re-enter.

## Accrual After Payment

Handled server-side in `/api/payment` after successful charge:
1. Look up customer by phone → get `customerId`
2. Look up loyalty account by `customerId`
3. Call `accumulateLoyaltyPoints({ orderId })`
4. Wrapped in try/catch — loyalty failure does not affect payment success
