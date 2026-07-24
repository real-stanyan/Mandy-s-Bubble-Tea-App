# Mandy's Bubble Tea App

Rules live in `/AGENTS.md` (gearbox single source of truth; root `/CLAUDE.md` is the `@AGENTS.md` shell — content is not duplicated here to avoid double-loading).

Module docs in this directory — read before working on each area:

- `square-api.md` — Square client setup, BigInt handling, error handling
- `catalog.md` — Menu, categories, item cards
- `cart-checkout.md` — Cart state, checkout flow, order creation
- `payment.md` — In-app payment (Apple Pay / Google Pay via Square Mobile Payments SDK)
- `loyalty.md` — Stars system, loyalty card, progress bar
- `account.md` — User account, phone-based lookup
- `deployment.md` — EAS Build, app store submission, OTA updates
- `architecture.md` — Project structure, web-vs-app differences
